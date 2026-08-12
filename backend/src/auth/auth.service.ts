import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '@/prisma.service';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
import type { Admin, User } from '@prisma/client';
import { ALL_PERMISSIONS } from './permissions.constants';

interface WechatAuthResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

type TokenExpiration = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private httpService: HttpService,
    private userProfileService: UserProfileService,
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
      this.jwtService.signAsync({ ...payload, tokenUse: 'access' }, {
        secret: accessTokenSecret,
        expiresIn: accessTokenExpiresIn,
      }),
      this.jwtService.signAsync({ ...payload, tokenUse: 'refresh' }, {
        secret: refreshTokenSecret,
        expiresIn: refreshTokenExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private parseTokenExpiration(value: string): TokenExpiration {
    const normalized = value.trim();
    if (
      !/^(?:\d+|\d+(?:\.\d+)?(?:ms|s|m|h|d|w|y))$/.test(normalized)
    ) {
      throw new InternalServerErrorException(
        `Invalid JWT expiration configuration: ${value}`,
      );
    }

    return /^\d+$/.test(normalized)
      ? Number(normalized)
      : (normalized as TokenExpiration);
  }

  // --- 功能1: 微信登录 ---
  async wechatLogin(code: string) {
    let openid: string;

    // 特殊处理测试用的 code，使其能匹配 seed 创建的基础用户
    const enableMock =
      this.configService.get<string>('ENABLE_MOCK_AUTH') === 'true';

    if (enableMock && code === 'baseline_user_code_placeholder') {
      openid = 'baseline_user_openid';
    } else if (enableMock && code === 'secondary_user_code_placeholder') {
      openid = 'secondary_user_openid';
    } else if (enableMock && code.startsWith('mock_')) {
      // 保留 mock 前缀用于开发测试
      openid = `mock_openid_for_${code}`;
    } else {
      // 生产环境：调用微信接口获取 openid
      const wechatData = await this.getOpenIdFromWechat(code);
      if (wechatData.errcode || !wechatData.openid) {
        throw new UnauthorizedException(
          `WeChat Login Failed: ${wechatData.errmsg || 'Unknown error, openid missing'}`,
        );
      }
      openid = wechatData.openid;
    }

    let user = await this.prisma.user.findUnique({
      where: { openId: openid },
    });

    if (!user) {
      user = await this.userProfileService.createUser(openid);
    }

    const tokens = await this._generateTokens({ sub: user.id, type: 'user' });

    return {
      code: 200,
      message: '登录成功',
      data: {
        token: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        user,
      },
    };
  }

  private async getOpenIdFromWechat(code: string): Promise<WechatAuthResponse> {
    const appId = this.configService.get<string>('WECHAT_APPID');
    const secret = this.configService.get<string>('WECHAT_SECRET');

    if (!appId || !secret) {
      throw new InternalServerErrorException(
        'WeChat configuration is missing (WECHAT_APPID or WECHAT_SECRET).',
      );
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<WechatAuthResponse>(url),
      );
      return data;
    } catch {
      throw new InternalServerErrorException('Failed to connect to WeChat API');
    }
  }

  // --- 功能2: 管理员登录 ---
  async adminLogin(username: string, pass: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
      include: {
        permissions: true,
        canteen: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordMatching = await bcrypt.compare(pass, admin.password);

    if (!isPasswordMatching) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const tokens = await this._generateTokens({ sub: admin.id, type: 'admin' });

    // 从返回结果中移除密码和权限关联
    const {
      password: _password,
      permissions: permissionsRelation,
      canteen,
      ...adminData
    } = admin;

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
      const adminData = await this.validateAdmin(userId);
      // 移除密码字段
      if (adminData) {
        const { password: _password, ...admin } = adminData;
        userData = admin;
      }
    }

    if (!userData) {
      throw new UnauthorizedException('用户不存在或已被删除');
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

  validateAdmin(adminId: string): Promise<Admin | null> {
    return this.prisma.admin.findUnique({ where: { id: adminId } });
  }
}
