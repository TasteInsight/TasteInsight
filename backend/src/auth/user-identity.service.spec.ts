import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@/prisma.service';
import { of, throwError } from 'rxjs';
import { UserIdentityService } from './user-identity.service';

describe('UserIdentityService', () => {
  const user = { id: 'user', nickname: 'Person', openId: null };
  const tx = {
    $executeRaw: jest.fn(),
    user: { findUnique: jest.fn(), create: jest.fn() },
    userIdentity: { findMany: jest.fn(), upsert: jest.fn() },
    studentVerification: { findUnique: jest.fn() },
  };
  const prisma = { ...tx, $transaction: jest.fn() };
  const http = { get: jest.fn() };
  const settings: Record<string, string | boolean> = {};
  const config = { get: (key: string) => settings[key] };
  const service = new UserIdentityService(
    prisma as unknown as PrismaService,
    config as ConfigService,
    http as unknown as HttpService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    Object.keys(settings).forEach((key) => delete settings[key]);
    Object.assign(settings, {
      NODE_ENV: 'test',
      ENABLE_MOCK_AUTH: false,
      WECHAT_APPID: 'mini-app',
      WECHAT_SECRET: 'mini-secret',
      WECHAT_APP_APPID: 'mobile-app',
      WECHAT_APP_SECRET: 'mobile-secret',
      WECHAT_OPEN_PLATFORM_ID: 'open-platform',
    });
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.userIdentity.findMany.mockResolvedValue([]);
    tx.studentVerification.findUnique.mockResolvedValue(null);
    settings.CAMPUS_OAUTH_ISSUER = 'https://school.example';
    tx.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id ? { ...user, id: where.id } : null),
    );
    tx.user.create.mockResolvedValue(user);
    http.get.mockReturnValue(
      of({ data: { openid: 'openid', unionid: 'unionid' } }),
    );
  });
  it.each(['mp-weixin', 'app'] as const)(
    'rejects disabled %s authorization before contacting WeChat',
    async (platform) => {
      settings.AUTH_LOGIN_METHODS = '';
      await expect(service.wechat('code', platform)).rejects.toMatchObject({
        response: { code: 'LOGIN_METHOD_DISABLED' },
      });
      expect(http.get).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('uses the mini-program exchange and app-scoped identity', async () => {
    expect(await service.wechat('code')).toEqual(user);
    expect(http.get).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/sns/jscode2session',
      expect.objectContaining({
        params: {
          appid: 'mini-app',
          secret: 'mini-secret',
          grant_type: 'authorization_code',
          js_code: 'code',
        },
        maxRedirects: 0,
      }),
    );
    expect(tx.userIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: 'WECHAT_OPENID',
          issuer: 'mini-app',
          subject: 'openid',
          userId: 'user',
        }),
      }),
    );
    expect(tx.userIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: 'WECHAT_UNIONID',
          issuer: 'open-platform',
          subject: 'unionid',
        }),
      }),
    );
  });
  it('uses the mobile application endpoint and never searches unscoped legacy OpenID', async () => {
    await service.wechat('mobile-code', 'app');
    expect(http.get).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/sns/oauth2/access_token',
      expect.objectContaining({
        params: {
          appid: 'mobile-app',
          secret: 'mobile-secret',
          grant_type: 'authorization_code',
          code: 'mobile-code',
        },
      }),
    );
    expect(tx.user.findUnique).not.toHaveBeenCalledWith({
      where: { openId: 'openid' },
    });
  });
  it('uses a verified shared UnionID to reuse an account across apps', async () => {
    tx.userIdentity.findMany.mockResolvedValue([
      { userId: 'existing', provider: 'WECHAT_UNIONID' },
    ]);
    const result = await service.wechat('code', 'app');
    expect(result.id).toBe('existing');
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it('does not silently merge conflicting OpenID and UnionID owners', async () => {
    tx.userIdentity.findMany.mockResolvedValue([
      { userId: 'alice' },
      { userId: 'bob' },
    ]);
    await expect(service.wechat('code')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.userIdentity.upsert).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it('retains the legacy mini-program user ID when recording the first identity', async () => {
    tx.user.findUnique.mockResolvedValue({
      ...user,
      id: 'legacy',
      openId: 'openid',
    });
    expect((await service.wechat('code')).id).toBe('legacy');
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it('does not assume UnionID exists', async () => {
    http.get.mockReturnValue(of({ data: { openid: 'only-openid' } }));
    await service.wechat('code');
    expect(tx.userIdentity.upsert).toHaveBeenCalledTimes(1);
  });
  it('creates a phone account without a fabricated OpenID or student status', async () => {
    await service.phone('+8613812345678');
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('openId');
    expect(data).not.toHaveProperty('studentVerification');
    expect(tx.userIdentity.upsert.mock.calls[0][0].create).toMatchObject({
      provider: 'PHONE',
      issuer: 'global',
      subject: '+8613812345678',
    });
  });
  it('will not steal an occupied phone identity during binding', async () => {
    tx.userIdentity.findMany
      .mockResolvedValueOnce([{ userId: 'alice' }])
      .mockResolvedValueOnce([]);
    await expect(service.phone('+8613812345678', 'bob')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.userIdentity.upsert).not.toHaveBeenCalled();
  });
  it('does not leave an old phone silently active when a second is bound', async () => {
    tx.userIdentity.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        userId: 'alice',
        provider: 'PHONE',
        issuer: 'global',
        subject: '+8611111111111',
      },
    ]);
    await expect(
      service.phone('+8613812345678', 'alice'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each(['production', 'test'])(
    'disables mock login by default in %s',
    async (mode) => {
      settings.NODE_ENV = mode;
      await expect(service.wechat('mock_identity')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(http.get).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it('never permits production mock login even when enabled', async () => {
    settings.NODE_ENV = 'production';
    settings.ENABLE_MOCK_AUTH = true;
    await expect(
      service.wechat('baseline_user_code_placeholder'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('keeps explicitly enabled development mock identities outside the real app namespace', async () => {
    settings.NODE_ENV = 'development';
    settings.ENABLE_MOCK_AUTH = true;
    await service.wechat('mock_identity');
    expect(http.get).not.toHaveBeenCalled();
    expect(tx.userIdentity.upsert.mock.calls[0][0].create.issuer).toBe(
      'development',
    );
  });
  it('sanitizes provider failures instead of exposing code or credentials', async () => {
    http.get.mockReturnValue(
      throwError(() => new Error('secret=mobile-secret&code=raw')),
    );
    await expect(service.wechat('raw')).rejects.toThrow(
      '微信登录服务暂时不可用',
    );
  });
  it('rejects errors and missing provider identity', async () => {
    http.get.mockReturnValue(
      of({ data: { errcode: 40029, errmsg: 'private message' } }),
    );
    await expect(service.wechat('code')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    settings.WECHAT_SECRET = '';
    await expect(service.wechat('code')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
  it('returns only masked phone and platform booleans from bound identities', async () => {
    tx.userIdentity.findMany.mockResolvedValue([
      { provider: 'PHONE', subject: '+8613812345678' },
      {
        provider: 'CAMPUS_OAUTH',
        issuer: 'https://school.example',
        subject: 'private-campus-digest',
      },
      {
        provider: 'WECHAT_OPENID',
        issuer: 'mini-app',
        subject: 'private-openid',
      },
    ]);
    expect(await service.list('user')).toEqual({
      campusOAuth: true,
      phone: '+86****5678',
      wechat: { miniapp: true, app: false },
    });
  });
  it('resolves campus login from login identities without looking up campus qualifications', async () => {
    tx.studentVerification.findUnique.mockResolvedValue({
      userId: 'user',
    });
    const result = await service.campus(
      tx as unknown as Prisma.TransactionClient,
      'digest',
    );
    expect(result.id).toBe('user');
    expect(tx.studentVerification.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.userIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: 'CAMPUS_OAUTH',
          issuer: 'https://school.example',
          subject: 'digest',
          userId: 'user',
        }),
      }),
    );
  });
  it('rejects a campus identity owned by another account without merging owners', async () => {
    tx.userIdentity.findMany.mockResolvedValue([
      {
        provider: 'CAMPUS_OAUTH',
        issuer: 'https://school.example',
        subject: 'digest',
        userId: 'other',
      },
    ]);
    await expect(
      service.campus(
        tx as unknown as Prisma.TransactionClient,
        'digest',
        'user',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userIdentity.upsert).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
