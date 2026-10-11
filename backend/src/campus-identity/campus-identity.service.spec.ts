import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { VerificationChallengeService } from '@/auth/verification-challenge.service';
import { CampusIdentityService } from './campus-identity.service';

describe('CampusIdentityService', () => {
  const tx = {
    $executeRaw: jest.fn(),
    studentVerification: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    operationLog: { create: jest.fn() },
  };
  const prisma = { ...tx, $transaction: jest.fn() };
  const challenges = { issue: jest.fn(), consume: jest.fn() };
  const config = new ConfigService({
    CAMPUS_EMAIL_DOMAINS: 'mails.tsinghua.edu.cn,tsinghua.edu.cn',
  });
  const service = new CampusIdentityService(
    prisma as unknown as PrismaService,
    config,
    challenges as unknown as VerificationChallengeService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.studentVerification.findUnique.mockResolvedValue(null);
    challenges.consume.mockResolvedValue('student@mails.tsinghua.edu.cn');
  });
  it('returns UNVERIFIED without a record', async () => {
    expect(await service.status('alice')).toEqual({
      status: 'UNVERIFIED',
      canContribute: false,
    });
  });
  it('returns expiry immediately and never exposes the full email or student identifier', async () => {
    tx.studentVerification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
      method: 'MANUAL_REVIEW',
      expiresAt: new Date(0),
      email: 'alice@mails.tsinghua.edu.cn',
      studentSubjectDigest: 'private-subject',
      updatedAt: new Date(),
      reason: null,
    });
    const result = await service.status('alice');
    expect(result).toMatchObject({
      status: 'EXPIRED',
      canContribute: false,
      email: 'a***@mails.tsinghua.edu.cn',
    });
    expect(result).not.toHaveProperty('studentSubjectDigest');
  });
  it('accepts only exact configured email domains and binds the challenge to the user', async () => {
    await service.emailChallenge(
      'alice',
      'Alice@MAILS.TSINGHUA.EDU.CN',
      '127.0.0.1',
    );
    expect(challenges.issue).toHaveBeenCalledWith(
      'SCHOOL_EMAIL',
      'alice@mails.tsinghua.edu.cn',
      '127.0.0.1',
      'alice',
    );
    await expect(
      service.emailChallenge(
        'alice',
        'alice@mails.tsinghua.edu.cn.attacker.org',
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('records email ownership only as a pending application', async () => {
    await service.submitEmail('alice', 'challenge', '123456');
    expect(challenges.consume).toHaveBeenCalledWith(
      'SCHOOL_EMAIL',
      'challenge',
      '123456',
      'alice',
    );
    expect(tx.studentVerification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'alice',
          status: 'PENDING',
          method: 'MANUAL_REVIEW',
          emailVerifiedAt: expect.any(Date),
          verifiedAt: null,
          expiresAt: null,
        }),
      }),
    );
  });
  it('does not overwrite an active verification with a new email application', async () => {
    tx.studentVerification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
      expiresAt: new Date(Date.now() + 60000),
    });
    await expect(
      service.submitEmail('alice', 'challenge', '123456'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('translates duplicate campus credentials to a binding conflict', async () => {
    tx.studentVerification.upsert.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.submitEmail('alice', 'challenge', '123456'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each([
    undefined,
    new Date(0).toISOString(),
    new Date(Date.now() + 400 * 86400000).toISOString(),
  ])('requires bounded future expiry for approval (%s)', async (expiresAt) => {
    await expect(
      service.decide('alice', 'admin', {
        decision: 'APPROVE',
        reason: '当前学期在读材料',
        expiresAt,
        expectedUpdatedAt: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.studentVerification.update).not.toHaveBeenCalled();
  });
  it('rejects approval of a stale application snapshot', async () => {
    tx.studentVerification.findUnique.mockResolvedValue({
      id: 'verification',
      status: 'PENDING',
      updatedAt: new Date(),
    });
    await expect(
      service.decide('alice', 'admin', {
        decision: 'APPROVE',
        reason: '核验通过',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        expectedUpdatedAt: new Date(0).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('commits a trusted administrator decision with its audit record', async () => {
    const now = new Date();
    tx.studentVerification.findUnique.mockResolvedValueOnce({
      id: 'verification',
      status: 'PENDING',
      updatedAt: now,
    });
    await service.decide('alice', 'admin', {
      decision: 'APPROVE',
      reason: '本学期在读证明已核验',
      expiresAt: new Date(now.getTime() + 86400000).toISOString(),
      expectedUpdatedAt: now.toISOString(),
    });
    expect(tx.studentVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'VERIFIED',
          reviewedById: 'admin',
          verifiedAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.operationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminId: 'admin',
          action: 'student:approve',
          targetId: 'verification',
        }),
      }),
    );
  });
  it('revocation clears eligibility and retains its audit reason', async () => {
    const now = new Date();
    tx.studentVerification.findUnique.mockResolvedValueOnce({
      id: 'verification',
      status: 'VERIFIED',
      updatedAt: now,
    });
    await service.decide('alice', 'admin', {
      decision: 'REVOKE',
      reason: '已不符合当前在读资格',
      expectedUpdatedAt: now.toISOString(),
    });
    expect(tx.studentVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REVOKED',
          verifiedAt: null,
          expiresAt: null,
        }),
      }),
    );
  });
});
