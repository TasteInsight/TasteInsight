import { randomUUID, createHash } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import request from 'supertest';
import { IdentityController } from '@/auth/identity.controller';
import { AuthService } from '@/auth/auth.service';
import { PublicAuthController } from '@/auth/public-auth.controller';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { isCurrentStudent } from '@/auth/student-status';
import { PrismaService } from '@/prisma.service';
import { UserIdentityService } from '@/auth/user-identity.service';
import { CampusOAuthService } from '@/campus-identity/campus-oauth.service';
import { CampusIdentityService } from '@/campus-identity/campus-identity.service';
import { CampusIdentityController } from '@/campus-identity/campus-identity.controller';
import { VerificationChallengeService } from '@/auth/verification-challenge.service';

describe('campus OAuth handoff (PostgreSQL and HTTP)', () => {
  const prefix = `oauth-handoff-${randomUUID()}`;
  const userIds: string[] = [];
  const loginAttemptIds: string[] = [];
  const accessSecret = 'isolated-oauth-handoff-access-secret';
  const http = { post: jest.fn(), get: jest.fn() };
  const config = new ConfigService({
    JWT_SECRET: accessSecret,
    JWT_REFRESH_SECRET: 'isolated-oauth-handoff-refresh-secret',
    AUTH_LOGIN_METHODS: 'campusOAuth',
    AUTH_CHALLENGE_SECRET:
      'isolated-oauth-challenge-secret-at-least-32-characters',
    CAMPUS_OAUTH_AUTHORIZATION_URL: 'https://school.example/authorize',
    CAMPUS_OAUTH_TOKEN_URL: 'https://school.example/token',
    CAMPUS_OAUTH_USERINFO_URL: 'https://school.example/userinfo',
    CAMPUS_OAUTH_CLIENT_ID: 'test-client',
    CAMPUS_OAUTH_CLIENT_SECRET: 'test-secret',
    CAMPUS_OAUTH_REDIRECT_URI:
      'https://api.example/user/student-verification/oauth/callback',
    CAMPUS_OAUTH_SCOPE: 'profile affiliation',
    CAMPUS_OAUTH_ISSUER: 'https://school.example',
    CAMPUS_OAUTH_STUDENT_CLAIM: 'enrollment',
    CAMPUS_OAUTH_STUDENT_VALUES: 'student',
    CAMPUS_VERIFICATION_DAYS: 30,
    CORS_ALLOWED_ORIGINS: 'https://app.example',
  });
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminId: string;
  const bearer = (id: string) =>
    `Bearer ${jwt.sign({ sub: id, type: 'user', tokenUse: 'access' }, { secret: accessSecret })}`;
  const createUser = async () => {
    const user = await prisma.user.create({ data: { nickname: prefix } });
    userIds.push(user.id);
    return user;
  };
  const begin = async (userId: string) => {
    const response = await request(app.getHttpServer())
      .post('/user/student-verification/oauth')
      .set('Authorization', bearer(userId))
      .set('Origin', 'https://app.example')
      .send({})
      .expect(200);
    return {
      ...response.body.data,
      state: new URL(response.body.data.authorizationUrl).searchParams.get(
        'state',
      ),
    };
  };
  const callback = async (start: { state: string }) => {
    const response = await request(app.getHttpServer())
      .get('/user/student-verification/oauth/callback')
      .query({ state: start.state, code: 'provider-code' })
      .expect(200);
    const code = response.text.match(
      /<textarea id="code"[^>]*>([A-Za-z0-9_-]{43})<\/textarea>/,
    )?.[1];
    expect(code).toBeDefined();
    return code!;
  };
  const complete = (owner: string, attemptId: string, handoffCode: string) =>
    request(app.getHttpServer())
      .post('/user/student-verification/oauth/complete')
      .set('Authorization', bearer(owner))
      .send({ attemptId, handoffCode });

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL)
      throw new Error('An explicit test database is required');
    const module = await Test.createTestingModule({
      controllers: [
        CampusIdentityController,
        PublicAuthController,
        IdentityController,
      ],
      providers: [
        PrismaService,
        CampusOAuthService,
        AuthService,
        {
          provide: UserProfileService,
          useValue: {
            getUserProfile: async (id: string) => ({
              data: {
                ...(await prisma.user.findUniqueOrThrow({ where: { id } })),
                capabilities: {
                  canContribute: isCurrentStudent(
                    await prisma.studentVerification.findUnique({
                      where: { userId: id },
                    }),
                  ),
                },
              },
            }),
          },
        },
        UserIdentityService,
        CampusIdentityService,
        JwtService,
        { provide: ConfigService, useValue: config },
        { provide: HttpService, useValue: http },
        { provide: VerificationChallengeService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    adminId = (
      await prisma.admin.create({
        data: {
          scope: 'GLOBAL',
          username: prefix,
          password: 'unused-test-hash',
        },
      })
    ).id;
  });
  beforeEach(async () => {
    await prisma.campusOAuthAttempt.deleteMany({
      where: { id: { in: loginAttemptIds } },
    });
    jest.clearAllMocks();
    config.set('AUTH_LOGIN_METHODS', 'campusOAuth');
    config.set('CAMPUS_VERIFICATION_METHODS', 'campusEmail,campusOAuth');
    http.post.mockReturnValue(
      of({
        data: { access_token: 'fake-provider-token', token_type: 'Bearer' },
      }),
    );
    http.get.mockReturnValue(
      of({
        data: {
          sub: `${prefix}-${randomUUID()}`,
          enrollment: 'student',
          iss: 'https://school.example',
        },
      }),
    );
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.campusOAuthAttempt.deleteMany({
        where: { id: { in: loginAttemptIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (adminId) {
        await prisma.operationLog.deleteMany({ where: { adminId } });
        await prisma.admin.delete({ where: { id: adminId } });
      }
    }
    await app?.close();
  });

  it('a forwarded callback stores proof but neither grants status nor exposes handoff through start/status', async () => {
    const owner = await createUser();
    const start = await begin(owner.id);
    expect(start).not.toHaveProperty('proof');
    expect(start).not.toHaveProperty('handoffCode');
    const code = await callback(start);
    expect(
      await prisma.studentVerification.findUnique({
        where: { userId: owner.id },
      }),
    ).toBeNull();
    const status = await request(app.getHttpServer())
      .get('/user/student-verification')
      .set('Authorization', bearer(owner.id))
      .expect(200);
    expect(status.body.data).toEqual({
      status: 'UNVERIFIED',
      canContribute: false,
    });
    expect(JSON.stringify(status.body)).not.toContain(code);
    const saved = await prisma.campusOAuthAttempt.findUniqueOrThrow({
      where: { id: start.attemptId },
    });
    expect(saved.handoffDigest).toBe(
      createHash('sha256').update(code).digest('hex'),
    );
    expect(JSON.stringify(saved)).not.toContain(code);
    expect(saved.proof).toMatchObject({
      active: true,
      studentSubjectDigest: expect.any(String),
    });
    await complete(owner.id, start.attemptId, 'x'.repeat(43)).expect(400);
    await request(app.getHttpServer())
      .get('/user/student-verification/oauth/callback')
      .query({ state: start.state, code: 'provider-code' })
      .expect(400);
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(
      await prisma.studentVerification.findUnique({
        where: { userId: owner.id },
      }),
    ).toBeNull();
  });

  it('same-owner confirmation grants once under concurrent HTTP requests; other owners and replay fail', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const start = await begin(owner.id);
    const code = await callback(start);
    await complete(stranger.id, start.attemptId, code).expect(400);
    const results = await Promise.all([
      complete(owner.id, start.attemptId, code),
      complete(owner.id, start.attemptId, code),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    const verification = await prisma.studentVerification.findUniqueOrThrow({
      where: { userId: owner.id },
    });
    expect(verification.status).toBe('VERIFIED');
    expect(
      await prisma.userIdentity.count({
        where: { userId: owner.id, provider: 'CAMPUS_OAUTH' },
      }),
    ).toBe(0);
    const saved = await prisma.campusOAuthAttempt.findUniqueOrThrow({
      where: { id: start.attemptId },
    });
    expect(saved.completedAt).not.toBeNull();
    expect(saved.handoffDigest).toBeNull();
    expect(saved.proof).toBeNull();
    await complete(owner.id, start.attemptId, code).expect(400);
  });

  it('requires a live handoff and rejects completion before the provider callback', async () => {
    const owner = await createUser();
    const start = await begin(owner.id);
    await complete(owner.id, start.attemptId, 'x'.repeat(43)).expect(400);
    const code = await callback(start);
    await prisma.campusOAuthAttempt.update({
      where: { id: start.attemptId },
      data: { handoffExpiresAt: new Date(0) },
    });
    await complete(owner.id, start.attemptId, code).expect(400);
    expect(
      await prisma.studentVerification.findUnique({
        where: { userId: owner.id },
      }),
    ).toBeNull();
  });

  it.each(['before_callback', 'after_callback'])(
    'never overwrites a newer administrator decision made %s',
    async (timing) => {
      const owner = await createUser();
      const pending = await prisma.studentVerification.create({
        data: {
          userId: owner.id,
          method: 'MANUAL_REVIEW',
          status: 'PENDING',
          updatedAt: new Date('2000-01-01T00:00:00Z'),
        },
      });
      const start = await begin(owner.id);
      await prisma.campusOAuthAttempt.update({
        where: { id: start.attemptId },
        data: { createdAt: new Date(Date.now() - 1000) },
      });
      const decide = () =>
        app.get(CampusIdentityService).decide(owner.id, adminId, {
          decision: 'REVOKE',
          reason: '资格复核未通过',
          expectedUpdatedAt: pending.updatedAt.toISOString(),
        });
      if (timing === 'before_callback') await decide();
      const code = await callback(start);
      if (timing === 'after_callback') await decide();
      await complete(owner.id, start.attemptId, code).expect(409);
      expect(
        (
          await prisma.studentVerification.findUniqueOrThrow({
            where: { userId: owner.id },
          })
        ).status,
      ).toBe('REVOKED');
      expect(
        (
          await prisma.campusOAuthAttempt.findUniqueOrThrow({
            where: { id: start.attemptId },
          })
        ).completedAt,
      ).toBeNull();
    },
  );

  it('keeps one school proof bound to one account when two owners confirm concurrently', async () => {
    http.get.mockReturnValue(
      of({ data: { sub: `${prefix}-shared-proof`, enrollment: 'student' } }),
    );
    const first = await createUser();
    const second = await createUser();
    const a = await begin(first.id);
    const b = await begin(second.id);
    const aCode = await callback(a);
    const bCode = await callback(b);
    const results = await Promise.all([
      complete(first.id, a.attemptId, aCode),
      complete(second.id, b.attemptId, bCode),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.studentVerification.count({
        where: { userId: { in: [first.id, second.id] }, status: 'VERIFIED' },
      }),
    ).toBe(1);
  });
  const loginHandoff = async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/campus/oauth')
      .set('Origin', 'https://app.example')
      .send({})
      .expect(200);
    const start = response.body.data;
    loginAttemptIds.push(start.attemptId);
    const state = new URL(start.authorizationUrl).searchParams.get('state')!;
    const handoffCode = await callback({ state });
    return {
      attemptId: start.attemptId,
      loginVerifier: start.loginVerifier,
      handoffCode,
    };
  };
  const login = (ticket: {
    attemptId: string;
    handoffCode: string;
    loginVerifier: string;
  }) => request(app.getHttpServer()).post('/auth/campus/login').send(ticket);

  it('creates one anonymous campus account atomically under concurrent completion and signs user tokens', async () => {
    config.set('CAMPUS_VERIFICATION_METHODS', '');
    const ticket = await loginHandoff();
    await login({ ...ticket, loginVerifier: 'x'.repeat(43) }).expect(400);
    const results = await Promise.all([
      login(ticket).set('Accept-Language', 'en-US'),
      login(ticket).set('Accept-Language', 'en-US'),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    const data = results.find((result) => result.status === 200)!.body.data;
    userIds.push(data.user.id);
    expect(data.user.nickname).toMatch(/^Foodie_[0-9a-f]{12}$/);
    expect(
      jwt.verify(data.token.accessToken, { secret: accessSecret }),
    ).toMatchObject({ sub: data.user.id, type: 'user', tokenUse: 'access' });
    expect(data.user.capabilities.canContribute).toBe(false);
    expect(
      await prisma.studentVerification.findUnique({
        where: { userId: data.user.id },
      }),
    ).toBeNull();
    expect(
      await prisma.userIdentity.count({
        where: { userId: data.user.id, provider: 'CAMPUS_OAUTH' },
      }),
    ).toBe(1);
    await login(ticket).expect(400);
  });
  it('keeps campus-only certification separate from login and does not transfer its qualification', async () => {
    const owner = await createUser();
    const subject = `${prefix}-legacy-campus`;
    http.get.mockReturnValue(
      of({ data: { sub: subject, enrollment: 'student' } }),
    );
    await prisma.studentVerification.create({
      data: {
        userId: owner.id,
        method: 'SCHOOL_ASSERTION',
        status: 'VERIFIED',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        studentSubjectDigest: createHash('sha256')
          .update(JSON.stringify(['https://school.example', subject]))
          .digest('hex'),
      },
    });
    let loginOwner: string | undefined;
    for (let i = 0; i < 2; i++) {
      const response = await login(await loginHandoff()).expect(200);
      userIds.push(response.body.data.user.id);
      expect(response.body.data.user.id).not.toBe(owner.id);
      expect(response.body.data.user.capabilities.canContribute).toBe(false);
      if (loginOwner) expect(response.body.data.user.id).toBe(loginOwner);
      loginOwner = response.body.data.user.id;
    }
    expect(
      await prisma.userIdentity.count({
        where: { userId: owner.id, provider: 'CAMPUS_OAUTH' },
      }),
    ).toBe(0);
  });
  it('keeps unproven current-student claims pending during campus login', async () => {
    http.get.mockReturnValue(
      of({ data: { sub: `${prefix}-alumni`, enrollment: 'alumni' } }),
    );
    const result = await login(await loginHandoff()).expect(200);
    userIds.push(result.body.data.user.id);
    expect(result.body.data.user.capabilities.canContribute).toBe(false);
    expect(
      (
        await prisma.studentVerification.findUniqueOrThrow({
          where: { userId: result.body.data.user.id },
        })
      ).status,
    ).toBe('PENDING');
  });
  it('rejects cross-purpose completion and rolls back identity conflicts without consuming the handoff', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const subject = `${prefix}-conflict`;
    http.get.mockReturnValue(
      of({ data: { sub: subject, enrollment: 'student' } }),
    );
    const first = await begin(owner.id);
    await complete(owner.id, first.attemptId, await callback(first)).expect(
      200,
    );
    const second = await begin(stranger.id);
    const code = await callback(second);
    await login({
      attemptId: second.attemptId,
      loginVerifier: 'v'.repeat(43),
      handoffCode: code,
    }).expect(400);
    await complete(stranger.id, second.attemptId, code).expect(409);
    expect(
      (
        await prisma.campusOAuthAttempt.findUniqueOrThrow({
          where: { id: second.attemptId },
        })
      ).completedAt,
    ).toBeNull();
    expect(
      await prisma.userIdentity.count({ where: { userId: stranger.id } }),
    ).toBe(0);
    const signedIn = await login(await loginHandoff()).expect(200);
    userIds.push(signedIn.body.data.user.id);
    expect(signedIn.body.data.user.id).not.toBe(owner.id);
    expect(signedIn.body.data.user.capabilities.canContribute).toBe(false);
  });
  it('retains a revoked campus qualification while allowing the original account to log in', async () => {
    http.get.mockReturnValue(
      of({ data: { sub: `${prefix}-revoked`, enrollment: 'student' } }),
    );
    const initial = await login(await loginHandoff()).expect(200);
    const userId = initial.body.data.user.id;
    userIds.push(userId);
    const verification = await prisma.studentVerification.findUniqueOrThrow({
      where: { userId },
    });
    await app.get(CampusIdentityService).decide(userId, adminId, {
      decision: 'REVOKE',
      reason: '资格复核',
      expectedUpdatedAt: verification.updatedAt.toISOString(),
    });
    const next = await login(await loginHandoff()).expect(200);
    expect(next.body.data.user.id).toBe(userId);
    expect(next.body.data.user.capabilities.canContribute).toBe(false);
    expect(
      (
        await prisma.studentVerification.findUniqueOrThrow({
          where: { userId },
        })
      ).status,
    ).toBe('REVOKED');
  });
  const beginBinding = async (userId: string) => {
    const response = await request(app.getHttpServer())
      .post('/user/identities/campus/oauth')
      .set('Authorization', bearer(userId))
      .send({})
      .expect(200);
    return {
      ...response.body.data,
      state: new URL(response.body.data.authorizationUrl).searchParams.get(
        'state',
      )!,
    };
  };
  const bind = (userId: string, attemptId: string, handoffCode: string) =>
    request(app.getHttpServer())
      .post('/user/identities/campus/oauth/complete')
      .set('Authorization', bearer(userId))
      .send({ attemptId, handoffCode });

  it('binds campus login explicitly while verification is disabled, then signs into the bound account', async () => {
    config.set('CAMPUS_VERIFICATION_METHODS', '');
    http.get.mockReturnValue(
      of({
        data: { sub: `${prefix}-explicit-binding`, enrollment: 'student' },
      }),
    );
    const owner = await createUser();
    const stranger = await createUser();
    const start = await beginBinding(owner.id);
    const code = await callback(start);
    await bind(stranger.id, start.attemptId, code).expect(400);
    await bind(owner.id, start.attemptId, code).expect(200);
    await bind(owner.id, start.attemptId, code).expect(400);
    expect(
      await prisma.studentVerification.findUnique({
        where: { userId: owner.id },
      }),
    ).toBeNull();
    expect(
      await prisma.userIdentity.count({
        where: { userId: owner.id, provider: 'CAMPUS_OAUTH' },
      }),
    ).toBe(1);
    const signedIn = await login(await loginHandoff()).expect(200);
    expect(signedIn.body.data.user.id).toBe(owner.id);
    expect(signedIn.body.data.user.capabilities.canContribute).toBe(false);
  });
  it('never exchanges verification and login-binding handoffs or silently transfers a login identity', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    http.get.mockReturnValue(
      of({
        data: { sub: `${prefix}-binding-conflict`, enrollment: 'student' },
      }),
    );
    const verification = await begin(owner.id);
    const verificationCode = await callback(verification);
    await bind(owner.id, verification.attemptId, verificationCode).expect(400);
    await complete(owner.id, verification.attemptId, verificationCode).expect(
      200,
    );
    expect(
      await prisma.userIdentity.count({
        where: { userId: owner.id, provider: 'CAMPUS_OAUTH' },
      }),
    ).toBe(0);
    const binding = await beginBinding(owner.id);
    const bindingCode = await callback(binding);
    await complete(owner.id, binding.attemptId, bindingCode).expect(400);
    await bind(owner.id, binding.attemptId, bindingCode).expect(200);
    const conflict = await beginBinding(stranger.id);
    const conflictCode = await callback(conflict);
    await bind(stranger.id, conflict.attemptId, conflictCode).expect(409);
    expect(
      (
        await prisma.campusOAuthAttempt.findUniqueOrThrow({
          where: { id: conflict.attemptId },
        })
      ).completedAt,
    ).toBeNull();
    expect(
      await prisma.userIdentity.count({ where: { userId: stranger.id } }),
    ).toBe(0);
  });
  it('retains an existing qualification unchanged when only campus login is enabled', async () => {
    http.get.mockReturnValue(
      of({
        data: { sub: `${prefix}-retain-qualification`, enrollment: 'student' },
      }),
    );
    const initial = await login(await loginHandoff()).expect(200);
    const userId = initial.body.data.user.id;
    userIds.push(userId);
    const previous = await prisma.studentVerification.findUniqueOrThrow({
      where: { userId },
    });
    config.set('CAMPUS_VERIFICATION_METHODS', 'campusEmail');
    http.get.mockReturnValue(
      of({
        data: { sub: `${prefix}-retain-qualification`, enrollment: 'alumni' },
      }),
    );
    const next = await login(await loginHandoff()).expect(200);
    expect(next.body.data.user.id).toBe(userId);
    expect(
      await prisma.studentVerification.findUniqueOrThrow({ where: { userId } }),
    ).toEqual(previous);
  });
});
