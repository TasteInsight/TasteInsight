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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
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
      expect(response.body.data.user.nickname).toContain('微信用户_');

      const dbUser = await prisma.user.findUnique({
        where: { id: response.body.data.user.id },
      });
      expect(dbUser).not.toBeNull();
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
      expect(response.body.data.user.nickname).toBe('Basic Update Only');
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
          config: { headers: undefined },
        }),
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
          config: { headers: undefined },
        }),
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
  });

  describe('/auth/refresh (POST)', () => {
    let adminAccessToken: string;
    let userAccessToken: string;
    let jwtService: JwtService;

    // 同样，依赖 seed 创建的管理员进行登录，获取 token
    beforeAll(async () => {
      jwtService = app.get<JwtService>(JwtService);
      const adminResponse = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'testadmin', password: 'password123' });
      adminAccessToken = adminResponse.body.data.token.accessToken;

      const userResponse = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'baseline_user_code_placeholder' });
      userAccessToken = userResponse.body.data.token.accessToken;
    });

    it('should return a new set of tokens for a valid admin token', async () => {
      // 等待20ms以确保新token的时间戳不同（JWT时间戳有毫秒精度，无需等待1秒）
      await new Promise((resolve) => setTimeout(resolve, 20));

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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

    it('should return a new set of tokens for a valid user token', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('刷新成功');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.nickname).toBe('Basic Update Only');
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

    it('should fail with 401 for an expired token', async () => {
      const admin = await prisma.admin.findUnique({
        where: { username: 'testadmin' },
      });
      if (!admin) {
        throw new Error('Seeded admin user not found');
      }
      const expiredToken = await jwtService.signAsync(
        { sub: admin.id, type: 'admin' },
        // 故意签发一个立即过期的 token
        { secret: process.env.JWT_SECRET, expiresIn: '0s' },
      );

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });
});
