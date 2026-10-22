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
import type { Admin, User, Prisma } from '@prisma/client';
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_DEPENDENCIES,
  GLOBAL_ONLY_PERMISSIONS,
} from './permissions.constants';
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
    sessionVersion?: number;
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
  async wechatLogin(
    code: string,
    platform: WechatPlatform = 'mp-weixin',
    language = 'zh',
  ) {
    return this.userLogin(
      await this.identities.wechat(code, platform, undefined, language),
    );
  }

  async phoneLogin(challengeId: string, code: string, language = 'zh') {
    const phone = await this.challenges.consume(
      'PHONE_LOGIN',
      challengeId,
      code,
    );
    return this.userLogin(
      await this.identities.phone(phone, undefined, language),
    );
  }

  startCampusLogin(ip: string, origin?: string) {
    return this.campusOAuth.startLogin(ip, origin);
  }

  async campusLogin(dto: CampusLoginDto, language = 'zh') {
    return this.userLogin(await this.campusOAuth.login(dto, language));
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
        canteens: { select: { canteen: { select: { id: true, name: true } } } },
      },
    });

    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (!(await bcrypt.compare(pass, admin.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const tokens = await this._generateTokens({
      sub: admin.id,
      type: 'admin',
      sessionVersion: admin.sessionVersion,
    });

    return {
      code: 200,
      message: '登录成功',
      data: { token: tokens, ...this.adminSessionData(admin) },
    };
  }

  private authorizationCatalog() {
    return {
      groups: PERMISSION_GROUPS,
      dependencies: PERMISSION_DEPENDENCIES,
      globalOnly: GLOBAL_ONLY_PERMISSIONS,
    };
  }

  async getAdminSession(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id, deletedAt: null },
      include: {
        permissions: true,
        canteens: { select: { canteen: { select: { id: true, name: true } } } },
      },
    });
    if (!admin) throw new UnauthorizedException('管理员不存在');
    return {
      code: 200,
      message: 'success',
      data: this.adminSessionData(admin),
    };
  }

  private adminSessionData(
    admin: Prisma.AdminGetPayload<{
      include: {
        permissions: true;
        canteens: { select: { canteen: { select: { id: true; name: true } } } };
      };
    }>,
  ) {
    const { permissions, canteens } = admin;
    const profile = {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      scope: admin.scope,
      createdBy: admin.createdBy,
      managerId: admin.managerId,
      hierarchyVersion: admin.hierarchyVersion,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      mustChangePassword: admin.mustChangePassword,
    };
    return {
      admin: {
        ...profile,
        canteens: canteens.map((entry) => entry.canteen),
        canteenIds: canteens.map((entry) => entry.canteen.id),
      },
      permissions:
        admin.role === 'superadmin'
          ? [...ALL_PERMISSIONS]
          : permissions.map((item) => item.permission),
      authorization: this.authorizationCatalog(),
    };
  }

  // --- 功能3: 刷新Token ---
  async refreshToken(
    userId: string,
    userType: 'user' | 'admin',
    sessionVersion?: number,
  ) {
    if (userType === 'admin') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: userId, deletedAt: null },
        include: {
          permissions: true,
          canteens: {
            select: { canteen: { select: { id: true, name: true } } },
          },
        },
      });
      if (!admin || sessionVersion !== admin.sessionVersion) {
        throw new UnauthorizedException('登录会话已失效，请重新登录');
      }
      const token = await this._generateTokens({
        sub: userId,
        type: 'admin',
        sessionVersion,
      });
      const session = this.adminSessionData(admin);
      return {
        code: 200,
        message: '刷新成功',
        data: { token, user: session.admin, ...session },
      };
    }
    const user = await this.validateUser(userId);
    if (!user) throw new UnauthorizedException('用户不存在或已被删除');
    const profile = (await this.userProfileService.getUserProfile(userId)).data;
    const token = await this._generateTokens({ sub: userId, type: 'user' });
    return { code: 200, message: '刷新成功', data: { token, user: profile } };
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
