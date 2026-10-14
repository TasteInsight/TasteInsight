import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import type { CampusOAuthAttempt } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { createHash } from 'crypto';
import { of, throwError } from 'rxjs';
import { UserIdentityService } from '@/auth/user-identity.service';
import { CampusOAuthService } from './campus-oauth.service';

describe('CampusOAuthService', () => {
  const settings: Record<string, string | number> = {};
  const attempts = new Map<string, CampusOAuthAttempt>();
  let previousVerification: Record<string, unknown> | null;
  let subjectOwner: { userId: string } | null;
  const tx = {
    $executeRaw: jest.fn(),
    campusOAuthAttempt: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    studentVerification: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    campusOAuthAttempt: tx.campusOAuthAttempt,
    user: { findUnique: jest.fn() },
  };
  const http = { post: jest.fn(), get: jest.fn() };
  const config = {
    get: (key: string, fallback?: unknown) => settings[key] ?? fallback,
  };
  const identities = { campus: jest.fn() };
  const service = new CampusOAuthService(
    prisma as unknown as PrismaService,
    config as ConfigService,
    http as unknown as HttpService,
    identities as unknown as UserIdentityService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    attempts.clear();
    previousVerification = null;
    subjectOwner = null;
    identities.campus.mockImplementation((_tx, _subject, id) =>
      Promise.resolve({ id: id ?? 'campus-user' }),
    );
    Object.keys(settings).forEach((key) => delete settings[key]);
    Object.assign(settings, {
      AUTH_CHALLENGE_SECRET: 'test-challenge-key'.repeat(3),
      CAMPUS_OAUTH_AUTHORIZATION_URL: 'https://identity.example.org/authorize',
      CAMPUS_OAUTH_TOKEN_URL: 'https://identity.example.org/token',
      CAMPUS_OAUTH_USERINFO_URL: 'https://identity.example.org/userinfo',
      CAMPUS_OAUTH_CLIENT_ID: 'client',
      CAMPUS_OAUTH_CLIENT_SECRET: 'secret',
      CAMPUS_OAUTH_REDIRECT_URI:
        'https://api.example.org/api/v1/user/student-verification/oauth/callback',
      CAMPUS_OAUTH_SCOPE: 'profile affiliation',
      CAMPUS_OAUTH_ISSUER: 'https://identity.example.org',
      CAMPUS_OAUTH_SUBJECT_CLAIM: 'sub',
      CAMPUS_OAUTH_STUDENT_CLAIM: 'enrollment.status',
      CAMPUS_OAUTH_STUDENT_VALUES: 'active_student',
      CAMPUS_VERIFICATION_DAYS: 30,
      CORS_ALLOWED_ORIGINS: 'https://app.example.org',
    });
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    prisma.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({
        id: where.id,
        nickname: '校园用户',
        identities: [{ subject: '+8613812345678' }],
      }),
    );
    tx.campusOAuthAttempt.count.mockResolvedValue(0);
    tx.campusOAuthAttempt.create.mockImplementation(({ data }) => {
      const attempt = {
        ...data,
        consumedAt: null,
        completedAt: null,
        handoffDigest: null,
        handoffExpiresAt: null,
        proof: null,
        createdAt: new Date(),
      };
      attempts.set(data.stateDigest, attempt);
      return Promise.resolve(attempt);
    });
    tx.campusOAuthAttempt.updateMany.mockImplementation(({ where, data }) => {
      const attempt = [...attempts.values()].find((item) =>
        where.id
          ? item.id === where.id
          : item.stateDigest === where.stateDigest,
      );
      const matches =
        attempt &&
        Object.entries(where).every(([key, expected]) => {
          const actual = attempt[key as keyof CampusOAuthAttempt];
          if (expected && typeof expected === 'object' && 'gt' in expected)
            return (
              actual instanceof Date && actual > (expected as { gt: Date }).gt
            );
          return actual === expected;
        });
      if (!matches) return Promise.resolve({ count: 0 });
      Object.assign(attempt, data);
      return Promise.resolve({ count: 1 });
    });
    tx.campusOAuthAttempt.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(attempts.get(where.stateDigest)),
    );
    tx.campusOAuthAttempt.findUniqueOrThrow.mockImplementation(({ where }) =>
      Promise.resolve(
        [...attempts.values()].find((item) => item.id === where.id),
      ),
    );
    tx.campusOAuthAttempt.update.mockImplementation(({ where, data }) => {
      const attempt = [...attempts.values()].find(
        (item) => item.id === where.id,
      )!;
      Object.assign(attempt, data);
      return Promise.resolve(attempt);
    });
    tx.studentVerification.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.userId ? previousVerification : subjectOwner),
    );
    http.post.mockReturnValue(
      of({ data: { access_token: 'campus-token', token_type: 'Bearer' } }),
    );
    http.get.mockReturnValue(
      of({
        data: {
          sub: 'student-123',
          iss: 'https://identity.example.org',
          enrollment: { status: 'active_student' },
        },
      }),
    );
  });
  const begin = async () =>
    new URL((await service.start('alice')).authorizationUrl).searchParams.get(
      'state',
    )!;

  it('creates user-bound, hashed state and S256 PKCE with only a configured callback', async () => {
    const start = await service.start('alice', 'https://app.example.org');
    const { authorizationUrl } = start;
    const url = new URL(authorizationUrl);
    const state = url.searchParams.get('state')!;
    const attempt = attempts.get(
      createHash('sha256').update(state).digest('hex'),
    )!;
    expect(attempt.userId).toBe('alice');
    expect(attempt.clientOrigin).toBe('https://app.example.org');
    expect(start.account).toEqual({
      id: 'alice',
      nickname: '校园用户',
      phone: '+86****5678',
    });
    expect(start).not.toHaveProperty('handoffCode');
    expect(start).not.toHaveProperty('proof');
    expect(attempt).not.toHaveProperty('state');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(attempt.codeVerifier).digest('base64url'),
    );
    expect(url.searchParams.get('redirect_uri')).toBe(
      settings.CAMPUS_OAUTH_REDIRECT_URI,
    );
    expect(authorizationUrl).not.toContain(attempt.codeVerifier);
  });
  it('exchanges code server-side and accepts only configured current-student claims', async () => {
    const state = await begin();
    const verifier = [...attempts.values()][0].codeVerifier;
    const result = await service.callback({
      state,
      code: 'authorization-code',
    });
    expect(result.handoffCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
    const attempt = [...attempts.values()][0];
    expect(attempt.handoffDigest).toBe(
      createHash('sha256').update(result.handoffCode).digest('hex'),
    );
    const proof = attempt.proof as { capturedAt: string };
    expect(
      attempt.handoffExpiresAt!.getTime() - Date.parse(proof.capturedAt),
    ).toBe(180000);
    expect(JSON.stringify(attempt)).not.toContain(result.handoffCode);
    expect(await service.complete('alice', result)).toEqual({
      completed: true,
      status: 'VERIFIED',
    });
    const [url, encoded, options] = http.post.mock.calls[0];
    expect(url).toBe(settings.CAMPUS_OAUTH_TOKEN_URL);
    expect(new URLSearchParams(encoded).get('code_verifier')).toBe(verifier);
    expect(new URLSearchParams(encoded).get('grant_type')).toBe(
      'authorization_code',
    );
    expect(options).toMatchObject({
      timeout: 10000,
      maxRedirects: 0,
      headers: {
        Authorization: `Basic ${Buffer.from('client:secret').toString('base64')}`,
      },
    });
    expect(http.get).toHaveBeenCalledWith(
      settings.CAMPUS_OAUTH_USERINFO_URL,
      expect.objectContaining({
        headers: { Authorization: 'Bearer campus-token' },
        maxRedirects: 0,
      }),
    );
    expect(tx.studentVerification.upsert.mock.calls[0][0].create).toMatchObject(
      {
        userId: 'alice',
        status: 'VERIFIED',
        method: 'SCHOOL_ASSERTION',
        studentSubjectDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    );
    expect(result).not.toHaveProperty('token');
    expect(JSON.stringify(result)).not.toContain('student-123');
  });
  it('does not grant qualification when a forwarded authorization link completes only its public callback', async () => {
    const state = await begin();
    await service.callback({ state, code: 'authorization-code' });
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it.each([
    { sub: 'person', email: 'person@mails.tsinghua.edu.cn' },
    { sub: 'person', enrollment: { status: 'alumni' } },
    { sub: 'person', isStudent: true },
  ])('keeps unproven student status pending: %j', async (userinfo) => {
    const state = await begin();
    http.get.mockReturnValue(of({ data: userinfo }));
    const handoff = await service.callback({ state, code: 'code' });
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
    expect(await service.complete('alice', handoff)).toEqual({
      completed: true,
      status: 'PENDING',
    });
    expect(tx.studentVerification.upsert.mock.calls[0][0].create).toMatchObject(
      { status: 'PENDING', verifiedAt: null, expiresAt: null },
    );
  });
  it('keeps a login pending when no trusted student-claim mapping is configured', async () => {
    delete settings.CAMPUS_OAUTH_STUDENT_CLAIM;
    delete settings.CAMPUS_OAUTH_STUDENT_VALUES;
    expect(
      await service.complete(
        'alice',
        await service.callback({ state: await begin(), code: 'code' }),
      ),
    ).toMatchObject({ status: 'PENDING' });
  });
  it('rejects state replay before a second provider request', async () => {
    const state = await begin();
    await service.callback({ state, code: 'code' });
    await expect(
      service.callback({ state, code: 'code' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(http.post).toHaveBeenCalledTimes(1);
  });
  it('rejects unknown or expired state', async () => {
    await expect(
      service.callback({ state: 'unknown', code: 'code' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const state = await begin();
    [...attempts.values()][0].expiresAt = new Date(0);
    await expect(
      service.callback({ state, code: 'code' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(http.post).not.toHaveBeenCalled();
  });
  it('consumes denied callbacks and rejects an issuer mismatch', async () => {
    const state = await begin();
    await expect(
      service.callback({ state, error: 'access_denied' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.callback({ state, code: 'code' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const anotherState = await begin();
    await expect(
      service.callback({
        state: anotherState,
        code: 'code',
        iss: 'https://attacker.example',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(http.post).not.toHaveBeenCalled();
  });
  it('will not consume an unvalidated identity subject', async () => {
    http.get.mockReturnValue(
      of({
        data: {
          email: 'student@mails.tsinghua.edu.cn',
          enrollment: { status: 'active_student' },
        },
      }),
    );
    await expect(
      service.callback({ state: await begin(), code: 'code' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('does not overwrite an administrator decision newer than the OAuth attempt', async () => {
    const state = await begin();
    previousVerification = {
      status: 'REVOKED',
      updatedAt: new Date(Date.now() + 1000),
    };
    const handoff = await service.callback({ state, code: 'code' });
    await expect(service.complete('alice', handoff)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('keeps provider failures sanitized and does not grant eligibility', async () => {
    const state = await begin();
    http.post.mockReturnValue(
      throwError(() => new Error('private client_secret')),
    );
    await expect(service.callback({ state, code: 'code' })).rejects.toThrow(
      '校方认证暂时无法完成',
    );
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('requires real configured endpoints and does not invent a campus URL', async () => {
    delete settings.CAMPUS_OAUTH_TOKEN_URL;
    await expect(service.start('alice')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(tx.campusOAuthAttempt.create).not.toHaveBeenCalled();
  });
  it('supports explicit client_secret_post configuration', async () => {
    settings.CAMPUS_OAUTH_TOKEN_AUTH_METHOD = 'client_secret_post';
    await service.callback({ state: await begin(), code: 'code' });
    const body = new URLSearchParams(http.post.mock.calls[0][1]);
    expect(body.get('client_secret')).toBe('secret');
    expect(body.get('client_id')).toBe('client');
    expect(http.post.mock.calls[0][2].headers).not.toHaveProperty(
      'Authorization',
    );
  });
  it('accepts only configured message origins and does not invent native origins', async () => {
    await expect(
      service.start('alice', 'https://attacker.example'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.campusOAuthAttempt.create).not.toHaveBeenCalled();
    await begin();
    expect([...attempts.values()][0].clientOrigin).toBeNull();
  });
  it('requires the same owner and the callback-only code, then rejects replay', async () => {
    const handoff = await service.callback({
      state: await begin(),
      code: 'code',
    });
    await expect(service.complete('bob', handoff)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.complete('alice', {
        attemptId: handoff.attemptId,
        handoffCode: 'x'.repeat(43),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
    await service.complete('alice', handoff);
    expect([...attempts.values()][0].handoffDigest).toBeNull();
    await expect(service.complete('alice', handoff)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.studentVerification.upsert).toHaveBeenCalledTimes(1);
  });
  it('rejects completion before the callback and after the handoff TTL', async () => {
    const state = await begin();
    const attempt = [...attempts.values()][0];
    await expect(
      service.complete('alice', {
        attemptId: attempt.id,
        handoffCode: 'x'.repeat(43),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const handoff = await service.callback({ state, code: 'code' });
    attempt.handoffExpiresAt = new Date(0);
    await expect(service.complete('alice', handoff)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('keeps a newer administrator decision made after the callback', async () => {
    const handoff = await service.callback({
      state: await begin(),
      code: 'code',
    });
    previousVerification = {
      status: 'REVOKED',
      updatedAt: new Date(Date.now() + 1000),
    };
    await expect(service.complete('alice', handoff)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('translates duplicate school proofs into an account conflict', async () => {
    const handoff = await service.callback({
      state: await begin(),
      code: 'code',
    });
    tx.studentVerification.upsert.mockRejectedValue({ code: 'P2002' });
    await expect(service.complete('alice', handoff)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  const anonymousHandoff = async () => {
    settings.AUTH_LOGIN_METHODS = 'campusOAuth';
    const start = await service.startLogin(
      '127.0.0.1',
      'https://app.example.org',
    );
    const state = new URL(start.authorizationUrl).searchParams.get('state')!;
    const handoff = await service.callback({ state, code: 'provider-code' });
    return {
      start,
      handoff,
      ticket: {
        attemptId: start.attemptId,
        handoffCode: handoff.handoffCode,
        loginVerifier: start.loginVerifier,
      },
    };
  };
  it('logs in with verification disabled without reading or writing student qualification, and consumes once', async () => {
    settings.CAMPUS_VERIFICATION_METHODS = '';
    const { start, handoff, ticket } = await anonymousHandoff();
    expect(start).not.toHaveProperty('account');
    expect(handoff).toMatchObject({ purpose: 'LOGIN', account: undefined });
    expect(handoff).not.toHaveProperty('loginVerifier');
    expect(start.authorizationUrl).not.toContain(start.loginVerifier);
    expect(JSON.stringify([...attempts.values()])).not.toContain(
      start.loginVerifier,
    );
    await expect(service.complete('alice', handoff)).rejects.toMatchObject({
      response: { code: 'VERIFICATION_METHOD_DISABLED' },
    });
    await expect(
      service.login({ ...ticket, loginVerifier: 'x'.repeat(43) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(identities.campus).not.toHaveBeenCalled();
    expect(await service.login(ticket)).toEqual({ id: 'campus-user' });
    expect(tx.studentVerification.findUnique).not.toHaveBeenCalled();
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
    await expect(service.login(ticket)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('blocks a disabled campus login while keeping verification available', async () => {
    const { ticket } = await anonymousHandoff();
    settings.AUTH_LOGIN_METHODS = '';
    await expect(service.login(ticket)).rejects.toMatchObject({
      response: { code: 'LOGIN_METHOD_DISABLED' },
    });
    expect(identities.campus).not.toHaveBeenCalled();
    await expect(service.startLogin('127.0.0.1')).rejects.toMatchObject({
      response: { code: 'LOGIN_METHOD_DISABLED' },
    });
    await expect(service.start('alice')).resolves.toHaveProperty('account');
  });
  it('blocks verification after a policy change at callback and completion', async () => {
    const state = await begin();
    settings.CAMPUS_VERIFICATION_METHODS = '';
    await expect(
      service.callback({ state, code: 'provider-code' }),
    ).rejects.toMatchObject({
      response: { code: 'VERIFICATION_METHOD_DISABLED' },
    });
    expect(http.post).not.toHaveBeenCalled();
    settings.CAMPUS_VERIFICATION_METHODS = 'campusOAuth';
    const handoff = await service.callback({
      state: await begin(),
      code: 'provider-code',
    });
    settings.CAMPUS_VERIFICATION_METHODS = '';
    await expect(service.complete('alice', handoff)).rejects.toMatchObject({
      response: { code: 'VERIFICATION_METHOD_DISABLED' },
    });
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('allows campus login while retaining an administrator revocation', async () => {
    const { ticket } = await anonymousHandoff();
    previousVerification = {
      status: 'REVOKED',
      reviewedAt: new Date(0),
      updatedAt: new Date(0),
    };
    await expect(service.login(ticket)).resolves.toEqual({ id: 'campus-user' });
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('limits anonymous requests by a keyed IP digest without saving the IP', async () => {
    settings.AUTH_LOGIN_METHODS = 'campusOAuth';
    await service.startLogin('192.0.2.10');
    expect(tx.campusOAuthAttempt.create.mock.calls[0][0].data).toMatchObject({
      userId: null,
      purpose: 'LOGIN',
      ipDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify([...attempts.values()])).not.toContain('192.0.2.10');
    tx.campusOAuthAttempt.count.mockResolvedValue(20);
    await expect(service.startLogin('192.0.2.10')).rejects.toThrow('频繁');
  });

  it('completes campus verification without creating or resolving a login identity', async () => {
    settings.AUTH_LOGIN_METHODS = '';
    const handoff = await service.callback({
      state: await begin(),
      code: 'code',
    });
    await expect(service.complete('alice', handoff)).resolves.toMatchObject({
      status: 'VERIFIED',
    });
    expect(identities.campus).not.toHaveBeenCalled();
    expect(tx.studentVerification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'alice',
          status: 'VERIFIED',
        }),
      }),
    );
  });
  it('binds a login identity independently of verification and rejects cross-purpose completion', async () => {
    settings.AUTH_LOGIN_METHODS = 'campusOAuth';
    const start = await service.startBinding('alice');
    const handoff = await service.callback({
      state: new URL(start.authorizationUrl).searchParams.get('state')!,
      code: 'code',
    });
    await expect(service.complete('alice', handoff)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    settings.CAMPUS_VERIFICATION_METHODS = '';
    await expect(
      service.completeBinding('bob', handoff),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.completeBinding('alice', handoff)).resolves.toEqual({
      completed: true,
    });
    expect(identities.campus).toHaveBeenCalledWith(
      tx,
      expect.any(String),
      'alice',
    );
    expect(tx.studentVerification.findUnique).not.toHaveBeenCalled();
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
    await expect(
      service.completeBinding('alice', handoff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('applies the login allowlist to binding start, callback and completion', async () => {
    await expect(service.startBinding('alice')).rejects.toMatchObject({
      response: { code: 'LOGIN_METHOD_DISABLED' },
    });
    settings.AUTH_LOGIN_METHODS = 'campusOAuth';
    const first = await service.startBinding('alice');
    settings.AUTH_LOGIN_METHODS = '';
    await expect(
      service.callback({
        state: new URL(first.authorizationUrl).searchParams.get('state')!,
        code: 'code',
      }),
    ).rejects.toMatchObject({ response: { code: 'LOGIN_METHOD_DISABLED' } });
    settings.AUTH_LOGIN_METHODS = 'campusOAuth';
    const second = await service.startBinding('alice');
    const handoff = await service.callback({
      state: new URL(second.authorizationUrl).searchParams.get('state')!,
      code: 'code',
    });
    settings.AUTH_LOGIN_METHODS = '';
    await expect(
      service.completeBinding('alice', handoff),
    ).rejects.toMatchObject({ response: { code: 'LOGIN_METHOD_DISABLED' } });
    expect(identities.campus).not.toHaveBeenCalled();
  });
  it('checks the verification policy again after the login callback', async () => {
    const { ticket } = await anonymousHandoff();
    settings.CAMPUS_VERIFICATION_METHODS = 'campusEmail';
    await expect(service.login(ticket)).resolves.toEqual({ id: 'campus-user' });
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('does not modify an existing qualification when OAuth verification is disabled', async () => {
    const { ticket } = await anonymousHandoff();
    previousVerification = {
      userId: 'campus-user',
      status: 'VERIFIED',
      updatedAt: new Date(0),
      reviewedAt: null,
    };
    settings.CAMPUS_VERIFICATION_METHODS = '';
    await service.login(ticket);
    expect(tx.studentVerification.findUnique).not.toHaveBeenCalled();
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
  it('allows login without transferring a campus qualification belonging to another account', async () => {
    const { ticket } = await anonymousHandoff();
    subjectOwner = { userId: 'qualification-only-owner' };
    await expect(service.login(ticket)).resolves.toEqual({ id: 'campus-user' });
    expect(tx.studentVerification.upsert).not.toHaveBeenCalled();
  });
});
