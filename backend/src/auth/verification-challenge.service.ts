import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '@/prisma.service';
import { VerificationDeliveryService } from './verification-delivery.service';
import {
  assertChallengeEnabled,
  type ChallengePurpose,
} from './verification-purpose';

@Injectable()
export class VerificationChallengeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly delivery: VerificationDeliveryService,
  ) {}

  digest(value: string): string {
    const secret = this.config.get<string>('AUTH_CHALLENGE_SECRET');
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new ServiceUnavailableException('身份验证服务尚未配置');
    }
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  async issue(
    purpose: ChallengePurpose,
    target: string,
    ip: string,
    userId?: string,
  ) {
    assertChallengeEnabled(purpose, (key) => this.config.get(key));
    this.delivery.assertAvailable(purpose);
    const id = randomUUID();
    const code = randomInt(1000000).toString().padStart(6, '0');
    const ipDigest = this.digest(`ip:${ip}`);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 300000);
    const codeDigest = this.digest(`code:${id}:${code}`);
    await this.prisma.$transaction(async (tx) => {
      // Serialize the two rate-limit scopes across backend instances.
      const locks = [
        `otp:ip:${ipDigest}`,
        `otp:target:${this.digest(target)}`,
      ].sort();
      for (const lock of locks)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
      const sinceHour = new Date(now.getTime() - 3600000);
      const [recent, targetCount, ipCount] = await Promise.all([
        tx.verificationChallenge.findFirst({
          where: { target, createdAt: { gt: new Date(now.getTime() - 60000) } },
        }),
        tx.verificationChallenge.count({
          where: { target, createdAt: { gt: sinceHour } },
        }),
        tx.verificationChallenge.count({
          where: { ipDigest, createdAt: { gt: sinceHour } },
        }),
      ]);
      if (recent || targetCount >= 5 || ipCount >= 20) {
        throw new HttpException(
          {
            code: 'VERIFICATION_RATE_LIMITED',
            message: '验证码请求过于频繁，请稍后重试',
          },
          429,
        );
      }
      await tx.verificationChallenge.create({
        data: {
          id,
          purpose,
          target,
          codeDigest,
          ipDigest,
          expiresAt,
          userId: userId ?? null,
        },
      });
    });
    try {
      await this.delivery.send(purpose, target, code, id);
    } catch (error) {
      await this.prisma.verificationChallenge.update({
        where: { id },
        data: { deliveryState: 'FAILED' },
      });
      throw error;
    }
    await this.prisma.verificationChallenge.update({
      where: { id },
      data: { deliveryState: 'SENT' },
    });
    return { challengeId: id, expiresIn: 300, retryAfter: 60 };
  }

  async consume(
    purpose: ChallengePurpose,
    id: string,
    code: string,
    userId?: string,
  ): Promise<string> {
    assertChallengeEnabled(purpose, (key) => this.config.get(key));
    const digest = this.digest(`code:${id}:${code}`);
    const result = await this.prisma.$transaction(async (tx) => {
      const reserved = await tx.verificationChallenge.updateMany({
        where: {
          id,
          purpose,
          userId: userId ?? null,
          consumedAt: null,
          deliveryState: 'SENT',
          expiresAt: { gt: new Date() },
          attempts: { lt: 5 },
        },
        data: { attempts: { increment: 1 } },
      });
      if (reserved.count !== 1) return null;
      const challenge = await tx.verificationChallenge.findUniqueOrThrow({
        where: { id },
      });
      const expected = Buffer.from(challenge.codeDigest, 'hex');
      const actual = Buffer.from(digest, 'hex');
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      )
        return null;
      await tx.verificationChallenge.update({
        where: { id },
        data: { consumedAt: new Date() },
      });
      return challenge.target;
    });
    // Wrong attempts must commit before the HTTP error is raised.
    if (result === null)
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_CODE',
        message: '验证码无效或已过期',
      });
    return result;
  }
}
