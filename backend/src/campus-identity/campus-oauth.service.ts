import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import { identityCapabilities } from '@/auth/identity-configuration';
import { corsOrigins } from '@/environment';
import {
  CampusOAuthCallbackDto,
  CompleteCampusOAuthDto,
} from './dto/student-verification.dto';

type CampusProof = {
  studentSubjectDigest: string;
  active: boolean;
  capturedAt: string;
  expiresAt: string | null;
};

function claim(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        current !== null &&
        typeof current === 'object' &&
        Object.prototype.hasOwnProperty.call(current, key)
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}

@Injectable()
export class CampusOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  private setting(key: string): string {
    return this.config.get<string>(`CAMPUS_OAUTH_${key}`, '');
  }

  private assertConfigured() {
    if (!identityCapabilities((key) => this.config.get(key)).campusOAuth) {
      throw new ServiceUnavailableException('清华统一身份认证尚未开通');
    }
  }

  private async account(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        identities: {
          where: { provider: 'PHONE' },
          select: { subject: true },
          take: 1,
        },
      },
    });
    if (!user) throw new NotFoundException('账号不存在');
    const phone = user.identities[0]?.subject;
    return {
      id: user.id,
      nickname: user.nickname,
      ...(phone ? { phone: `${phone.slice(0, 3)}****${phone.slice(-4)}` } : {}),
    };
  }

  async start(userId: string, origin?: string) {
    this.assertConfigured();
    if (
      origin &&
      !corsOrigins({
        CORS_ALLOWED_ORIGINS: this.config.get('CORS_ALLOWED_ORIGINS'),
        APP_URL: this.config.get('APP_URL'),
      }).includes(origin)
    ) {
      throw new BadRequestException('请从食鉴应用发起认证');
    }
    const account = await this.account(userId);
    const attemptId = randomUUID();
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`campus-oauth:${userId}`}, 0))`;
      const count = await tx.campusOAuthAttempt.count({
        where: { userId, createdAt: { gt: new Date(now.getTime() - 900000) } },
      });
      if (count >= 5)
        throw new BadRequestException('认证请求过于频繁，请稍后重试');
      await tx.campusOAuthAttempt.create({
        data: {
          id: attemptId,
          userId,
          clientOrigin: origin ?? null,
          stateDigest: createHash('sha256').update(state).digest('hex'),
          codeVerifier,
          expiresAt: new Date(now.getTime() + 600000),
        },
      });
    });
    const authorization = new URL(this.setting('AUTHORIZATION_URL'));
    for (const [key, value] of Object.entries({
      response_type: 'code',
      client_id: this.setting('CLIENT_ID'),
      redirect_uri: this.setting('REDIRECT_URI'),
      scope: this.setting('SCOPE'),
      state,
      code_challenge: createHash('sha256')
        .update(codeVerifier)
        .digest('base64url'),
      code_challenge_method: 'S256',
    }))
      authorization.searchParams.set(key, value);
    return {
      attemptId,
      authorizationUrl: authorization.toString(),
      // Covers the authorization window, provider request timeouts and handoff TTL.
      expiresAt: new Date(now.getTime() + 900000).toISOString(),
      account,
    };
  }

  async callback(dto: CampusOAuthCallbackDto) {
    this.assertConfigured();
    const stateDigest = createHash('sha256').update(dto.state).digest('hex');
    const attempt = await this.prisma.$transaction(async (tx) => {
      const reserved = await tx.campusOAuthAttempt.updateMany({
        where: { stateDigest, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (reserved.count !== 1) return null;
      return tx.campusOAuthAttempt.findUnique({ where: { stateDigest } });
    });
    if (!attempt)
      throw new BadRequestException('认证请求无效或已过期，请重新发起');
    if (
      dto.error ||
      !dto.code ||
      (dto.iss && dto.iss !== this.setting('ISSUER'))
    ) {
      throw new BadRequestException('校方授权未完成，请返回应用重新发起');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: dto.code,
      redirect_uri: this.setting('REDIRECT_URI'),
      code_verifier: attempt.codeVerifier,
    });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (
      (this.setting('TOKEN_AUTH_METHOD') || 'client_secret_basic') ===
      'client_secret_basic'
    ) {
      headers.Authorization = `Basic ${Buffer.from(`${encodeURIComponent(this.setting('CLIENT_ID'))}:${encodeURIComponent(this.setting('CLIENT_SECRET'))}`).toString('base64')}`;
    } else {
      body.set('client_id', this.setting('CLIENT_ID'));
      body.set('client_secret', this.setting('CLIENT_SECRET'));
    }
    let userinfo: Record<string, unknown>;
    try {
      const token = await firstValueFrom(
        this.http.post(this.setting('TOKEN_URL'), body.toString(), {
          headers,
          timeout: 10000,
          maxRedirects: 0,
        }),
      );
      if (
        token.data?.error ||
        typeof token.data?.access_token !== 'string' ||
        !token.data.access_token ||
        (token.data.token_type &&
          String(token.data.token_type).toLowerCase() !== 'bearer')
      )
        throw new Error('Invalid token response');
      const response = await firstValueFrom(
        this.http.get(this.setting('USERINFO_URL'), {
          headers: { Authorization: `Bearer ${token.data.access_token}` },
          timeout: 10000,
          maxRedirects: 0,
        }),
      );
      userinfo = response.data;
      if (
        !userinfo ||
        typeof userinfo !== 'object' ||
        userinfo.error ||
        (userinfo.iss !== undefined && userinfo.iss !== this.setting('ISSUER'))
      )
        throw new Error('Invalid identity response');
    } catch {
      throw new ServiceUnavailableException('校方认证暂时无法完成，请重新发起');
    }
    const subject = claim(userinfo, this.setting('SUBJECT_CLAIM') || 'sub');
    if (
      (typeof subject !== 'string' && typeof subject !== 'number') ||
      !String(subject).trim()
    ) {
      throw new BadRequestException('校方未返回可验证的账号标识');
    }
    const studentClaim = this.setting('STUDENT_CLAIM');
    const allowed = this.setting('STUDENT_VALUES')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const affiliation = studentClaim
      ? claim(userinfo, studentClaim)
      : undefined;
    const active =
      allowed.length > 0 &&
      (Array.isArray(affiliation) ? affiliation : [affiliation]).some(
        (value) =>
          ['string', 'boolean', 'number'].includes(typeof value) &&
          allowed.includes(String(value)),
      );
    const now = new Date();
    const days = Number(this.config.get('CAMPUS_VERIFICATION_DAYS', 30));
    const studentSubjectDigest = createHash('sha256')
      .update(JSON.stringify([this.setting('ISSUER'), String(subject)]))
      .digest('hex');
    const handoffCode = randomBytes(32).toString('base64url');
    const handoffExpiresAt = new Date(now.getTime() + 180000);
    const proof: CampusProof = {
      studentSubjectDigest,
      active,
      capturedAt: now.toISOString(),
      expiresAt: active
        ? new Date(now.getTime() + days * 86400000).toISOString()
        : null,
    };
    await this.prisma.campusOAuthAttempt.update({
      where: { id: attempt.id },
      data: {
        proof,
        codeVerifier: '',
        handoffDigest: createHash('sha256').update(handoffCode).digest('hex'),
        handoffExpiresAt,
      },
    });
    return {
      attemptId: attempt.id,
      handoffCode,
      handoffExpiresAt: handoffExpiresAt.toISOString(),
      clientOrigin: attempt.clientOrigin,
      account: await this.account(attempt.userId),
    };
  }

  async complete(userId: string, dto: CompleteCampusOAuthDto) {
    const now = new Date();
    let status: 'VERIFIED' | 'PENDING';
    try {
      await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.campusOAuthAttempt.updateMany({
          where: {
            id: dto.attemptId,
            userId,
            handoffDigest: createHash('sha256')
              .update(dto.handoffCode)
              .digest('hex'),
            handoffExpiresAt: { gt: now },
            completedAt: null,
          },
          data: { completedAt: now },
        });
        if (consumed.count !== 1) {
          throw new BadRequestException('确认码无效或已过期，请重新发起认证');
        }
        const attempt = await tx.campusOAuthAttempt.findUniqueOrThrow({
          where: { id: dto.attemptId },
        });
        const proof = attempt.proof as CampusProof;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`campus:${userId}`}, 0))`;
        const previous = await tx.studentVerification.findUnique({
          where: { userId },
        });
        if (previous && previous.updatedAt > attempt.createdAt)
          throw new ConflictException('认证状态已更新，请返回应用查看');
        status = proof.active ? 'VERIFIED' : 'PENDING';
        const data = {
          schoolCode: 'tsinghua',
          method: 'SCHOOL_ASSERTION',
          studentSubjectDigest: proof.studentSubjectDigest,
          status,
          verifiedAt: proof.active ? new Date(proof.capturedAt) : null,
          expiresAt: proof.expiresAt ? new Date(proof.expiresAt) : null,
          reviewedById: null,
          reviewedAt: null,
          reason: proof.active ? null : '校方账号已验证，当前在读资格待审核',
        };
        await tx.studentVerification.upsert({
          where: { userId },
          create: { ...data, userId },
          update: data,
        });
        await tx.campusOAuthAttempt.update({
          where: { id: attempt.id },
          data: { proof: Prisma.DbNull, handoffDigest: null },
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException(
          '该校园身份已用于其他账号，请联系管理员处理',
        );
      throw error;
    }
    return { completed: true, status: status! };
  }
}
