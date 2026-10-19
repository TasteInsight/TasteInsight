import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createHash } from 'node:crypto';
import { WechatModerationCallbackService } from './wechat-callback.service';

const token = 'fixture-callback-token';
const key = Buffer.alloc(32, 7);
const aesKey = key.toString('base64').replace(/=$/, '');
const appid = 'wxfixtureappid';
const timestamp = '1792368000';
const nonce = 'callback-fixture-nonce';
const signature = (...values: string[]) =>
  createHash('sha1').update(values.sort().join('')).digest('hex');

// Fixtures use Node crypto independently of the production protocol library.
function encrypt(message: string, receiver = appid): string {
  const bytes = Buffer.from(message);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  const payload = Buffer.concat([
    Buffer.alloc(16, 1),
    length,
    bytes,
    Buffer.from(receiver),
  ]);
  const pad = 32 - (payload.length % 32);
  const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.alloc(pad, pad)])),
    cipher.final(),
  ]).toString('base64');
}
function event(overrides: Record<string, unknown> = {}) {
  return {
    MsgType: 'event',
    Event: 'wxa_media_check',
    appid,
    trace_id: 'trace-fixture-1',
    version: 2,
    errcode: 0,
    result: { suggest: 'pass', label: 100 },
    ...overrides,
  };
}
function request(payload: unknown = event(), receiver = appid) {
  const encrypted = encrypt(
    typeof payload === 'string' ? payload : JSON.stringify(payload),
    receiver,
  );
  return {
    query: {
      timestamp,
      nonce,
      msg_signature: signature(token, timestamp, nonce, encrypted),
      encrypt_type: 'aes',
    },
    body: { Encrypt: encrypted },
  };
}

describe('WechatModerationCallbackService', () => {
  let service: WechatModerationCallbackService;
  beforeEach(() => {
    service = new WechatModerationCallbackService(
      new ConfigService({
        MODERATION_WECHAT_TOKEN: token,
        MODERATION_WECHAT_AES_KEY: aesKey,
        WECHAT_APPID: appid,
      }),
    );
  });
  it('verifies and decrypts encrypted GET echo', () => {
    const echo = encrypt('echo-validation-value');
    expect(
      service.verifyEcho({
        timestamp,
        nonce,
        echostr: echo,
        msg_signature: signature(token, timestamp, nonce, echo),
        encrypt_type: 'aes',
      }),
    ).toBe('echo-validation-value');
  });
  it('supports standard GET signature handshake while rejecting plain POST events', () => {
    expect(
      service.verifyEcho({
        timestamp,
        nonce,
        echostr: 'plain-echo',
        signature: signature(token, timestamp, nonce),
      }),
    ).toBe('plain-echo');
    expect(() =>
      service.decode(
        { timestamp, nonce, signature: signature(token, timestamp, nonce) },
        event(),
      ),
    ).toThrow(BadRequestException);
  });
  it.each([
    ['pass', 'pass'],
    ['review', 'review'],
    ['risky', 'block'],
  ] as const)('maps authenticated %s to %s', (suggest, decision) => {
    const { query, body } = request(event({ result: { suggest } }));
    expect(service.decode(query, body)).toEqual({
      traceId: 'trace-fixture-1',
      decision,
    });
  });
  it('uses authenticated contents instead of clear outer fields', () => {
    const { query, body } = request(event({ result: { suggest: 'risky' } }));
    expect(service.decode(query, { ...body, ...event() })).toEqual({
      traceId: 'trace-fixture-1',
      decision: 'block',
    });
  });
  it('parses XML envelopes and XML event field casing', () => {
    const xml = `<xml><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[wxa_media_check]]></Event><appid>${appid}</appid><trace_id><![CDATA[trace-xml]]></trace_id><version>2</version><errcode>0</errcode><result><suggest><![CDATA[pass]]></suggest></result></xml>`;
    const { query, body } = request(xml);
    expect(
      service.decode(
        query,
        `<xml><Encrypt><![CDATA[${body.Encrypt}]]></Encrypt></xml>`,
      ),
    ).toEqual({ traceId: 'trace-xml', decision: 'pass' });
  });
  it.each(['0'.repeat(40), 'bad-signature', 'a'.repeat(39)])(
    'rejects invalid signature %s',
    (value) => {
      const { query, body } = request();
      expect(() =>
        service.decode({ ...query, msg_signature: value }, body),
      ).toThrow(UnauthorizedException);
    },
  );
  it('rejects another encrypted receiver and another event appid', () => {
    const receiver = request(event(), 'wxotherappid');
    expect(() => service.decode(receiver.query, receiver.body)).toThrow(
      UnauthorizedException,
    );
    const inner = request(event({ appid: 'wxotherappid' }));
    expect(() => service.decode(inner.query, inner.body)).toThrow(
      UnauthorizedException,
    );
  });
  it('rejects signed malformed ciphertext and malformed documents', () => {
    const encrypted = 'malformed-ciphertext';
    expect(() =>
      service.decode(
        {
          timestamp,
          nonce,
          msg_signature: signature(token, timestamp, nonce, encrypted),
        },
        { Encrypt: encrypted },
      ),
    ).toThrow(UnauthorizedException);
    for (const payload of ['not-json-or-xml', '<xml><Event></xml>', '[]']) {
      const { query, body } = request(payload);
      expect(() => service.decode(query, body)).toThrow(BadRequestException);
    }
  });
  it.each([
    { Event: 'other_event' },
    { MsgType: 'text' },
    { Event: 'WXA_MEDIA_CHECK' },
  ])('acknowledges authenticated unrelated events %j', (overrides) => {
    const { query, body } = request(event(overrides));
    expect(service.decode(query, body)).toBeNull();
  });
  it('routes provider errors to manual review even with a stale pass result', () => {
    const { query, body } = request(event({ errcode: -1008 }));
    expect(service.decode(query, body)).toEqual({
      traceId: 'trace-fixture-1',
      decision: 'review',
    });
  });
  it.each([
    { trace_id: '' },
    { result: {} },
    { result: { suggest: 'unknown' } },
    { errcode: undefined },
    { version: 1 },
  ])('rejects invalid event fields %j', (overrides) => {
    const { query, body } = request(event(overrides));
    expect(() => service.decode(query, body)).toThrow(BadRequestException);
  });
  it('rejects malformed query values and hides crypto configuration details', () => {
    const { query, body } = request();
    expect(() => service.decode({ ...query, timestamp: 'bad' }, body)).toThrow(
      BadRequestException,
    );
    service = new WechatModerationCallbackService(
      new ConfigService({
        MODERATION_WECHAT_TOKEN: token,
        MODERATION_WECHAT_AES_KEY: 'invalid-key',
        WECHAT_APPID: appid,
      }),
    );
    expect(() => service.decode(query, body)).toThrow(
      ServiceUnavailableException,
    );
    expect(() => service.decode(query, body)).toThrow('微信审核回调暂不可用');
  });
});
