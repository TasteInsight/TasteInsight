import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '@/prisma.service';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { Admin, User } from '@prisma/client';
import { ALL_PERMISSIONS } from './permissions.constants';
import {
  UserIdentityService,
  type WechatPlatform,
} from './user-identity.service';
import { CampusOAuthService } from '@/campus-identity/campus-oauth.service';
import { CampusLoginDto } from '@/campus-identity/dto/student-verification.dto';
import { VerificationChallengeService } from './verification-challenge.service';

type TokenExpiration = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private identities: UserIdentityService,
    private userProfileService: UserProfileService,
    private challenges: VerificationChallengeService,
    private campusOAuth: CampusOAuthService,
  ) {}

  // --- 核心方法：生成 Access Token 和 Refresh Token ---
  private async _generateTokens(payload: {
    sub: string;
    type: 'user' | 'admin';
  }) {
    const accessTokenSecret = this.configService.get<string>('JWT_SECRET');
    const refreshTokenSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET');

    const accessTokenExpiresIn = this.parseTokenExpiration(
      this.configService.get<string>('JWT_EXPIRATION_TIME', '3600'),
    );
    const refreshTokenExpiresIn = this.parseTokenExpiration(
      this.configService.get<string>('JWT_REFRESH_EXPIRATION_TIME', '604800'),
    );

    if (!accessTokenSecret || !refreshTokenSecret) {
      throw new InternalServerErrorException(
        'JWT secret configuration is missing.',
      );
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, tokenUse: 'access' },
        {
          secret: accessTokenSecret,
          expiresIn: accessTokenExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, tokenUse: 'refresh' },
        {
          secret: refreshTokenSecret,
          expiresIn: refreshTokenExpiresIn,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private parseTokenExpiration(value: string): TokenExpiration {
    const normalized = value.trim();
    if (!/^(?:\d+|\d+(?:\.\d+)?(?:ms|s|m|h|d|w|y))$/.test(normalized)) {
      throw new InternalServerErrorException(
        `Invalid JWT expiration configuration: ${value}`,
      );
    }

    return /^\d+$/.test(normalized)
      ? Number(normalized)
      : (normalized as TokenExpiration);
  }

  // --- 功能1: 微信登录 ---
  async wechatLogin(code: string, platform: WechatPlatform = 'mp-weixin') {
    return this.userLogin(await this.identities.wechat(code, platform));
  }

  async phoneLogin(challengeId: string, code: string) {
    const phone = await this.challenges.consume(
      'PHONE_LOGIN',
      challengeId,
      code,
    );
    return this.userLogin(await this.identities.phone(phone));
  }

  startCampusLogin(ip: string, origin?: string) {
    return this.campusOAuth.startLogin(ip, origin);
  }

  async campusLogin(dto: CampusLoginDto) {
    return this.userLogin(await this.campusOAuth.login(dto));
  }

  private async userLogin(user: User) {
    const tokens = await this._generateTokens({ sub: user.id, type: 'user' });
    const profile = await this.userProfileService.getUserProfile(user.id);

    return {
      code: 200,
      message: '登录成功',
      data: {
        token: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        user: profile.data,
      },
    };
  }

  // --- 功能2: 管理员登录 ---
  async adminLogin(username: string, pass: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username, deletedAt: null },
      include: {
        permissions: true,
        canteen: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const {
      password,
      permissions: permissionsRelation,
      canteen,
      ...adminData
    } = admin;
    const isPasswordMatching = await bcrypt.compare(pass, password);

    if (!isPasswordMatching) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const tokens = await this._generateTokens({ sub: admin.id, type: 'admin' });

    // 提取权限字符串数组
    let permissions = permissionsRelation.map((p) => p.permission);

    // 超级管理员返回所有权限
    if (admin.role === 'superadmin') {
      permissions = [...ALL_PERMISSIONS];
    }

    return {
      code: 200,
      message: '登录成功',
      data: {
        token: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        admin: {
          ...adminData,
          canteenName: canteen?.name ?? null,
        },
        permissions,
      },
    };
  }

  // --- 功能3: 刷新Token ---
  async refreshToken(userId: string, userType: 'user' | 'admin') {
    // Guard 只证明 token 有效；签发新 token 前仍需确认账号存在。
    let userData;
    if (userType === 'user') {
      userData = await this.validateUser(userId);
    } else {
      userData = await this.validateAdmin(userId);
    }

    if (!userData) {
      throw new UnauthorizedException('用户不存在或已被删除');
    }

    if (userType === 'user') {
      userData = (await this.userProfileService.getUserProfile(userId)).data;
    }

    const tokens = await this._generateTokens({ sub: userId, type: userType });

    return {
      code: 200,
      message: '刷新成功',
      data: {
        token: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        user: userData,
      },
    };
  }

  // --- 辅助方法：验证用户 ---
  validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  validateAdmin(adminId: string): Promise<Omit<Admin, 'password'> | null> {
    return this.prisma.admin.findUnique({
      where: { id: adminId, deletedAt: null },
      omit: { password: true },
    });
  }
}
