import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import WechatCrypto from 'wechat-crypto';

interface CallbackCrypto {
  getSignature(timestamp: string, nonce: string, encrypted: string): string;
  decrypt(encrypted: string): { message: string; id: string };
}

type MediaResult = {
  traceId: string;
  decision: 'pass' | 'review' | 'block';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

@Injectable()
export class WechatModerationCallbackService {
  private readonly xml = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    processEntities: false,
  });

  constructor(private readonly config: ConfigService) {}

  verifyEcho(query: Record<string, string>): string {
    const echo = this.required(query.echostr);
    this.validateQuery(query);
    if (query.msg_signature || query.encrypt_type === 'aes') {
      return this.decrypt(query, echo);
    }
    const token = this.setting('MODERATION_WECHAT_TOKEN');
    const signature = createHash('sha1')
      .update([token, query.timestamp, query.nonce].sort().join(''))
      .digest('hex');
    this.verifySignature(query.signature, signature);
    return echo;
  }

  decode(query: Record<string, string>, body: unknown): MediaResult | null {
    this.validateQuery(query);
    const envelope = this.parse(body);
    const encrypted = this.required(envelope.Encrypt);
    const message = this.parse(this.decrypt(query, encrypted));
    if (message.MsgType !== 'event' || message.Event !== 'wxa_media_check') {
      return null;
    }
    if (message.appid !== this.setting('WECHAT_APPID')) {
      throw new UnauthorizedException('微信回调验证失败');
    }
    const traceId = this.required(message.trace_id);
    if (message.version !== 2 && message.version !== '2') {
      throw new BadRequestException('微信审核回调格式无效');
    }
    if (message.errcode !== 0 && message.errcode !== '0') {
      if (
        typeof message.errcode !== 'number' &&
        typeof message.errcode !== 'string'
      ) {
        throw new BadRequestException('微信审核回调格式无效');
      }
      return { traceId, decision: 'review' };
    }
    if (!isRecord(message.result)) {
      throw new BadRequestException('微信审核回调格式无效');
    }
    const suggest = message.result.suggest;
    if (suggest === 'pass' || suggest === 'review') {
      return { traceId, decision: suggest };
    }
    if (suggest === 'risky') return { traceId, decision: 'block' };
    throw new BadRequestException('微信审核回调格式无效');
  }

  private decrypt(query: Record<string, string>, encrypted: string): string {
    const token = this.setting('MODERATION_WECHAT_TOKEN');
    const key = this.setting('MODERATION_WECHAT_AES_KEY');
    const appid = this.setting('WECHAT_APPID');
    let crypto: CallbackCrypto;
    try {
      crypto = new WechatCrypto(token, key, appid) as CallbackCrypto;
    } catch {
      throw new ServiceUnavailableException('微信审核回调暂不可用');
    }
    this.verifySignature(
      query.msg_signature,
      crypto.getSignature(query.timestamp, query.nonce, encrypted),
    );
    try {
      const decoded = crypto.decrypt(encrypted);
      if (decoded.id !== appid) throw new Error();
      return decoded.message;
    } catch {
      throw new UnauthorizedException('微信回调验证失败');
    }
  }

  private verifySignature(received: unknown, expected: string): void {
    if (
      typeof received !== 'string' ||
      !/^[a-f0-9]{40}$/i.test(received) ||
      !timingSafeEqual(
        Buffer.from(received, 'hex'),
        Buffer.from(expected, 'hex'),
      )
    ) {
      throw new UnauthorizedException('微信回调验证失败');
    }
  }

  private validateQuery(query: Record<string, string>): void {
    if (
      typeof query.timestamp !== 'string' ||
      !/^\d+$/.test(query.timestamp) ||
      typeof query.nonce !== 'string' ||
      !query.nonce
    ) {
      throw new BadRequestException('微信回调参数无效');
    }
  }

  private setting(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new ServiceUnavailableException('微信审核回调暂不可用');
    return value;
  }

  private required(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('微信审核回调格式无效');
    }
    return value;
  }

  private parse(value: unknown): Record<string, unknown> {
    if (isRecord(value)) return value;
    if (typeof value !== 'string') {
      throw new BadRequestException('微信审核回调格式无效');
    }
    try {
      const text = value.trim();
      let parsed: unknown;
      if (text.startsWith('{')) {
        parsed = JSON.parse(text);
      } else {
        if (XMLValidator.validate(text) !== true) throw new Error();
        const document: unknown = this.xml.parse(text);
        parsed = isRecord(document) ? document.xml : null;
      }
      if (!isRecord(parsed)) throw new Error();
      return parsed;
    } catch {
      throw new BadRequestException('微信审核回调格式无效');
    }
  }
}
