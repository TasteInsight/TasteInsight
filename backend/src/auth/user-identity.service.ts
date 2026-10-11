import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma.service';
import { mockAuthEnabled } from '@/environment';

type Identity = { provider: string; issuer: string; subject: string };
export type WechatPlatform = 'mp-weixin' | 'app';

@Injectable()
export class UserIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async phone(target: string, userId?: string) {
    return this.resolve(
      [{ provider: 'PHONE', issuer: 'global', subject: target }],
      userId,
    );
  }

  async list(userId: string) {
    const identities = await this.prisma.userIdentity.findMany({
      where: { userId },
      orderBy: { verifiedAt: 'desc' },
    });
    const phone = identities.find(
      (identity) => identity.provider === 'PHONE',
    )?.subject;
    const hasWechat = (key: string) =>
      identities.some(
        (identity) =>
          identity.provider === 'WECHAT_OPENID' &&
          identity.issuer === this.config.get(key),
      );
    return {
      ...(phone ? { phone: `${phone.slice(0, 3)}****${phone.slice(-4)}` } : {}),
      wechat: {
        miniapp: hasWechat('WECHAT_APPID'),
        app: hasWechat('WECHAT_APP_APPID'),
      },
    };
  }

  async wechat(
    code: string,
    platform: WechatPlatform = 'mp-weixin',
    userId?: string,
  ) {
    const isMock =
      code.startsWith('mock_') ||
      code === 'baseline_user_code_placeholder' ||
      code === 'secondary_user_code_placeholder';
    if (isMock) {
      if (
        !mockAuthEnabled({
          NODE_ENV: this.config.get('NODE_ENV'),
          ENABLE_MOCK_AUTH: this.config.get('ENABLE_MOCK_AUTH'),
        })
      ) {
        throw new UnauthorizedException('Mock login is disabled');
      }
      const openId =
        code === 'baseline_user_code_placeholder'
          ? 'baseline_user_openid'
          : code === 'secondary_user_code_placeholder'
            ? 'secondary_user_openid'
            : `mock_openid_for_${code}`;
      return this.resolve(
        [{ provider: 'WECHAT_OPENID', issuer: 'development', subject: openId }],
        userId,
        openId,
      );
    }
    const appId = this.config.get<string>(
      platform === 'app' ? 'WECHAT_APP_APPID' : 'WECHAT_APPID',
    );
    const secret = this.config.get<string>(
      platform === 'app' ? 'WECHAT_APP_SECRET' : 'WECHAT_SECRET',
    );
    if (!appId || !secret)
      throw new InternalServerErrorException('当前平台微信登录尚未配置');
    const endpoint =
      platform === 'app'
        ? 'https://api.weixin.qq.com/sns/oauth2/access_token'
        : 'https://api.weixin.qq.com/sns/jscode2session';
    let data: { openid?: string; unionid?: string; errcode?: number };
    try {
      const response = await firstValueFrom(
        this.http.get(endpoint, {
          params: {
            appid: appId,
            secret,
            grant_type: 'authorization_code',
            ...(platform === 'app' ? { code } : { js_code: code }),
          },
          timeout: 10000,
          maxRedirects: 0,
        }),
      );
      data = response.data;
    } catch {
      throw new InternalServerErrorException('微信登录服务暂时不可用');
    }
    if (data?.errcode || typeof data?.openid !== 'string' || !data.openid) {
      throw new UnauthorizedException('微信授权已失效，请重新授权');
    }
    const identities: Identity[] = [
      { provider: 'WECHAT_OPENID', issuer: appId, subject: data.openid },
    ];
    const unionIssuer = this.config.get<string>('WECHAT_OPEN_PLATFORM_ID');
    if (unionIssuer && typeof data.unionid === 'string' && data.unionid) {
      identities.push({
        provider: 'WECHAT_UNIONID',
        issuer: unionIssuer,
        subject: data.unionid,
      });
    }
    return this.resolve(
      identities,
      userId,
      platform === 'mp-weixin' ? data.openid : undefined,
    );
  }

  private async resolve(
    identities: Identity[],
    userId?: string,
    legacyOpenId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locks = identities.map(
        (identity) =>
          `identity:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`,
      );
      if (userId) locks.push(`identity-owner:${userId}`);
      locks.sort();
      for (const lock of locks)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
      const existing = await tx.userIdentity.findMany({
        where: { OR: identities },
      });
      if (userId) {
        const bound = await tx.userIdentity.findMany({
          where: {
            userId,
            OR: identities.map(({ provider, issuer }) => ({
              provider,
              issuer,
            })),
          },
        });
        if (
          bound.some((previous) =>
            identities.some(
              (identity) =>
                identity.provider === previous.provider &&
                identity.issuer === previous.issuer &&
                identity.subject !== previous.subject,
            ),
          )
        ) {
          throw new ConflictException({
            code: 'IDENTITY_ALREADY_BOUND',
            message: '当前账号已绑定此登录方式，请联系管理员处理更换',
          });
        }
      }
      const legacy = legacyOpenId
        ? await tx.user.findUnique({ where: { openId: legacyOpenId } })
        : null;
      const owners = new Set(existing.map((identity) => identity.userId));
      if (legacy) owners.add(legacy.id);
      if (userId) owners.add(userId);
      if (owners.size > 1) {
        throw new ConflictException({
          code: 'IDENTITY_ALREADY_BOUND',
          message: '该登录方式已绑定其他账号，请使用原账号登录',
        });
      }
      const owner = owners.values().next().value;
      const user = owner
        ? await tx.user.findUnique({ where: { id: owner } })
        : await tx.user.create({
            data: {
              ...(legacyOpenId ? { openId: legacyOpenId } : {}),
              nickname: '新用户',
              preferences: { create: {} },
              settings: { create: {} },
            },
          });
      if (!user) throw new UnauthorizedException('账号不存在');
      for (const identity of identities) {
        await tx.userIdentity.upsert({
          where: { provider_issuer_subject: identity },
          create: { ...identity, userId: user.id, verifiedAt: new Date() },
          update: { verifiedAt: new Date() },
        });
      }
      return user;
    });
  }
}
