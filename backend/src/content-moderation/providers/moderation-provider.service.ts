import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import RPCClient from '@alicloud/pop-core';
import axios from 'axios';
import { PrismaService } from '@/prisma.service';

export type ModerationProvider = 'aliyun' | 'wechat';
export type ModerationDecision = {
  decision: 'pass' | 'review' | 'block';
  requestId?: string;
  reason?: string;
};
export type ModerationImageDecision =
  | ModerationDecision
  | { decision: 'pending'; requestId: string };
type Input = { userId: string; scene: 1 | 2 | 3 | 4 };
type ApiResponse = Record<string, unknown>;

export class ModerationProviderError extends Error {
  constructor(
    readonly provider: ModerationProvider,
    readonly code: string,
  ) {
    super(`内容审核服务暂时不可用（${provider}）`);
    this.name = 'ModerationProviderError';
  }
}

function record(value: unknown): ApiResponse {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ApiResponse)
    : {};
}

function requestId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function riskDecision(level: unknown): ModerationDecision['decision'] {
  switch (level) {
    case 'high':
      return 'block';
    case 'medium':
      return 'review';
    case 'low':
    case 'none':
      return 'pass';
    default:
      return 'review';
  }
}

@Injectable()
export class ModerationProviderService {
  private aliyunClient?: RPCClient;
  private wechatToken?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  readiness() {
    const aliyun = [
      'MODERATION_ALIYUN_ACCESS_KEY_ID',
      'MODERATION_ALIYUN_ACCESS_KEY_SECRET',
    ].filter((key) => !this.setting(key));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(this.aliyunRegion())) {
      aliyun.push('MODERATION_ALIYUN_REGION');
    }
    const wechat = [
      'WECHAT_APPID',
      'WECHAT_SECRET',
      'MODERATION_WECHAT_TOKEN',
    ].filter((key) => !this.setting(key));
    if (
      !/^[A-Za-z0-9+/]{43}$/.test(this.setting('MODERATION_WECHAT_AES_KEY'))
    ) {
      wechat.push('MODERATION_WECHAT_AES_KEY');
    }
    return {
      aliyun: { configured: aliyun.length === 0, missing: aliyun },
      wechat: { configured: wechat.length === 0, missing: wechat },
    };
  }

  async checkText(
    provider: ModerationProvider,
    input: Input & { text: string },
  ): Promise<ModerationDecision> {
    this.assertConfigured(provider);
    const limit = provider === 'aliyun' ? 600 : 2500;
    if (Array.from(input.text).length > limit) {
      return { decision: 'review', reason: '文本长度超过审核服务上限' };
    }
    if (provider === 'aliyun') {
      const response = await this.aliyunRequest('TextModeration', {
        Service:
          this.setting('MODERATION_ALIYUN_TEXT_SERVICE') || 'comment_detection',
        ServiceParameters: JSON.stringify({
          content: input.text,
          accountId: input.userId,
        }),
      });
      const data = record(response.Data);
      const labels = data.labels ?? data.Labels;
      const reasonJson = data.reason ?? data.Reason;
      let reason: ApiResponse = {};
      if (typeof reasonJson === 'string' && reasonJson) {
        try {
          reason = record(JSON.parse(reasonJson));
        } catch {
          return {
            decision: 'review',
            requestId: requestId(response.RequestId),
            reason: '审核服务返回的风险信息格式异常',
          };
        }
      }
      // 通用文本服务以空 Labels 表示未命中，命中后的等级位于 Reason JSON。
      const decision =
        labels === '' && !reasonJson ? 'pass' : riskDecision(reason.riskLevel);
      return {
        decision,
        requestId: requestId(response.RequestId),
        ...(decision === 'review' ? { reason: '文本内容需要人工审核' } : {}),
      };
    }
    const openid = await this.wechatOpenId(input.userId);
    if (!openid) return this.missingWechatIdentity();
    const response = await this.wechatRequest('msg_sec_check', {
      content: input.text,
      version: 2,
      scene: input.scene,
      openid,
    });
    if (response.errcode !== 0) return this.wechatEligibilityReview(response);
    const suggest = record(response.result).suggest;
    const decision =
      suggest === 'pass' ? 'pass' : suggest === 'risky' ? 'block' : 'review';
    return {
      decision,
      requestId: requestId(response.trace_id),
      ...(decision === 'review' ? { reason: '文本内容需要人工审核' } : {}),
    };
  }

  async checkImage(
    provider: ModerationProvider,
    input: Input & { url: string },
  ): Promise<ModerationImageDecision> {
    this.assertConfigured(provider);
    if (provider === 'aliyun') {
      const response = await this.aliyunRequest('ImageModeration', {
        Service:
          this.setting('MODERATION_ALIYUN_IMAGE_SERVICE') || 'baselineCheck',
        ServiceParameters: JSON.stringify({ imageUrl: input.url }),
      });
      const decision = riskDecision(record(response.Data).RiskLevel);
      return {
        decision,
        requestId: requestId(response.RequestId),
        ...(decision === 'review' ? { reason: '图片内容需要人工审核' } : {}),
      };
    }
    const openid = await this.wechatOpenId(input.userId);
    if (!openid) return this.missingWechatIdentity();
    const response = await this.wechatRequest('media_check_async', {
      media_url: input.url,
      media_type: 2,
      version: 2,
      scene: input.scene,
      openid,
    });
    if (response.errcode !== 0) return this.wechatEligibilityReview(response);
    const traceId = requestId(response.trace_id);
    return traceId
      ? { decision: 'pending', requestId: traceId }
      : { decision: 'review', reason: '审核服务未返回图片任务编号' };
  }

  private setting(key: string): string {
    return this.config.get<string>(key)?.trim() || '';
  }

  private aliyunRegion() {
    return this.setting('MODERATION_ALIYUN_REGION') || 'cn-shanghai';
  }

  private assertConfigured(provider: ModerationProvider) {
    if (!this.readiness()[provider].configured) {
      throw new ModerationProviderError(provider, 'NOT_CONFIGURED');
    }
  }

  private async aliyunRequest(
    action: 'TextModeration' | 'ImageModeration',
    params: Record<string, string>,
  ): Promise<ApiResponse> {
    try {
      this.aliyunClient ??= new RPCClient({
        accessKeyId: this.setting('MODERATION_ALIYUN_ACCESS_KEY_ID'),
        accessKeySecret: this.setting('MODERATION_ALIYUN_ACCESS_KEY_SECRET'),
        endpoint: `https://green-cip.${this.aliyunRegion()}.aliyuncs.com`,
        apiVersion: '2022-03-02',
      });
      const response = record(
        await this.aliyunClient.request(action, params, {
          method: 'POST',
          timeout: 10000,
        }),
      );
      if (response.Code !== 200) {
        throw new ModerationProviderError('aliyun', 'API_ERROR');
      }
      return response;
    } catch {
      throw new ModerationProviderError('aliyun', 'REQUEST_FAILED');
    }
  }

  private async wechatOpenId(userId: string): Promise<string | undefined> {
    const identity = await this.prisma.userIdentity.findFirst({
      where: {
        userId,
        provider: 'WECHAT_OPENID',
        issuer: this.setting('WECHAT_APPID'),
      },
      select: { subject: true },
      orderBy: { verifiedAt: 'desc' },
    });
    return identity?.subject || undefined;
  }

  private missingWechatIdentity(): ModerationDecision {
    return { decision: 'review', reason: '当前账号缺少此小程序的微信身份' };
  }

  private wechatEligibilityReview(response: ApiResponse): ModerationDecision {
    if (typeof response.errcode !== 'number') {
      return { decision: 'review', reason: '审核服务返回的结果格式异常' };
    }
    if (
      response.errcode === 40003 ||
      response.errcode === 43104 ||
      response.errcode === 61010
    ) {
      return {
        decision: 'review',
        requestId: requestId(response.trace_id),
        reason: '微信身份或近期小程序访问记录未满足审核要求',
      };
    }
    throw new ModerationProviderError('wechat', 'API_ERROR');
  }

  private async wechatRequest(
    action: 'msg_sec_check' | 'media_check_async',
    body: ApiResponse,
  ): Promise<ApiResponse> {
    let token = await this.accessToken();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.wechatPost(
        `https://api.weixin.qq.com/wxa/${action}`,
        body,
        token,
      );
      if (
        response.errcode !== 40001 &&
        response.errcode !== 40014 &&
        response.errcode !== 42001
      ) {
        return response;
      }
      if (attempt === 0) {
        if (this.wechatToken?.value === token) this.wechatToken = undefined;
        token = await this.accessToken();
      }
    }
    throw new ModerationProviderError('wechat', 'TOKEN_REJECTED');
  }

  private async wechatPost(
    url: string,
    body: ApiResponse,
    token?: string,
  ): Promise<ApiResponse> {
    try {
      const { data } = await axios.post<unknown>(url, body, {
        timeout: 10000,
        maxRedirects: 0,
        ...(token ? { params: { access_token: token } } : {}),
      });
      return record(data);
    } catch {
      throw new ModerationProviderError('wechat', 'REQUEST_FAILED');
    }
  }

  private async accessToken(): Promise<string> {
    if (this.wechatToken && this.wechatToken.expiresAt > Date.now()) {
      return this.wechatToken.value;
    }
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = this.fetchAccessToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const data = await this.wechatPost(
      'https://api.weixin.qq.com/cgi-bin/stable_token',
      {
        grant_type: 'client_credential',
        appid: this.setting('WECHAT_APPID'),
        secret: this.setting('WECHAT_SECRET'),
        // 普通模式复用平台令牌，多个实例获取时保留其他实例的有效令牌。
        force_refresh: false,
      },
    );
    if (
      (data.errcode !== undefined && data.errcode !== 0) ||
      typeof data.access_token !== 'string' ||
      !data.access_token ||
      typeof data.expires_in !== 'number' ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    ) {
      throw new ModerationProviderError('wechat', 'TOKEN_RESPONSE_INVALID');
    }
    this.wechatToken = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
    };
    return data.access_token;
  }
}
