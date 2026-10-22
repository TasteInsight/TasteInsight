import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import request from 'supertest';
import { PrismaService } from '@/prisma.service';
import { AuthService } from '@/auth/auth.service';
import { PublicAuthController } from '@/auth/public-auth.controller';
import { UserIdentityService } from '@/auth/user-identity.service';
import { VerificationChallengeService } from '@/auth/verification-challenge.service';
import { CampusOAuthService } from '@/campus-identity/campus-oauth.service';
import { UserProfileService } from '@/user-profile/user-profile.service';

describe('default user nicknames (PostgreSQL)', () => {
  const db = new PrismaService();
  const prefix = `nickname-${randomUUID()}`;
  const userIds = new Set<string>();
  const nicknames = new Set<string>();
  const pattern = /^(?:食友|Foodie)_[0-9a-f]{12}$/;
  const config = new ConfigService({
    JWT_SECRET: 'nickname-test-access-secret',
    JWT_REFRESH_SECRET: 'nickname-test-refresh-secret',
    AUTH_LOGIN_METHODS: 'wechatMiniapp,wechatApp',
    WECHAT_APPID: 'mini-app',
    WECHAT_SECRET: 'mini-secret',
    WECHAT_APP_APPID: 'mobile-app',
    WECHAT_APP_SECRET: 'mobile-secret',
    CAMPUS_OAUTH_ISSUER: 'https://school.example',
  });
  const http = {
    get: jest.fn((_url, { params }) =>
      of({
        data: {
          openid: `${prefix}-${params.appid}-${params.js_code ?? params.code}`,
        },
      }),
    ),
  };
  const identities = new UserIdentityService(
    db,
    config,
    http as unknown as HttpService,
  );
  const profiles = new UserProfileService(db);
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicAuthController],
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: db },
        { provide: ConfigService, useValue: config },
        { provide: UserIdentityService, useValue: identities },
        { provide: UserProfileService, useValue: profiles },
        { provide: VerificationChallengeService, useValue: {} },
        { provide: CampusOAuthService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [...userIds] } } });
    await app.close();
  });

  it.each([
    ['zh-CN', '食友'],
    ['en-US', 'Foodie'],
    ['en;q=0.8,zh-Hans;q=0.9', '食友'],
    ['zh;q=0,en;q=1', 'Foodie'],
    ['fr-FR', 'Foodie'],
    [undefined, '食友'],
  ])(
    'uses language %s for the first login and persists the nickname',
    async (language, prefix) => {
      const login = (acceptLanguage = language) => {
        const call = request(app.getHttpServer())
          .post('/auth/wechat/login')
          .send({ code: `http-provider-${language}` });
        if (acceptLanguage) call.set('Accept-Language', acceptLanguage);
        return call.expect(200);
      };
      const { body } = await login();
      const user = body.data.user;
      userIds.add(user.id);
      expect(user.nickname).toMatch(new RegExp(`^${prefix}_[0-9a-f]{12}$`));
      expect(body.data.token.accessToken).toEqual(expect.any(String));
      expect(
        await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).toMatchObject({
        nickname: user.nickname,
      });
      expect(
        (await login(prefix === '食友' ? 'en-US' : 'zh-CN')).body.data.user,
      ).toMatchObject({
        id: user.id,
        nickname: user.nickname,
      });
    },
  );

  it.each([
    ['WeChat mini-program', '食友', () => identities.wechat('provider-code')],
    [
      'WeChat app',
      'Foodie',
      () => identities.wechat('provider-code', 'app', undefined, 'en'),
    ],
    [
      'phone',
      'Foodie',
      () => identities.phone('+8613987000001', undefined, 'en'),
    ],
    [
      'campus',
      'Foodie',
      () =>
        db.$transaction((tx) => identities.campus(tx, prefix, undefined, 'en')),
    ],
  ] as const)(
    'persists a distinct nickname for %s and preserves it on subsequent logins',
    async (_channel, expectedPrefix, login) => {
      const user = await login();
      userIds.add(user.id);
      expect(user.nickname).toMatch(pattern);
      expect(user.nickname.startsWith(`${expectedPrefix}_`)).toBe(true);
      expect(nicknames.has(user.nickname)).toBe(false);
      nicknames.add(user.nickname);
      expect((await profiles.getUserProfile(user.id)).data.nickname).toBe(
        user.nickname,
      );
      expect(await login()).toMatchObject({
        id: user.id,
        nickname: user.nickname,
      });
      await db.user.update({
        where: { id: user.id },
        data: { nickname: '自选昵称' },
      });
      expect(await login()).toMatchObject({
        id: user.id,
        nickname: '自选昵称',
      });
    },
  );

  it('keeps one account and nickname during concurrent first logins', async () => {
    const users = await Promise.all([
      identities.phone('+8613987000002'),
      identities.phone('+8613987000002'),
    ]);
    for (const user of users) userIds.add(user.id);
    expect(users[0].nickname).toMatch(pattern);
    expect(users[1]).toMatchObject({
      id: users[0].id,
      nickname: users[0].nickname,
    });
  });

  it('backfills legacy placeholders and supplies defaults while preserving chosen names', async () => {
    const schema = `nickname_${randomUUID().replaceAll('-', '')}`;
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}`);
      await tx.$executeRawUnsafe(
        'CREATE TABLE users (id TEXT PRIMARY KEY, nickname TEXT NOT NULL, "updatedAt" TIMESTAMP NOT NULL)',
      );
      await tx.$executeRaw`INSERT INTO users VALUES
        ('legacy-a', '新用户', '2020-01-01'),
        ('legacy-b', '新用户', '2020-01-01'),
        ('custom', '自选昵称', '2020-01-01')`;
      const sql = readFileSync(
        resolve(
          __dirname,
          '../prisma/migrations/20261022000100_default_user_nickname/migration.sql',
        ),
        'utf8',
      );
      const migrate = async () => {
        for (const statement of sql.split(';').filter((part) => part.trim()))
          await tx.$executeRawUnsafe(statement);
      };
      await migrate();
      await tx.$executeRaw`INSERT INTO users (id, "updatedAt") VALUES
        ('new-a', CURRENT_TIMESTAMP), ('new-b', CURRENT_TIMESTAMP)`;
      const rows = await tx.$queryRaw<
        { id: string; nickname: string; updatedAt: Date }[]
      >`SELECT * FROM users ORDER BY id`;
      const generated = rows.filter((row) => row.id !== 'custom');
      for (const row of generated) expect(row.nickname).toMatch(pattern);
      expect(new Set(generated.map((row) => row.nickname)).size).toBe(4);
      expect(rows.find((row) => row.id === 'custom')).toEqual({
        id: 'custom',
        nickname: '自选昵称',
        updatedAt: new Date('2020-01-01T00:00:00Z'),
      });
      expect(
        rows.find((row) => row.id === 'legacy-a')!.updatedAt.getTime(),
      ).toBeGreaterThan(new Date('2020-01-01T00:00:00Z').getTime());
      await migrate();
      expect(await tx.$queryRaw`SELECT * FROM users ORDER BY id`).toEqual(rows);
      await tx.$executeRawUnsafe(`DROP SCHEMA ${schema} CASCADE`);
    });
  });
});
