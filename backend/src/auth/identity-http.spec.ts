import {
  INestApplication,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '@/prisma.service';
import { CampusIdentityController } from '@/campus-identity/campus-identity.controller';
import { AdminStudentVerificationController } from '@/campus-identity/admin-student-verification.controller';
import { CampusIdentityService } from '@/campus-identity/campus-identity.service';
import { CampusOAuthService } from '@/campus-identity/campus-oauth.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentityController } from './identity.controller';
import { UserIdentityService } from './user-identity.service';
import { VerificationChallengeService } from './verification-challenge.service';

describe('Identity HTTP contracts', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const secret = 'http-contract-access-secret'.repeat(2);
  const auth = {
    phoneLogin: jest.fn(),
    wechatLogin: jest.fn(),
    adminLogin: jest.fn(),
    refreshToken: jest.fn(),
  };
  const challenges = { issue: jest.fn(), consume: jest.fn() };
  const identities = { list: jest.fn(), phone: jest.fn(), wechat: jest.fn() };
  const campus = {
    status: jest.fn(),
    emailChallenge: jest.fn(),
    submitEmail: jest.fn(),
    list: jest.fn(),
    decide: jest.fn(),
  };
  const oauth = { start: jest.fn(), callback: jest.fn(), complete: jest.fn() };
  const admin = { findUnique: jest.fn() };
  const bearer = (sub = 'user', type = 'user') =>
    `Bearer ${jwt.sign({ sub, type, tokenUse: 'access' }, { secret })}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        IdentityController,
        CampusIdentityController,
        AdminStudentVerificationController,
      ],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: VerificationChallengeService, useValue: challenges },
        { provide: UserIdentityService, useValue: identities },
        { provide: CampusIdentityService, useValue: campus },
        { provide: CampusOAuthService, useValue: oauth },
        { provide: PrismaService, useValue: { admin } },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: secret }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    challenges.issue.mockResolvedValue({
      challengeId: 'challenge',
      expiresIn: 300,
      retryAfter: 60,
    });
    campus.status.mockResolvedValue({
      status: 'UNVERIFIED',
      canContribute: false,
    });
    campus.submitEmail.mockResolvedValue({
      status: 'PENDING',
      canContribute: false,
    });
    campus.list.mockResolvedValue({ items: [], meta: { total: 0 } });
    oauth.callback.mockResolvedValue({
      attemptId: 'attempt',
      handoffCode: 'a'.repeat(43),
      handoffExpiresAt: new Date(Date.now() + 180000).toISOString(),
      clientOrigin: 'https://app.example.org',
      account: { id: 'alice', nickname: '校园用户', phone: '+86****5678' },
    });
    oauth.complete.mockResolvedValue({ completed: true, status: 'VERIFIED' });
    admin.findUnique.mockResolvedValue({
      id: 'admin',
      username: 'admin',
      role: 'admin',
      canteenId: null,
      permissions: [{ permission: 'student:review' }],
    });
  });

  it('advertises no unconfigured production login channels', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/capabilities')
      .expect(200);
    expect(response.body.data).toEqual({
      phone: false,
      wechatMiniapp: false,
      wechatApp: false,
      campusEmail: false,
      campusOAuth: false,
    });
  });
  it('validates phone input and never accepts client-selected identity or privileges', async () => {
    await request(app.getHttpServer())
      .post('/auth/phone/challenges')
      .send({ phone: '13812345678' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/phone/login')
      .send({ challengeId: 'id', code: '123456', isStudent: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'code', platform: 'app', openid: 'chosen-by-client' })
      .expect(400);
    expect(auth.phoneLogin).not.toHaveBeenCalled();
    expect(auth.wechatLogin).not.toHaveBeenCalled();
  });
  it('issues an unbound phone-login challenge from the transport client IP', async () => {
    await request(app.getHttpServer())
      .post('/auth/phone/challenges')
      .set('X-Forwarded-For', 'attacker-selected')
      .send({ phone: '+8613812345678' })
      .expect(200);
    expect(challenges.issue).toHaveBeenCalledWith(
      'PHONE_LOGIN',
      '+8613812345678',
      expect.any(String),
    );
    expect(challenges.issue.mock.calls[0][2]).not.toBe('attacker-selected');
  });
  it('requires user authentication for linking and campus applications', async () => {
    await request(app.getHttpServer()).get('/user/identities').expect(401);
    await request(app.getHttpServer())
      .post('/user/student-verification')
      .send({ challengeId: 'id', code: '123456' })
      .expect(401);
    expect(campus.submitEmail).not.toHaveBeenCalled();
  });
  it('binds phone challenges to the authenticated principal, never a supplied user ID', async () => {
    await request(app.getHttpServer())
      .post('/user/identities/phone/challenges')
      .set('Authorization', bearer('alice'))
      .send({ phone: '+8613812345678' })
      .expect(200);
    expect(challenges.issue).toHaveBeenCalledWith(
      'PHONE_BIND',
      '+8613812345678',
      expect.any(String),
      'alice',
    );
    await request(app.getHttpServer())
      .post('/user/identities/phone/challenges')
      .set('Authorization', bearer('alice'))
      .send({ phone: '+8613812345678', userId: 'bob' })
      .expect(400);
  });
  it('returns only the students own certification state and accepts email evidence without self-approval', async () => {
    await request(app.getHttpServer())
      .get('/user/student-verification')
      .set('Authorization', bearer('alice'))
      .expect(200);
    expect(campus.status).toHaveBeenCalledWith('alice');
    await request(app.getHttpServer())
      .post('/user/student-verification')
      .set('Authorization', bearer('alice'))
      .send({ challengeId: 'id', code: '123456', status: 'VERIFIED' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .post('/user/student-verification')
      .set('Authorization', bearer('alice'))
      .send({ challengeId: 'id', code: '123456' })
      .expect(200);
    expect(response.body.data.status).toBe('PENDING');
    expect(campus.submitEmail).toHaveBeenCalledWith('alice', 'id', '123456');
  });
  it('returns the handoff only as an uncached callback page without granting qualification', async () => {
    const response = await request(app.getHttpServer())
      .get('/user/student-verification/oauth/callback')
      .query({ state: 'opaque-state', code: 'provider-code' })
      .set('Accept', 'application/json')
      .expect(200);
    expect(oauth.callback).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'opaque-state', code: 'provider-code' }),
    );
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('确认学生身份绑定');
    expect(response.text).toContain('尚未授予学生权限');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['content-security-policy']).toMatch(
      /script-src 'nonce-[A-Za-z0-9+/=]+'/,
    );
    expect(oauth.complete).not.toHaveBeenCalled();
  });
  it('renders fixed Chinese browser callback copy without reflecting provider or user input', async () => {
    const response = await request(app.getHttpServer())
      .get('/user/student-verification/oauth/callback')
      .query({ state: 'state', code: '<script>private-code</script>' })
      .set('Accept', 'text/html')
      .expect(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('确认学生身份绑定');
    expect(response.text).not.toContain('private-code');
    oauth.callback.mockRejectedValueOnce(
      new BadRequestException('provider-private-error'),
    );
    const failed = await request(app.getHttpServer())
      .get('/user/student-verification/oauth/callback')
      .query({ state: 'state', error: 'access_denied' })
      .set('Accept', 'text/html')
      .expect(400);
    expect(failed.text).toContain('认证未完成');
    expect(failed.text).not.toContain('provider-private-error');
  });
  it('passes only the authenticated owner and validated handoff fields to completion', async () => {
    const data = { attemptId: 'attempt', handoffCode: 'a'.repeat(43) };
    await request(app.getHttpServer())
      .post('/user/student-verification/oauth/complete')
      .send(data)
      .expect(401);
    await request(app.getHttpServer())
      .post('/user/student-verification/oauth/complete')
      .set('Authorization', bearer('alice'))
      .send({ ...data, userId: 'bob' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/user/student-verification/oauth/complete')
      .set('Authorization', bearer('alice'))
      .send({ ...data, handoffCode: '123456' })
      .expect(400);
    expect(oauth.complete).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/user/student-verification/oauth/complete')
      .set('Authorization', bearer('alice'))
      .send(data)
      .expect(200);
    expect(oauth.complete).toHaveBeenCalledWith('alice', data);
  });
  it('takes the postMessage origin from the start request transport header', async () => {
    await request(app.getHttpServer())
      .post('/user/student-verification/oauth')
      .set('Authorization', bearer('alice'))
      .set('Origin', 'https://app.example.org')
      .send({})
      .expect(200);
    expect(oauth.start).toHaveBeenCalledWith(
      'alice',
      'https://app.example.org',
    );
  });
  it('escapes account text without inserting values into the callback script', async () => {
    oauth.callback.mockResolvedValueOnce({
      attemptId: 'attempt',
      handoffCode: 'a'.repeat(43),
      handoffExpiresAt: new Date().toISOString(),
      clientOrigin: null,
      account: { id: 'alice', nickname: '</dd><script>alert(1)</script>' },
    });
    const response = await request(app.getHttpServer())
      .get('/user/student-verification/oauth/callback')
      .query({ state: 'state', code: 'code' })
      .expect(200);
    expect(response.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(response.text).not.toContain('<script>alert(1)</script>');
    expect(response.text).toContain("confirm.addEventListener('click'");
  });
  it('requires admin type, global scope and student-review permission', async () => {
    await request(app.getHttpServer())
      .get('/admin/student-verifications')
      .set('Authorization', bearer())
      .expect(403);
    admin.findUnique.mockResolvedValueOnce({
      id: 'admin',
      role: 'admin',
      canteenId: 'canteen',
      permissions: [{ permission: 'student:review' }],
    });
    await request(app.getHttpServer())
      .get('/admin/student-verifications')
      .set('Authorization', bearer('admin', 'admin'))
      .expect(403);
    admin.findUnique.mockResolvedValueOnce({
      id: 'admin',
      role: 'admin',
      canteenId: null,
      permissions: [],
    });
    await request(app.getHttpServer())
      .get('/admin/student-verifications')
      .set('Authorization', bearer('admin', 'admin'))
      .expect(403);
    expect(campus.list).not.toHaveBeenCalled();
  });
  it('allows the authorized global administrator to inspect bounded status-filtered applications', async () => {
    await request(app.getHttpServer())
      .get('/admin/student-verifications?status=VERIFIED&page=2&pageSize=10')
      .set('Authorization', bearer('admin', 'admin'))
      .expect(200);
    expect(campus.list).toHaveBeenCalledWith(2, 10, 'VERIFIED');
    await request(app.getHttpServer())
      .get('/admin/student-verifications?pageSize=1000')
      .set('Authorization', bearer('admin', 'admin'))
      .expect(400);
  });
});
