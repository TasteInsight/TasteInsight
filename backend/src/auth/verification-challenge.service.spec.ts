import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { VerificationChallengeService } from './verification-challenge.service';
import { VerificationDeliveryService } from './verification-delivery.service';

describe('VerificationChallengeService', () => {
  const records = new Map<string, any>();
  const challenges = {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };
  const tx = { verificationChallenge: challenges, $executeRaw: jest.fn() };
  const prisma = { ...tx, $transaction: jest.fn() };
  const delivery = { assertAvailable: jest.fn(), send: jest.fn() };
  const service = new VerificationChallengeService(
    prisma as unknown as PrismaService,
    new ConfigService({ AUTH_CHALLENGE_SECRET: 'challenge-secret'.repeat(4) }),
    delivery as unknown as VerificationDeliveryService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    records.clear();
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    challenges.findFirst.mockResolvedValue(null);
    challenges.count.mockResolvedValue(0);
    challenges.create.mockImplementation(({ data }) => {
      records.set(data.id, {
        ...data,
        attempts: 0,
        deliveryState: 'PENDING',
        consumedAt: null,
      });
      return Promise.resolve(data);
    });
    challenges.update.mockImplementation(({ where, data }) => {
      Object.assign(records.get(where.id), data);
      return Promise.resolve(records.get(where.id));
    });
    challenges.findUniqueOrThrow.mockImplementation(({ where }) =>
      Promise.resolve(records.get(where.id)),
    );
    challenges.updateMany.mockImplementation(({ where, data }) => {
      const item = records.get(where.id);
      if (
        !item ||
        item.purpose !== where.purpose ||
        item.userId !== where.userId ||
        item.consumedAt ||
        item.deliveryState !== 'SENT' ||
        item.expiresAt <= where.expiresAt.gt ||
        item.attempts >= where.attempts.lt
      )
        return Promise.resolve({ count: 0 });
      item.attempts += data.attempts.increment;
      return Promise.resolve({ count: 1 });
    });
  });

  it('sends a six-digit code but only returns challenge metadata and stores a keyed digest', async () => {
    const result = await service.issue(
      'PHONE_LOGIN',
      '+8613812345678',
      '127.0.0.1',
    );
    const [, , code] = delivery.send.mock.calls[0];
    expect(code).toMatch(/^\d{6}$/);
    expect(result).toEqual({
      challengeId: expect.any(String),
      expiresIn: 300,
      retryAfter: 60,
    });
    expect(records.get(result.challengeId)).toMatchObject({
      deliveryState: 'SENT',
      codeDigest: service.digest(`code:${result.challengeId}:${code}`),
    });
    expect(JSON.stringify(result)).not.toContain(code);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it('atomically consumes a valid challenge once', async () => {
    const { challengeId } = await service.issue(
      'PHONE_LOGIN',
      '+8613812345678',
      '127.0.0.1',
    );
    const code = delivery.send.mock.calls[0][2];
    await expect(
      service.consume('PHONE_LOGIN', challengeId, code),
    ).resolves.toBe('+8613812345678');
    await expect(
      service.consume('PHONE_LOGIN', challengeId, code),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(records.get(challengeId).consumedAt).toBeInstanceOf(Date);
  });
  it('commits wrong-attempt increments and rejects a correct sixth attempt', async () => {
    const { challengeId } = await service.issue(
      'PHONE_LOGIN',
      '+8613812345678',
      '127.0.0.1',
    );
    const code = delivery.send.mock.calls[0][2];
    const wrong = code === '000000' ? '111111' : '000000';
    for (let attempt = 0; attempt < 5; attempt++)
      await expect(
        service.consume('PHONE_LOGIN', challengeId, wrong),
      ).rejects.toBeInstanceOf(BadRequestException);
    expect(records.get(challengeId).attempts).toBe(5);
    await expect(
      service.consume('PHONE_LOGIN', challengeId, code),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('binds challenges to their purpose and initiating user', async () => {
    const { challengeId } = await service.issue(
      'PHONE_BIND',
      '+8613812345678',
      '127.0.0.1',
      'alice',
    );
    const code = delivery.send.mock.calls[0][2];
    await expect(
      service.consume('PHONE_LOGIN', challengeId, code),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.consume('PHONE_BIND', challengeId, code, 'bob'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.consume('PHONE_BIND', challengeId, code, 'alice'),
    ).resolves.toBe('+8613812345678');
  });
  it('does not accept expired challenges', async () => {
    const { challengeId } = await service.issue(
      'PHONE_LOGIN',
      '+8613812345678',
      '127.0.0.1',
    );
    records.get(challengeId).expiresAt = new Date(0);
    await expect(
      service.consume(
        'PHONE_LOGIN',
        challengeId,
        delivery.send.mock.calls[0][2],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each(['recent', 'target', 'ip'])(
    'enforces the %s sending limit before delivery',
    async (scope) => {
      if (scope === 'recent')
        challenges.findFirst.mockResolvedValue({ id: 'previous' });
      if (scope === 'target')
        challenges.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
      if (scope === 'ip')
        challenges.count.mockResolvedValueOnce(0).mockResolvedValueOnce(20);
      await expect(
        service.issue('PHONE_LOGIN', '+8613812345678', '127.0.0.1'),
      ).rejects.toBeInstanceOf(HttpException);
      expect(delivery.send).not.toHaveBeenCalled();
      expect(challenges.create).not.toHaveBeenCalled();
    },
  );
  it('records delivery failures and never accepts their code', async () => {
    delivery.send.mockRejectedValue(new ServiceUnavailableException());
    await expect(
      service.issue('PHONE_LOGIN', '+8613812345678', '127.0.0.1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    const [id, item] = [...records.entries()][0];
    expect(item.deliveryState).toBe('FAILED');
    await expect(
      service.consume('PHONE_LOGIN', id, delivery.send.mock.calls[0][2]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
