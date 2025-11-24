import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
import { Admin, User } from '@prisma/client';

interface WechatAuthResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  // --- 核心方法：生成 Access Token 和 Refresh Token ---
  private async _generateTokens(payload: { sub: string, type: 'user' | 'admin' }) {
    // 以 number 类型获取 expiresIn，并确保所有配置存在
    const accessTokenSecret = this.configService.get<string>('JWT_SECRET');
    const refreshTokenSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    // 将时间从 .env (可能是 string) 解析为 number
    const accessTokenExpiresIn = parseInt(
      this.configService.get<string>('JWT_EXPIRATION_TIME', '3600'),
      10
    );
    const refreshTokenExpiresIn = parseInt(
      this.configService.get<string>('JWT_REFRESH_EXPIRATION_TIME', '604800'),
      10
    );

    if (!accessTokenSecret || !refreshTokenSecret) {
      throw new InternalServerErrorException('JWT secret configuration is missing.');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessTokenSecret,
        expiresIn: accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshTokenSecret,
        expiresIn: refreshTokenExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // --- 功能1: 微信登录 ---
  async wechatLogin(code: string) {
    let openid: string;

    // 特殊处理测试用的 code，使其能匹配 seed 创建的基础用户
    if (code === 'baseline_user_code_placeholder') {
      openid = 'baseline_user_openid';
    } else if (code.startsWith('mock_')) {
      // 保留 mock 前缀用于开发测试
      openid = `mock_openid_for_${code}`;
    } else {
      // 生产环境：调用微信接口获取 openid
      const wechatData = await this.getOpenIdFromWechat(code);
      if (wechatData.errcode || !wechatData.openid) {
        throw new UnauthorizedException(`WeChat Login Failed: ${wechatData.errmsg || 'Unknown error, openid missing'}`);
      }
      openid = wechatData.openid;
    }

    let user = await this.prisma.user.findUnique({
      where: { openId: openid },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          openId: openid,
          nickname: `微信用户_${openid.slice(-4)}`, // 初始昵称
          // 其他默认字段
          allergens: [],
        },
      });
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
      throw new InternalServerErrorException('WeChat configuration is missing (WECHAT_APPID or WECHAT_SECRET).');
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    try {
      const { data } = await firstValueFrom(this.httpService.get<WechatAuthResponse>(url));
      return data;
    } catch (error) {
      throw new InternalServerErrorException('Failed to connect to WeChat API');
    }
  }

  // --- 功能2: 管理员登录 ---
  async adminLogin(username: string, pass: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
      include: {
        permissions: true,
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
    const { password, permissions: permissionsRelation, ...adminData } = admin;
    
    // 提取权限字符串数组
    const permissions = permissionsRelation.map(p => p.permission);
    
    return {
      code: 200,
      message: '登录成功',
      data: {
        token: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        admin: adminData,
        permissions,
      },
    };
  }
  
  // --- 功能3: 刷新Token ---
  async refreshToken(userId: string, userType: 'user' | 'admin') {
    // Guard已经验证了用户的身份，我们只需要重新生成token即可
    const tokens = await this._generateTokens({ sub: userId, type: userType });
    
    // 获取用户信息
    let userData;
    if (userType === 'user') {
      userData = await this.prisma.user.findUnique({
        where: { id: userId },
      });
    } else {
      const adminData = await this.prisma.admin.findUnique({
        where: { id: userId },
      });
      // 移除密码字段
      if (adminData) {
        const { password, ...admin } = adminData;
        userData = admin;
      }
    }
    
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
  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async validateAdmin(adminId: string): Promise<Admin | null> {
    return this.prisma.admin.findUnique({ where: { id: adminId } });
  }
}
