// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpService: HttpService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue({
        get: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    httpService = app.get<HttpService>(HttpService);
    app.useGlobalPipes(new ValidationPipe());
    await app.listen(0, '127.0.0.1');

    // 确保 baseline 和 secondary 用户存在（使用 upsert 以兼容 seed 数据和独立运行）
    // 同时恢复 nickname，因为其他测试可能会修改它
    await prisma.user.upsert({
      where: { openId: 'baseline_user_openid' },
      update: { nickname: 'Baseline User' },
      create: {
        openId: 'baseline_user_openid',
        nickname: 'Baseline User',
        avatar: 'https://example.com/avatar.jpg',
        allergens: ['芒果'],
      },
    });

    await prisma.user.upsert({
      where: { openId: 'secondary_user_openid' },
      update: { nickname: 'Secondary User' },
      create: {
        openId: 'secondary_user_openid',
        nickname: 'Secondary User',
        avatar: 'https://example.com/avatar2.jpg',
        allergens: [],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the test server listening on the IPv4 loopback used by Supertest', () => {
    expect(app.getHttpServer().address()).toMatchObject({
      address: '127.0.0.1',
      family: 'IPv4',
    });
  });

  describe('/auth/wechat/login (POST)', () => {
    // 在这个 describe 块结束后，清理本次测试创建的临时用户
    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { openId: { startsWith: 'mock_openid_for_' } },
      });
      // Clean up real wechat login user
      await prisma.user.deleteMany({
        where: { openId: 'real_openid_123' },
      });
    });

    it('should fail with 400 if code is not provided', () => {
      return request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({})
        .expect(400);
    });

    it('should create a new user and return tokens for a new wechat code', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'mock_valid_new_wechat_code' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token.accessToken).toBeDefined();
      expect(response.body.data.token.refreshToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.nickname).toMatch(/^食友_[0-9a-f]{12}$/);
      expect(response.body.data.user.capabilities.canContribute).toBe(false);

      const dbUser = await prisma.user.findUnique({
        where: { id: response.body.data.user.id },
        include: { studentVerification: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.nickname).toBe(response.body.data.user.nickname);
      expect(dbUser?.studentVerification).toBeNull();
    });

    it('should return tokens for an existing user (from seed)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        // auth.service 会把这个 code 模拟成 'baseline_user_openid'
        .send({ code: 'baseline_user_code_placeholder' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token.accessToken).toBeDefined();
      expect(response.body.data.token.refreshToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.nickname).toBe('Baseline User');
    });

    it('should return tokens for secondary user (from seed)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'secondary_user_code_placeholder' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data.user.nickname).toBe('Secondary User');
    });

    it('should return tokens for real wechat login (mocked success)', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: {
            openid: 'real_openid_123',
            session_key: 'session_key',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} },
        } as any),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'real_code_123' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data.user.openId).toBe('real_openid_123');
    });

    it('should fail for real wechat login (mocked failure - errcode)', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: {
            errcode: 40029,
            errmsg: 'invalid code',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} },
        } as any),
      );

      await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'invalid_real_code' })
        .expect(401);
    });

    it('should fail for real wechat login (mocked failure - network error)', async () => {
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => new Error('Network Error')));

      await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'network_error_code' })
        .expect(500);
    });
  });

  describe('/auth/admin/login (POST)', () => {
    it('should fail with 401 for wrong credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'testadmin', password: 'wrongpassword' })
        .expect(401);
    });

    it('should return tokens for correct credentials (from seed)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'testadmin', password: 'password123' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token.accessToken).toBeDefined();
      expect(response.body.data.token.refreshToken).toBeDefined();
      expect(response.body.data.admin).toBeDefined();
      expect(response.body.data.admin.username).toBe('testadmin');
      expect(response.body.data.admin).not.toHaveProperty('password');
      expect(response.body.data.permissions).toBeDefined();
      expect(Array.isArray(response.body.data.permissions)).toBe(true);
    });

    it('should fail with 401 for non-existent username', () => {
      return request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'nonexistent_admin', password: 'password123' })
        .expect(401);
    });

    it('should fail with 400 if username is not provided', () => {
      return request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ password: 'password123' })
        .expect(400);
    });

    it('should fail with 400 if password is not provided', () => {
      return request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'testadmin' })
        .expect(400);
    });

    it('should return selected scope and canonical canteen metadata', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'canteenadmin', password: 'canteen123' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data.admin).toBeDefined();
      expect(response.body.data.admin.scope).toBe('CANTEENS');
      expect(response.body.data.admin.canteens).toEqual([
        { id: expect.any(String), name: '第一食堂' },
      ]);
      expect(response.body.data.admin.canteenIds).toEqual(
        response.body.data.admin.canteens.map(
          (canteen: { id: string }) => canteen.id,
        ),
      );
      expect(response.body.data.admin).not.toHaveProperty('password');
    });

    it('should return explicit global scope with an empty canteen selection', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'testadmin', password: 'password123' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.admin).toBeDefined();
      expect(response.body.data.admin.scope).toBe('GLOBAL');
      expect(response.body.data.admin.canteenIds).toEqual([]);
      expect(response.body.data.admin.canteens).toEqual([]);
      expect(response.body.data.admin).not.toHaveProperty('password');
    });
  });

  describe('/auth/refresh (POST)', () => {
    let adminRefreshToken: string;
    let userAccessToken: string;
    let userRefreshToken: string;
    let jwtService: JwtService;

    // 同样，依赖 seed 创建的管理员进行登录，获取 token
    beforeAll(async () => {
      jwtService = app.get<JwtService>(JwtService);
      const adminResponse = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'testadmin', password: 'password123' });
      adminRefreshToken = adminResponse.body.data.token.refreshToken;

      const userResponse = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'baseline_user_code_placeholder' });
      userAccessToken = userResponse.body.data.token.accessToken;
      userRefreshToken = userResponse.body.data.token.refreshToken;
    });

    it('should return a new set of tokens for a valid admin refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${adminRefreshToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('刷新成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token.accessToken).toBeDefined();
      expect(response.body.data.token.refreshToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      // 新token应该存在
    });

    it('should return a new set of tokens for a valid user refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${userRefreshToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('刷新成功');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.nickname).toBe('Baseline User');
    });

    it('should fail with 401 if no token is provided', () => {
      return request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('should fail with 401 for an invalid token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should fail with 401 for a valid access token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(401);
    });

    it('should fail with 401 for an expired token', async () => {
      const admin = await prisma.admin.findUnique({
        where: { username: 'testadmin' },
      });
      if (!admin) {
        throw new Error('Seeded admin user not found');
      }
      const expiredToken = await jwtService.signAsync(
        {
          sub: admin.id,
          type: 'admin',
          sessionVersion: admin.sessionVersion,
          tokenUse: 'refresh',
        },
        // 故意签发一个立即过期的 token
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '0s' },
      );

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });
});
