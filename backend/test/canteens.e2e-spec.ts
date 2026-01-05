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

    it('should support pagination for window dishes', async () => {
      const response = await request(app.getHttpServer())
        .get(`/windows/${testWindowId}/dishes?page=1&pageSize=5`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should handle invalid window id gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/windows/invalid-id/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`);

      // Accept either 404 or 200 with empty results
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Authorization Tests', () => {
    it('should require authentication for canteen list', async () => {
      await request(app.getHttpServer()).get('/canteens').expect(401);
    });

    it('should require authentication for canteen details', async () => {
      await request(app.getHttpServer())
        .get(`/canteens/${testCanteenId}`)
        .expect(401);
    });

    it('should require authentication for window details', async () => {
      await request(app.getHttpServer())
        .get(`/windows/${testWindowId}`)
        .expect(401);
    });
  });

  describe('Query Parameters', () => {
    it('should filter canteens by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens?name=第一')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should handle valid page numbers', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens?page=1')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should handle invalid page size gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens?pageSize=0')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty window list', async () => {
      // Try to get windows from a canteen that might not have any
      const canteens = await prisma.canteen.findMany();

      for (const canteen of canteens) {
        const windows = await prisma.window.findMany({
          where: { canteenId: canteen.id },
        });

        if (windows.length === 0) {
          const response = await request(app.getHttpServer())
            .get(`/canteens/${canteen.id}/windows`)
            .set('Authorization', `Bearer ${userAccessToken}`)
            .expect(200);

          expect(response.body.code).toBe(200);
          expect(response.body.data.items).toEqual([]);
          break;
        }
      }
    });

    it('should return consistent data structure for empty results', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens?page=9999')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });
  });

  describe('Advanced Queries', () => {
    it('should filter canteens by partial name', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens?name=食堂')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should handle pagination with page and pageSize', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens?page=1&pageSize=2')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeLessThanOrEqual(2);
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(2);
    });

    it('should return correct total count', async () => {
      const response = await request(app.getHttpServer())
        .get('/canteens?page=1&pageSize=1')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.meta.total).toBeGreaterThan(0);
      expect(response.body.data.meta.totalPages).toBeGreaterThan(0);
    });
  });

  describe('Window Dishes Queries', () => {
    it('should return dishes with correct structure', async () => {
      const response = await request(app.getHttpServer())
        .get(`/windows/${testWindowId}/dishes`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      if (response.body.data.items.length > 0) {
        const dish = response.body.data.items[0];
        expect(dish).toHaveProperty('id');
        expect(dish).toHaveProperty('name');
      }
    });

    it('should handle dishes pagination correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/windows/${testWindowId}/dishes?page=1&pageSize=3`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeLessThanOrEqual(3);
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(3);
    });

    it('should return empty list for non-existent window', async () => {
      const response = await request(app.getHttpServer())
        .get('/windows/non-existent-window-id/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`);

      // Should either return 200 with empty list or 404
      if (response.status === 200) {
        expect(response.body.data.items).toEqual([]);
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe('Canteen Structure', () => {
    it('should include windows in canteen details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/canteens/${testCanteenId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toHaveProperty('windows');
      expect(Array.isArray(response.body.data.windows)).toBe(true);
    });

    it('should include required canteen fields', async () => {
      const response = await request(app.getHttpServer())
        .get(`/canteens/${testCanteenId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('position');
    });

    it('should include window details in canteen windows endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/canteens/${testCanteenId}/windows`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      if (response.body.data.items.length > 0) {
        const window = response.body.data.items[0];
        expect(window).toHaveProperty('id');
        expect(window).toHaveProperty('name');
      }
    });
  });
});
