import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import {
  challengeDefinition,
  type ChallengePurpose,
} from './verification-purpose';

@Injectable()
export class VerificationDeliveryService {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  assertAvailable(purpose: ChallengePurpose): void {
    const keys =
      challengeDefinition(purpose).channel === 'email'
        ? ['RESEND_API_KEY', 'EMAIL_FROM']
        : ['SMS_GATEWAY_URL', 'SMS_GATEWAY_TOKEN'];
    if (keys.some((key) => !this.config.get<string>(key)?.trim())) {
      throw new ServiceUnavailableException('验证码发送服务尚未配置');
    }
  }

  async send(
    purpose: ChallengePurpose,
    to: string,
    code: string,
    id: string,
  ): Promise<void> {
    this.assertAvailable(purpose);
    const definition = challengeDefinition(purpose);
    const email = definition.channel === 'email';
    const endpoint = email
      ? 'https://api.resend.com/emails'
      : this.config.get<string>('SMS_GATEWAY_URL')!;
    const token = this.config.get<string>(
      email ? 'RESEND_API_KEY' : 'SMS_GATEWAY_TOKEN',
    );
    const payload =
      definition.channel === 'email'
        ? {
            from: this.config.get<string>('EMAIL_FROM'),
            to: [to],
            subject: definition.subject,
            text: definition.text(code),
          }
        : { to, code, expiresIn: 300, purpose };
    try {
      const { data } = await firstValueFrom(
        this.http.post(endpoint, payload, {
          headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': id },
          timeout: 10000,
          maxRedirects: 0,
        }),
      );
      const deliveryId = email ? data?.id : data?.messageId;
      if (typeof deliveryId !== 'string' || !deliveryId)
        throw new Error('Missing delivery acknowledgement');
    } catch {
      throw new ServiceUnavailableException('验证码暂时无法发送，请稍后重试');
    }
  }
}
