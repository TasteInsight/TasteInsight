import { ConfigService } from '@nestjs/config';
import RPCClient from '@alicloud/pop-core';
import axios from 'axios';
import { PrismaService } from '@/prisma.service';
import {
  ModerationProviderError,
  ModerationProviderService,
} from './moderation-provider.service';

const settings: Record<string, string> = {
  MODERATION_ALIYUN_ACCESS_KEY_ID: 'test-key-id',
  MODERATION_ALIYUN_ACCESS_KEY_SECRET: 'test-key-secret',
  WECHAT_APPID: 'wx-miniapp',
  WECHAT_SECRET: 'test-app-secret',
  MODERATION_WECHAT_TOKEN: 'callback-token',
  MODERATION_WECHAT_AES_KEY: 'a'.repeat(43),
};
const text = { text: '食堂的米饭很好吃', userId: 'user-1', scene: 2 as const };
const image = {
  url: 'https://images.example.test/photo.jpg',
  userId: 'user-1',
  scene: 3 as const,
};
const tokenFixture = { access_token: 'stable-access-token', expires_in: 7200 };
const fixtures = {
  aliyunPass: {
    Code: 200,
    RequestId: 'aliyun-text-1',
    Data: { labels: '', reason: '' },
  },
  aliyunRisk: (level: string) => ({
    Code: 200,
    RequestId: 'aliyun-text-2',
    Data: {
      labels: 'sexual_content',
      reason: JSON.stringify({
        riskLevel: level,
        riskWords: 'private-content',
      }),
    },
  }),
  aliyunImage: (level: string) => ({
    Code: 200,
    RequestId: 'aliyun-image-1',
    Data: { RiskLevel: level, Result: [{ Label: 'nonLabel' }] },
  }),
  wechatText: (suggest: string) => ({
    errcode: 0,
    errmsg: 'ok',
    trace_id: 'wechat-text-1',
    result: { suggest, label: suggest === 'pass' ? 100 : 20001 },
  }),
  wechatImage: { errcode: 0, errmsg: 'ok', trace_id: 'wechat-image-1' },
};

