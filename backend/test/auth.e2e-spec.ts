// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';        // <-- 【最终修正】将 `import * as request` 改为 `import request`
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthController (e2e)', () => {
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    // 注意：这里不再需要手动清空和创建数据
    // 我们假设 `pnpm test` 已经为我们运行了 seed 脚本
});

afterAll(async () => {
    await app.close();
});

describe('/auth/wechat/login (POST)', () => {
    // 在这个 describe 块结束后，清理本次测试创建的临时用户
    afterAll(async () => {
        await prisma.user.deleteMany({
            where: { openId: { startsWith: 'mock_openid_for_' } }
        });
    });

    it('should fail with 400 if code is not provided', () => {
    return request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({})
        .expect(400);
    });

    // 这个测试会【创建】一个新用户，属于"写"操作
    it('should create a new user and return tokens for a new wechat code', async () => {
    const response = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'a_valid_new_wechat_code' })
        .expect(200);

    expect(response.body.code).toBe(200);
    expect(response.body.message).toBe('登录成功');
    expect(response.body.data).toBeDefined();
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.token.accessToken).toBeDefined();
    expect(response.body.data.token.refreshToken).toBeDefined();
    expect(response.body.data.user).toBeDefined();
    expect(response.body.data.user.nickname).toContain('微信用户_');
    
    const dbUser = await prisma.user.findUnique({ where: { id: response.body.data.user.id } });
    expect(dbUser).not.toBeNull();
    });

    // 这个测试依赖【已存在】的用户，属于"读"操作，我们用 seed 创建的基础用户
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
});

describe('/auth/admin/login (POST)', () => {
    // 这个 describe 块的所有测试都只“读”由 seed 创建的管理员数据，无需清理

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
    let accessToken: string;
    let jwtService: JwtService;

    // 同样，依赖 seed 创建的管理员进行登录，获取 token
    beforeAll(async () => {
        jwtService = app.get<JwtService>(JwtService);
        const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'testadmin', password: 'password123' });
    accessToken = response.body.data.token.accessToken;
    });

    it('should return a new set of tokens for a valid token', async () => {
    // 等待1秒以确保新token的时间戳不同
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
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

    it('should fail with 401 if no token is provided', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);
    });

    it('should fail with 401 for an invalid token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should fail with 401 for an expired token', async () => {
      const admin = await prisma.admin.findUnique({ where: { username: 'testadmin' } });
      const expiredToken = await jwtService.signAsync(
        { sub: admin.id, type: 'admin' },
        // 故意签发一个立即过期的 token
        { secret: process.env.JWT_SECRET, expiresIn: '0s' }
      );

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
});
});
