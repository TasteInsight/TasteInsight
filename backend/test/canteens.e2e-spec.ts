// test/canteens.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('CanteensController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAccessToken: string;
  let testCanteenId: string;
  let testWindowId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // 获取测试用户登录token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' });

    userAccessToken = loginResponse.body.data.token.accessToken;

    // 获取测试食堂ID
    const canteen = await prisma.canteen.findFirst({
      where: { name: '第一食堂' },
    });
    testCanteenId = canteen?.id || '';

    // 获取测试窗口ID
    const window = await prisma.window.findFirst({
      where: { name: '川菜窗口' },
    });
    testWindowId = window?.id || '';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/canteens (GET)', () => {
    it('should return canteen list', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('获取食堂列表成功');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens?page=1&pageSize=1')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeLessThanOrEqual(1);
    });
  });

  describe('/canteens/:id (GET)', () => {
    it('should return canteen details for valid id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/canteens/${testCanteenId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('获取食堂详情成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('第一食堂');
    });

    it('should return 404 for invalid id', async () => {
      await request(app.getHttpServer())
        .get('/canteens/invalid-id')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(404);
    });
  });

  describe('/canteens/:id/windows (GET)', () => {
    it('should return windows for valid canteen id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/canteens/${testCanteenId}/windows`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('获取食堂窗口列表成功');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });
  });

  describe('/windows/:id (GET)', () => {
    it('should return window details for valid id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/windows/${testWindowId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('获取窗口详情成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('川菜窗口');
    });

    it('should return 404 for invalid window id', async () => {
      await request(app.getHttpServer())
        .get('/windows/invalid-id')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(404);
    });
  });

  describe('/windows/:id/dishes (GET)', () => {
    it('should return dishes for valid window id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/windows/${testWindowId}/dishes`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('获取窗口菜品列表成功');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });
  });
});