describe('ModerationProviderService', () => {
  let service: ModerationProviderService;
  let config: Record<string, string>;
  let identity: jest.Mock;
  let aliyun: jest.SpyInstance;
  let post: jest.SpyInstance;

  beforeEach(() => {
    config = { ...settings };
    identity = jest.fn().mockResolvedValue({ subject: 'trusted-openid' });
    service = new ModerationProviderService(
      { get: (key: string) => config[key] } as ConfigService,
      { userIdentity: { findFirst: identity } } as unknown as PrismaService,
    );
    aliyun = jest.spyOn(RPCClient.prototype, 'request');
    post = jest.spyOn(axios, 'post');
  });

  afterEach(() => jest.restoreAllMocks());

  it('reports credentials and callback encryption requirements', () => {
    delete config.MODERATION_ALIYUN_ACCESS_KEY_SECRET;
    delete config.WECHAT_SECRET;
    config.MODERATION_WECHAT_AES_KEY = 'short-key';
    expect(service.readiness()).toEqual({
      aliyun: {
        configured: false,
        missing: ['MODERATION_ALIYUN_ACCESS_KEY_SECRET'],
      },
      wechat: {
        configured: false,
        missing: ['WECHAT_SECRET', 'MODERATION_WECHAT_AES_KEY'],
      },
    });
  });

  it('rejects an invalid region before constructing an SDK endpoint', async () => {
    config.MODERATION_ALIYUN_REGION = 'cn-shanghai/attacker.test';
    expect(service.readiness().aliyun.missing).toContain(
      'MODERATION_ALIYUN_REGION',
    );
    await expect(service.checkText('aliyun', text)).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
    expect(aliyun).not.toHaveBeenCalled();
  });

  it('uses the official TextModeration protocol and empty labels as a clean result', async () => {
    aliyun.mockResolvedValue(fixtures.aliyunPass);
    await expect(service.checkText('aliyun', text)).resolves.toEqual({
      decision: 'pass',
      requestId: 'aliyun-text-1',
    });
    expect(aliyun).toHaveBeenCalledWith(
      'TextModeration',
      {
        Service: 'comment_detection',
        ServiceParameters: JSON.stringify({
          content: text.text,
          accountId: text.userId,
        }),
      },
      { method: 'POST', timeout: 10000 },
    );
  });

  it.each([
    ['high', 'block'],
    ['medium', 'review'],
    ['low', 'pass'],
    ['future-level', 'review'],
  ])('maps Aliyun text risk %s to %s', async (level, decision) => {
    aliyun.mockResolvedValue(fixtures.aliyunRisk(level));
    await expect(service.checkText('aliyun', text)).resolves.toMatchObject({
      decision,
    });
  });

  it('supports capitalized fields documented by the integration guide', async () => {
    aliyun.mockResolvedValue({
      Code: 200,
      Data: { Labels: 'ad', Reason: '{"riskLevel":"high"}' },
    });
    await expect(service.checkText('aliyun', text)).resolves.toMatchObject({
      decision: 'block',
    });
  });

  it.each([
    {},
    { Data: {} },
    { Data: { labels: 'new-label' } },
    { Data: { labels: 'ad', reason: 'invalid JSON with private-content' } },
    { Data: { labels: 'ad', reason: 'null' } },
    { Data: { labels: '', reason: 12 } },
  ])('routes malformed Aliyun text results to review: %p', async (body) => {
    aliyun.mockResolvedValue({ Code: 200, ...body });
    const result = await service.checkText('aliyun', text);
    expect(result.decision).toBe('review');
    expect(JSON.stringify(result)).not.toContain('private-content');
  });

  it.each([
    ['high', 'block'],
    ['medium', 'review'],
    ['low', 'pass'],
    ['none', 'pass'],
    ['future-level', 'review'],
  ])('maps Aliyun image risk %s to %s', async (level, decision) => {
    aliyun.mockResolvedValue(fixtures.aliyunImage(level));
    await expect(service.checkImage('aliyun', image)).resolves.toMatchObject({
      decision,
      requestId: 'aliyun-image-1',
    });
    expect(aliyun).toHaveBeenCalledWith(
      'ImageModeration',
      {
        Service: 'baselineCheck',
        ServiceParameters: JSON.stringify({ imageUrl: image.url }),
      },
      expect.any(Object),
    );
  });

  it('keeps a malformed Aliyun image result for review', async () => {
    aliyun.mockResolvedValue({ Code: 200, Data: {} });
    await expect(service.checkImage('aliyun', image)).resolves.toMatchObject({
      decision: 'review',
    });
  });

  it.each([600, 2500])(
    'keeps oversized text whole for human review at limit %i',
    async (limit) => {
      const provider = limit === 600 ? 'aliyun' : 'wechat';
      await expect(
        service.checkText(provider, { ...text, text: '饭'.repeat(limit + 1) }),
      ).resolves.toMatchObject({
        decision: 'review',
        reason: expect.any(String),
      });
      expect(aliyun).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('counts Unicode characters without splitting surrogate pairs', async () => {
    aliyun.mockResolvedValue(fixtures.aliyunPass);
    await expect(
      service.checkText('aliyun', { ...text, text: '🍚'.repeat(600) }),
    ).resolves.toMatchObject({ decision: 'pass' });
  });

  it.each([
    ['pass', 'pass'],
    ['review', 'review'],
    ['risky', 'block'],
    ['future-suggest', 'review'],
  ])('maps WeChat suggest %s to %s', async (suggest, decision) => {
    post
      .mockResolvedValueOnce({ data: tokenFixture })
      .mockResolvedValueOnce({ data: fixtures.wechatText(suggest) });
    await expect(service.checkText('wechat', text)).resolves.toMatchObject({
      decision,
      requestId: 'wechat-text-1',
    });
    expect(identity).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        provider: 'WECHAT_OPENID',
        issuer: 'wx-miniapp',
      },
      select: { subject: true },
      orderBy: { verifiedAt: 'desc' },
    });
    expect(post).toHaveBeenLastCalledWith(
      'https://api.weixin.qq.com/wxa/msg_sec_check',
      {
        content: text.text,
        version: 2,
        scene: 2,
        openid: 'trusted-openid',
      },
      {
        timeout: 10000,
        maxRedirects: 0,
        params: { access_token: 'stable-access-token' },
      },
    );
  });

  it.each(['checkText', 'checkImage'] as const)(
    'returns review from %s when the AppID-scoped identity is absent',
    async (method) => {
      identity.mockResolvedValue(null);
      const result =
        method === 'checkText'
          ? await service.checkText('wechat', text)
          : await service.checkImage('wechat', image);
      expect(result).toMatchObject({ decision: 'review' });
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('returns a pending image task only after the provider accepts it', async () => {
    post
      .mockResolvedValueOnce({ data: tokenFixture })
      .mockResolvedValueOnce({ data: fixtures.wechatImage });
    await expect(service.checkImage('wechat', image)).resolves.toEqual({
      decision: 'pending',
      requestId: 'wechat-image-1',
    });
    expect(post).toHaveBeenLastCalledWith(
      'https://api.weixin.qq.com/wxa/media_check_async',
      {
        media_url: image.url,
        media_type: 2,
        version: 2,
        scene: 3,
        openid: 'trusted-openid',
      },
      expect.any(Object),
    );
  });

  it.each([{}, { errcode: 0 }, { errcode: 0, result: {} }])(
    'routes incomplete WeChat text responses to review: %p',
    async (body) => {
      post
        .mockResolvedValueOnce({ data: tokenFixture })
        .mockResolvedValueOnce({ data: body });
      await expect(service.checkText('wechat', text)).resolves.toMatchObject({
        decision: 'review',
      });
    },
  );

  it('requires a nonempty trace ID for an asynchronous task', async () => {
    post
      .mockResolvedValueOnce({ data: tokenFixture })
      .mockResolvedValueOnce({ data: { errcode: 0, trace_id: '' } });
    await expect(service.checkImage('wechat', image)).resolves.toMatchObject({
      decision: 'review',
    });
  });

  it.each([40003, 43104, 61010])(
    'routes WeChat identity/visit rejection %i to review',
    async (errcode) => {
      post.mockResolvedValueOnce({ data: tokenFixture }).mockResolvedValueOnce({
        data: { errcode, errmsg: 'private-content' },
      });
      const result = await service.checkText('wechat', text);
      expect(result).toMatchObject({ decision: 'review' });
      expect(JSON.stringify(result)).not.toContain('private-content');
      expect(post).toHaveBeenCalledTimes(2);
    },
  );

  it('caches stable tokens without invalidating other application instances', async () => {
    post
      .mockResolvedValueOnce({ data: tokenFixture })
      .mockResolvedValue({ data: fixtures.wechatText('pass') });
    await service.checkText('wechat', text);
    await service.checkText('wechat', text);
    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenNthCalledWith(
      1,
      'https://api.weixin.qq.com/cgi-bin/stable_token',
      {
        grant_type: 'client_credential',
        appid: 'wx-miniapp',
        secret: 'test-app-secret',
        force_refresh: false,
      },
      { timeout: 10000, maxRedirects: 0 },
    );
  });

  it('shares a concurrent token request within one process', async () => {
    post.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.endsWith('stable_token')
          ? tokenFixture
          : fixtures.wechatText('pass'),
      }),
    );
    await Promise.all([
      service.checkText('wechat', text),
      service.checkText('wechat', text),
      service.checkText('wechat', text),
    ]);
    expect(
      post.mock.calls.filter(([url]) => String(url).endsWith('stable_token')),
    ).toHaveLength(1);
  });

  it('refreshes the cached token before expiry', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    post
      .mockResolvedValueOnce({ data: tokenFixture })
      .mockResolvedValueOnce({ data: fixtures.wechatText('pass') })
      .mockResolvedValueOnce({ data: tokenFixture })
      .mockResolvedValueOnce({ data: fixtures.wechatText('pass') });
    await service.checkText('wechat', text);
    now.mockReturnValue((7200 - 59) * 1000);
    await service.checkText('wechat', text);
    expect(post).toHaveBeenCalledTimes(4);
  });

  it.each([40001, 40014, 42001])(
    'reacquires the stable token once for token error %i',
    async (errcode) => {
      post
        .mockResolvedValueOnce({ data: tokenFixture })
        .mockResolvedValueOnce({ data: { errcode } })
        .mockResolvedValueOnce({
          data: { access_token: 'replacement-token', expires_in: 7200 },
        })
        .mockResolvedValueOnce({ data: fixtures.wechatText('pass') });
      await expect(service.checkText('wechat', text)).resolves.toMatchObject({
        decision: 'pass',
      });
      expect(post).toHaveBeenCalledTimes(4);
      expect(post.mock.calls[2][1]).toMatchObject({ force_refresh: false });
      expect(post.mock.calls[3][2]).toMatchObject({
        params: { access_token: 'replacement-token' },
      });
    },
  );

  it('stops after a repeated token rejection', async () => {
    post
      .mockResolvedValueOnce({ data: tokenFixture })
      .mockResolvedValueOnce({ data: { errcode: 40001 } })
      .mockResolvedValueOnce({ data: tokenFixture })
      .mockResolvedValueOnce({ data: { errcode: 40001 } });
    await expect(service.checkText('wechat', text)).rejects.toMatchObject({
      code: 'TOKEN_REJECTED',
    });
    expect(post).toHaveBeenCalledTimes(4);
  });

  it.each([
    {},
    { errcode: 40125, errmsg: 'secret rejected' },
    { access_token: 'token', expires_in: -1 },
    { access_token: '', expires_in: 7200 },
  ])('rejects an unusable token response: %p', async (body) => {
    post.mockResolvedValueOnce({ data: body });
    await expect(service.checkText('wechat', text)).rejects.toMatchObject({
      code: 'TOKEN_RESPONSE_INVALID',
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('sanitizes transport exceptions including request bodies and credentials', async () => {
    post.mockRejectedValueOnce(
      new Error('test-app-secret stable-access-token private-content'),
    );
    let caught: unknown;
    try {
      await service.checkText('wechat', text);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ModerationProviderError);
    expect(String(caught)).not.toMatch(/test-app-secret|private-content/);
    expect(caught).not.toHaveProperty('cause');
  });

  it('sanitizes SDK exceptions', async () => {
    aliyun.mockRejectedValueOnce(new Error('test-key-secret private-content'));
    await expect(service.checkImage('aliyun', image)).rejects.toMatchObject({
      provider: 'aliyun',
      code: 'REQUEST_FAILED',
      message: '内容审核服务暂时不可用（aliyun）',
    });
  });

  it.each([408, 500, 588])(
    'throws for Aliyun service error %i',
    async (Code) => {
      aliyun.mockResolvedValueOnce({ Code, Message: 'private-content' });
      await expect(service.checkText('aliyun', text)).rejects.toBeInstanceOf(
        ModerationProviderError,
      );
    },
  );

  it('throws for a WeChat quota error without retrying the submission', async () => {
    post.mockResolvedValueOnce({ data: tokenFixture }).mockResolvedValueOnce({
      data: { errcode: 45009, errmsg: 'private-content' },
    });
    await expect(service.checkText('wechat', text)).rejects.toMatchObject({
      code: 'API_ERROR',
    });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
