import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { isCurrentStudent } from '@/auth/student-status';
import { VerificationChallengeService } from '@/auth/verification-challenge.service';
import { StudentDecisionDto } from './dto/student-verification.dto';

@Injectable()
export class CampusIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly challenges: VerificationChallengeService,
  ) {}

  async status(userId: string) {
    const verification = await this.prisma.studentVerification.findUnique({
      where: { userId },
    });
    if (!verification) return { status: 'UNVERIFIED', canContribute: false };
    const canContribute = isCurrentStudent(verification);
    const [local, domain] = verification.email?.split('@') ?? [];
    return {
      status:
        verification.status === 'VERIFIED' && !canContribute
          ? 'EXPIRED'
          : verification.status,
      method: verification.method,
      expiresAt: verification.expiresAt?.toISOString() ?? null,
      ...(verification.email ? { email: `${local[0]}***@${domain}` } : {}),
      canContribute,
      reason: verification.reason,
      updatedAt: verification.updatedAt.toISOString(),
    };
  }

  async emailChallenge(userId: string, input: string, ip: string) {
    const domains = this.config
      .get<string>('CAMPUS_EMAIL_DOMAINS', '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
    if (!domains.length)
      throw new ServiceUnavailableException('校园邮箱认证尚未配置');
    const email = input.trim().toLowerCase();
    if (!domains.includes(email.split('@')[1]))
      throw new BadRequestException('请使用支持的校园邮箱');
    return this.challenges.issue('SCHOOL_EMAIL', email, ip, userId);
  }

  async submitEmail(userId: string, challengeId: string, code: string) {
    const email = await this.challenges.consume(
      'SCHOOL_EMAIL',
      challengeId,
      code,
      userId,
    );
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`campus:${userId}`}, 0))`;
        const previous = await tx.studentVerification.findUnique({
          where: { userId },
        });
        if (isCurrentStudent(previous))
          throw new ConflictException('当前学生认证仍在有效期内');
        const data = {
          schoolCode: 'tsinghua',
          status: 'PENDING',
          method: 'MANUAL_REVIEW',
          email,
          emailVerifiedAt: new Date(),
          studentSubjectDigest: previous?.studentSubjectDigest ?? null,
          verifiedAt: null,
          expiresAt: null,
          reviewedById: null,
          reviewedAt: null,
          reason: null,
        };
        await tx.studentVerification.upsert({
          where: { userId },
          create: { ...data, userId },
          update: data,
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException(
          '该校园身份已用于其他账号，请联系管理员处理',
        );
      throw error;
    }
    return this.status(userId);
  }

  async list(page = 1, pageSize = 20, status = 'PENDING') {
    const where = { status };
    const [items, total] = await Promise.all([
      this.prisma.studentVerification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          userId: true,
          schoolCode: true,
          status: true,
          method: true,
          email: true,
          emailVerifiedAt: true,
          verifiedAt: true,
          expiresAt: true,
          reason: true,
          reviewedAt: true,
          updatedAt: true,
          user: { select: { nickname: true } },
        },
      }),
      this.prisma.studentVerification.count({ where }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async decide(userId: string, adminId: string, dto: StudentDecisionDto) {
    const now = new Date();
    const expiry = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (
      dto.decision === 'APPROVE' &&
      (!expiry ||
        expiry <= now ||
        expiry.getTime() > now.getTime() + 366 * 86400000)
    ) {
      throw new BadRequestException('审核通过须设置一年内的未来有效期');
    }
    if (!dto.reason.trim()) throw new BadRequestException('请填写审核依据');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`campus:${userId}`}, 0))`;
      const verification = await tx.studentVerification.findUnique({
        where: { userId },
      });
      if (!verification) throw new NotFoundException('认证申请不存在');
      if (
        verification.updatedAt.getTime() !==
        new Date(dto.expectedUpdatedAt).getTime()
      ) {
        throw new ConflictException('申请已更新，请刷新后审核');
      }
      if (dto.decision !== 'REVOKE' && verification.status !== 'PENDING') {
        throw new ConflictException('仅待审核申请可以通过或拒绝');
      }
      await tx.studentVerification.update({
        where: { userId },
        data: {
          status:
            dto.decision === 'APPROVE'
              ? 'VERIFIED'
              : dto.decision === 'REJECT'
                ? 'REJECTED'
                : 'REVOKED',
          verifiedAt: dto.decision === 'APPROVE' ? now : null,
          expiresAt: dto.decision === 'APPROVE' ? expiry : null,
          reviewedById: adminId,
          reviewedAt: now,
          reason: dto.reason.trim(),
        },
      });
      await tx.operationLog.create({
        data: {
          adminId,
          action: `student:${dto.decision.toLowerCase()}`,
          targetType: 'student-verification',
          targetId: verification.id,
          result: 'success',
          details: {
            userId,
            decision: dto.decision,
            reason: dto.reason.trim(),
            expiresAt:
              dto.decision === 'APPROVE' ? expiry?.toISOString() : null,
          },
        },
      });
    });
    return this.status(userId);
  }
}
