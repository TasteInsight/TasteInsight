import { ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { VerificationDeliveryService } from './verification-delivery.service';

describe('VerificationDeliveryService', () => {
  const http = { post: jest.fn() };
  const config = new ConfigService({
    SMS_GATEWAY_URL: 'https://sms.example.org/send',
    SMS_GATEWAY_TOKEN: 'gateway-secret',
    RESEND_API_KEY: 'resend-secret',
    EMAIL_FROM: 'TasteInsight <verify@example.org>',
  });
  const service = new VerificationDeliveryService(
    config,
    http as unknown as HttpService,
  );
  beforeEach(() => jest.resetAllMocks());
  it('uses the documented HTTPS SMS gateway contract', async () => {
    http.post.mockReturnValue(of({ data: { messageId: 'accepted-id' } }));
    await service.send(
      'PHONE_LOGIN',
      '+8613812345678',
      '123456',
      'challenge-id',
    );
    expect(http.post).toHaveBeenCalledWith(
      'https://sms.example.org/send',
      {
        to: '+8613812345678',
        code: '123456',
        expiresIn: 300,
        purpose: 'PHONE_LOGIN',
      },
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer gateway-secret',
          'Idempotency-Key': 'challenge-id',
        },
        timeout: 10000,
        maxRedirects: 0,
      }),
    );
  });
  it('sends campus email through the real Resend API with its returned delivery ID', async () => {
    http.post.mockReturnValue(of({ data: { id: 'resend-delivery-id' } }));
    await service.send(
      'SCHOOL_EMAIL',
      'student@mails.tsinghua.edu.cn',
      '123456',
      'challenge-id',
    );
    expect(http.post).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        from: 'TasteInsight <verify@example.org>',
        to: ['student@mails.tsinghua.edu.cn'],
        text: expect.stringContaining('123456'),
      }),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer resend-secret',
          'Idempotency-Key': 'challenge-id',
        },
      }),
    );
  });
  it('does not treat an arbitrary 200 response as successful delivery', async () => {
    http.post.mockReturnValue(of({ data: { success: true } }));
    await expect(
      service.send('PHONE_LOGIN', '+8613812345678', '123456', 'id'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('sanitizes provider errors', async () => {
    http.post.mockReturnValue(throwError(() => new Error('resend-secret')));
    await expect(
      service.send('SCHOOL_EMAIL', 'student@example.org', '123456', 'id'),
    ).rejects.toThrow('验证码暂时无法发送');
  });
  it('does not simulate delivery when configuration is missing', async () => {
    const unavailable = new VerificationDeliveryService(
      new ConfigService(),
      http as unknown as HttpService,
    );
    await expect(
      unavailable.send('PHONE_LOGIN', '+8613812345678', '123456', 'id'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(http.post).not.toHaveBeenCalled();
  });
});
