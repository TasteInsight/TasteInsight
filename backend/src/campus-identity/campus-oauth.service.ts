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
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import {
  identityCapabilities,
  assertLoginMethodEnabled,
  assertVerificationMethodEnabled,
  configuredVerificationMethods,
} from '@/auth/identity-configuration';
import { UserIdentityService } from '@/auth/user-identity.service';
import { corsOrigins } from '@/environment';
import {
  CampusOAuthCallbackDto,
  CompleteCampusOAuthDto,
  CampusLoginDto,
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
    private readonly identities: UserIdentityService,
  ) {}

  private setting(key: string): string {
    return this.config.get<string>(`CAMPUS_OAUTH_${key}`, '');
  }

  private assertConfigured(purpose: string = 'VERIFICATION') {
    const get = (key: string) => this.config.get(key);
    if (purpose === 'VERIFICATION')
      assertVerificationMethodEnabled('campusOAuth', get);
    else assertLoginMethodEnabled('campusOAuth', get);
    const capabilities = identityCapabilities(get);
    if (
      !(purpose === 'VERIFICATION'
        ? capabilities.verificationMethods.campusOAuth
        : capabilities.loginMethods.campusOAuth)
    ) {
      throw new ServiceUnavailableException('校园统一身份认证尚未开通');
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
    const result = await this.begin('VERIFICATION', origin, userId);
    return {
      ...result,
      account: result.account!,
      purpose: 'VERIFICATION' as const,
    };
  }

  async startBinding(userId: string, origin?: string) {
    const result = await this.begin('LOGIN_BIND', origin, userId);
    return {
      ...result,
      account: result.account!,
      purpose: 'LOGIN_BIND' as const,
    };
  }

  async startLogin(ip: string, origin?: string) {
    const result = await this.begin('LOGIN', origin, undefined, ip);
    return { ...result, loginVerifier: result.loginVerifier! };
  }

  private async begin(
    purpose: 'LOGIN' | 'VERIFICATION' | 'LOGIN_BIND',
    origin?: string,
    userId?: string,
    ip?: string,
  ) {
    this.assertConfigured(purpose);
    if (
      origin &&
      !corsOrigins({
        CORS_ALLOWED_ORIGINS: this.config.get('CORS_ALLOWED_ORIGINS'),
        APP_URL: this.config.get('APP_URL'),
      }).includes(origin)
    ) {
      throw new BadRequestException('请从食鉴应用发起认证');
    }
    const account = userId ? await this.account(userId) : undefined;
    const loginVerifier =
      purpose === 'LOGIN' ? randomBytes(32).toString('base64url') : undefined;
    const ipDigest =
      purpose === 'LOGIN'
        ? createHmac(
            'sha256',
            this.config.get<string>('AUTH_CHALLENGE_SECRET')!,
          )
            .update(`campus-login:${ip}`)
            .digest('hex')
        : null;
    const attemptId = randomUUID();
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const scope =
        purpose === 'LOGIN'
          ? `campus-login:${ipDigest}`
          : `campus-oauth:${userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
      const count = await tx.campusOAuthAttempt.count({
        where: {
          purpose,
          ...(purpose === 'LOGIN' ? { ipDigest } : { userId }),
          createdAt: { gt: new Date(now.getTime() - 900000) },
        },
      });
      if (count >= (purpose === 'LOGIN' ? 20 : 5))
        throw new BadRequestException('认证请求过于频繁，请稍后重试');
      await tx.campusOAuthAttempt.create({
        data: {
          id: attemptId,
          userId: userId ?? null,
          purpose,
          ipDigest,
          loginVerifierDigest: loginVerifier
            ? createHash('sha256').update(loginVerifier).digest('hex')
            : null,
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
      ...(account ? { account } : {}),
      ...(loginVerifier ? { loginVerifier } : {}),
    };
  }

  async callback(dto: CampusOAuthCallbackDto) {
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
    this.assertConfigured(attempt.purpose);
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
      purpose: attempt.purpose,
      account: attempt.userId ? await this.account(attempt.userId) : undefined,
    };
  }

  async complete(userId: string, dto: CompleteCampusOAuthDto) {
    const result = await this.finish('VERIFICATION', dto, userId);
    return { completed: true, status: result.status! };
  }

  async login(dto: CampusLoginDto, language = 'zh') {
    return (await this.finish('LOGIN', dto, undefined, language)).user!;
  }

  async completeBinding(userId: string, dto: CompleteCampusOAuthDto) {
    await this.finish('LOGIN_BIND', dto, userId);
    return { completed: true };
  }

  private async recordVerification(
    tx: Prisma.TransactionClient,
    userId: string,
    proof: CampusProof,
    createdAt: Date,
    automatic: boolean,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`campus-subject:${proof.studentSubjectDigest}`}, 0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`campus:${userId}`}, 0))`;
    const previous = await tx.studentVerification.findUnique({
      where: { userId },
    });
    const owner = await tx.studentVerification.findUnique({
      where: {
        schoolCode_studentSubjectDigest: {
          schoolCode: 'tsinghua',
          studentSubjectDigest: proof.studentSubjectDigest,
        },
      },
    });
    if (owner && owner.userId !== userId) {
      if (automatic) return previous?.status ?? null;
      throw new ConflictException('该校园身份已用于其他账号，请联系管理员处理');
    }
    if (
      previous &&
      (previous.updatedAt > createdAt || (automatic && previous.reviewedAt))
    ) {
      if (automatic) return previous.status;
      throw new ConflictException('认证状态已更新，请返回应用查看');
    }
    const status = proof.active ? 'VERIFIED' : 'PENDING';
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
    return status;
  }

  private async finish(
    purpose: 'LOGIN' | 'VERIFICATION' | 'LOGIN_BIND',
    dto: CompleteCampusOAuthDto | CampusLoginDto,
    userId?: string,
    language = 'zh',
  ) {
    this.assertConfigured(purpose);
    const now = new Date();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.campusOAuthAttempt.updateMany({
          where: {
            id: dto.attemptId,
            purpose,
            userId: purpose === 'LOGIN' ? null : userId,
            ...(purpose === 'LOGIN'
              ? {
                  loginVerifierDigest: createHash('sha256')
                    .update((dto as CampusLoginDto).loginVerifier)
                    .digest('hex'),
                }
              : {}),
            handoffDigest: createHash('sha256')
              .update(dto.handoffCode)
              .digest('hex'),
            handoffExpiresAt: { gt: now },
            completedAt: null,
          },
          data: { completedAt: now },
        });
        if (consumed.count !== 1)
          throw new BadRequestException('确认码无效或已过期，请重新发起');
        const attempt = await tx.campusOAuthAttempt.findUniqueOrThrow({
          where: { id: dto.attemptId },
        });
        const proof = attempt.proof as CampusProof;
        const user =
          purpose === 'VERIFICATION'
            ? null
            : await this.identities.campus(
                tx,
                proof.studentSubjectDigest,
                userId,
                language,
              );
        const shouldVerify =
          purpose === 'VERIFICATION' ||
          (purpose === 'LOGIN' &&
            configuredVerificationMethods(
              this.config.get('CAMPUS_VERIFICATION_METHODS'),
            ).includes('campusOAuth'));
        const status = shouldVerify
          ? await this.recordVerification(
              tx,
              user?.id ?? userId!,
              proof,
              attempt.createdAt,
              purpose === 'LOGIN',
            )
          : null;
        await tx.campusOAuthAttempt.update({
          where: { id: attempt.id },
          data: {
            proof: Prisma.DbNull,
            handoffDigest: null,
            loginVerifierDigest: null,
            ...(user ? { userId: user.id } : {}),
          },
        });
        return { user, status };
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException(
          '该校园身份已用于其他账号，请联系管理员处理',
        );
      throw error;
    }
  }
}
