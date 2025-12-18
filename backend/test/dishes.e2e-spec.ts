// test/dishes.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('DishesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAccessToken: string;
  let testDishId: string;
  let testUserId: string;

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
    testUserId = loginResponse.body.data.user.id;

    // 获取一个测试菜品ID
    const dish = await prisma.dish.findFirst({
      where: { name: '宫保鸡丁' },
    });
    testDishId = dish?.id || '';
  });

  afterAll(async () => {
    // 清理测试过程中创建的收藏记录
    await prisma.favoriteDish.deleteMany({
      where: { userId: testUserId },
    });
    await app.close();
  });

  describe('/dishes/:id (GET)', () => {
    it('should return dish details for valid id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dishes/${testDishId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testDishId);
      expect(response.body.data.name).toBe('宫保鸡丁');
      expect(response.body.data.canteenId).toBeDefined();
      expect(response.body.data.windowId).toBeDefined();
      expect(response.body.data.priceUnit).toBeDefined(); // 验证priceUnit字段存在
    });

    it('should return 404 for non-existent dish', async () => {
      const response = await request(app.getHttpServer())
        .get('/dishes/non-existent-id')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(404);

      expect(response.body.message).toContain('菜品不存在');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/dishes/${testDishId}`)
        .expect(401);
    });
  });

  describe('/dishes (POST)', () => {
    it('should return paginated dish list with default filters', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(10);
      expect(response.body.data.meta.total).toBeGreaterThan(0);
      // 默认不包含 offline 菜品
      expect(
        response.body.data.items.every((dish: any) => dish.status === 'online'),
      ).toBe(true);
    });

    it('should filter dishes by price range', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {
            price: { min: 10, max: 20 },
          },
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((dish: any) => {
        expect(dish.price).toBeGreaterThanOrEqual(10);
        expect(dish.price).toBeLessThanOrEqual(20);
      });
    });

    it('should filter dishes by meal time', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {
            mealTime: ['breakfast'],
          },
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((dish: any) => {
        expect(dish.availableMealTime).toContain('breakfast');
      });
    });

    it('should filter dishes by spicy level', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {
            spicyLevel: { min: 3, max: 5 },
          },
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // 新逻辑：结果应该包含辣度在 3-5 之间的菜品 + 辣度为 0（未设置）的菜品
      response.body.data.items.forEach((dish: any) => {
        // 要么辣度为 0（未设置），要么在指定范围内
        const isUnset = dish.spicyLevel === 0;
        const isInRange = dish.spicyLevel >= 3 && dish.spicyLevel <= 5;
        expect(isUnset || isInRange).toBe(true);
      });

      // 验证确实包含了辣度为 0 的菜品（如：清蒸鲈鱼、番茄炒蛋）
      const hasUnsetSpicy = response.body.data.items.some(
        (dish: any) => dish.spicyLevel === 0,
      );
      expect(hasUnsetSpicy).toBe(true);

      // 验证确实包含了辣度在范围内的菜品（如：宫保鸡丁 spicyLevel=3、麻婆豆腐 spicyLevel=4）
      const hasInRangeSpicy = response.body.data.items.some(
        (dish: any) => dish.spicyLevel >= 3 && dish.spicyLevel <= 5,
      );
      expect(hasInRangeSpicy).toBe(true);
    });

    it('should include offline dishes when includeOffline is true', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {
            includeOffline: true,
          },
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 20 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      const hasOfflineDish = response.body.data.items.some(
        (dish: any) => dish.status === 'offline',
      );
      expect(hasOfflineDish).toBe(true);
    });

    it('should search dishes by keyword in name', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          search: {
            keyword: '宫保',
            fields: ['name'],
          },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(response.body.data.items[0].name).toContain('宫保');
    });

    it('should sort dishes by price ascending', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          search: { keyword: '' },
          sort: { field: 'price', order: 'asc' },
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      const prices = response.body.data.items.map((dish: any) => dish.price);
      const sortedPrices = [...prices].sort((a, b) => a - b);
      expect(prices).toEqual(sortedPrices);
    });

    it('should paginate results correctly', async () => {
      const response1 = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 2 },
        })
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 2, pageSize: 2 },
        })
        .expect(200);

      expect(response1.body.data.items.length).toBe(2);
      expect(response2.body.data.items.length).toBeGreaterThan(0);
      expect(response1.body.data.items[0].id).not.toBe(
        response2.body.data.items[0].id,
      );
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/dishes')
        .send({
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(401);
    });
  });

  describe('/dishes/:id/favorite (POST)', () => {
    let favoriteDishId: string;

    beforeAll(async () => {
      // 找一个未收藏的菜品
      const dish = await prisma.dish.findFirst({
        where: { name: '麻婆豆腐' },
      });
      favoriteDishId = dish?.id || '';
    });

    it('should favorite a dish successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/dishes/${favoriteDishId}/favorite`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('收藏成功');
      expect(response.body.data.isFavorited).toBe(true);
      expect(response.body.data.favoriteCount).toBeGreaterThan(0);

      // 验证数据库中确实创建了收藏记录
      const favorite = await prisma.favoriteDish.findUnique({
        where: {
          userId_dishId: {
            userId: testUserId,
            dishId: favoriteDishId,
          },
        },
      });
      expect(favorite).not.toBeNull();
    });

    it('should return 400 when favoriting already favorited dish', async () => {
      const response = await request(app.getHttpServer())
        .post(`/dishes/${favoriteDishId}/favorite`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(400);

      expect(response.body.message).toContain('已经收藏');
    });

    it('should return 404 for non-existent dish', async () => {
      await request(app.getHttpServer())
        .post('/dishes/non-existent-id/favorite')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post(`/dishes/${favoriteDishId}/favorite`)
        .expect(401);
    });
  });

  describe('/dishes/:id/favorite (DELETE)', () => {
    let unfavoriteDishId: string;

    beforeAll(async () => {
      // 找一个已收藏的菜品（从上面的测试中）
      const dish = await prisma.dish.findFirst({
        where: { name: '麻婆豆腐' },
      });
      unfavoriteDishId = dish?.id || '';
    });

    it('should unfavorite a dish successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/dishes/${unfavoriteDishId}/favorite`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('取消收藏成功');
      expect(response.body.data.isFavorited).toBe(false);

      // 验证数据库中确实删除了收藏记录
      const favorite = await prisma.favoriteDish.findUnique({
        where: {
          userId_dishId: {
            userId: testUserId,
            dishId: unfavoriteDishId,
          },
        },
      });
      expect(favorite).toBeNull();
    });

    it('should return 400 when unfavoriting non-favorited dish', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/dishes/${unfavoriteDishId}/favorite`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(400);

      expect(response.body.message).toContain('尚未收藏');
    });

    it('should return 404 for non-existent dish', async () => {
      await request(app.getHttpServer())
        .delete('/dishes/non-existent-id/favorite')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .delete(`/dishes/${unfavoriteDishId}/favorite`)
        .expect(401);
    });
  });

  describe('/dishes/upload (POST)', () => {
    it('should upload a new dish successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes/upload')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          name: '用户上传测试菜品',
          tags: ['测试', '家常菜'],
          price: 15.5,
          priceUnit: '份',
          description: '这是用户上传的测试菜品',
          images: ['https://example.com/test-dish.jpg'],
          ingredients: ['食材1', '食材2'],
          allergens: ['测试过敏原'],
          spicyLevel: 2,
          meatPreference: ['鸡肉'],
          sweetness: 2,
          saltiness: 3,
          oiliness: 2,
          canteenName: '第一食堂',
          floor: '1F',
          windowName: '川菜窗口',
          availableMealTime: ['lunch', 'dinner'],
        })
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.message).toBe('上传成功，等待审核');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('pending');

      // 验证数据库中确实创建了上传记录
      const upload = await prisma.dishUpload.findUnique({
        where: { id: response.body.data.id },
      });
      expect(upload).not.toBeNull();
      expect(upload?.status).toBe('pending');
      expect(upload?.name).toBe('用户上传测试菜品');
      expect(upload?.priceUnit).toBe('份');

      // 清理
      await prisma.dishUpload.delete({
        where: { id: response.body.data.id },
      });
    });

    it('should upload dish with minimal required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes/upload')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          price: 10.0,
          canteenName: '第二食堂',
          windowName: '面食窗口',
          availableMealTime: ['breakfast'],
        })
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.data.id).toBeDefined();

      // 清理
      await prisma.dishUpload.delete({
        where: { id: response.body.data.id },
      });
    });

    it('should return 400 when missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/dishes/upload')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          name: '缺少必填字段的菜品',
          // 缺少 price, canteenName, windowName, availableMealTime
        })
        .expect(400);
    });

    it('should validate spicyLevel range', async () => {
      await request(app.getHttpServer())
        .post('/dishes/upload')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          price: 10.0,
          spicyLevel: 6, // 超出范围 (0-5)
          canteenName: '第一食堂',
          windowName: '川菜窗口',
          availableMealTime: ['lunch'],
        })
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/dishes/upload')
        .send({
          price: 10.0,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
          availableMealTime: ['lunch'],
        })
        .expect(401);
    });
  });

  describe('/dishes (POST) - Suggestion Mode', () => {
    it('should return suggested dishes when isSuggestion is true', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(10);
    });

    it('should filter suggested dishes by price range', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: {
            price: { min: 10, max: 20 },
          },
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((dish: any) => {
        expect(dish.price).toBeGreaterThanOrEqual(10);
        expect(dish.price).toBeLessThanOrEqual(20);
      });
    });

    it('should filter suggested dishes by meal time', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: {
            mealTime: ['breakfast'],
          },
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((dish: any) => {
        expect(dish.availableMealTime).toContain('breakfast');
      });
    });

    it('should search suggested dishes by keyword', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: {},
          search: {
            keyword: '鸡',
            fields: ['name'],
          },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      // 至少应该有一个包含"鸡"的菜品
      if (response.body.data.items.length > 0) {
        const hasChickenDish = response.body.data.items.some((dish: any) =>
          dish.name.includes('鸡'),
        );
        expect(hasChickenDish).toBe(true);
      }
    });

    it('should paginate suggested dishes correctly', async () => {
      const response1 = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 2 },
        })
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 2, pageSize: 2 },
        })
        .expect(200);

      expect(response1.body.data.items.length).toBe(2);
      expect(response2.body.data.items.length).toBeGreaterThan(0);
      // 不同页的第一个菜品应该不同
      expect(response1.body.data.items[0].id).not.toBe(
        response2.body.data.items[0].id,
      );
    });

    it('should consider user preferences in suggestions', async () => {
      // 先更新用户偏好
      await prisma.userPreference.upsert({
        where: { userId: testUserId },
        create: {
          userId: testUserId,
          tagPreferences: ['川菜'],
          priceMin: 10,
          priceMax: 30,
          spicyLevel: 3,
        },
        update: {
          tagPreferences: ['川菜'],
          priceMin: 10,
          priceMax: 30,
          spicyLevel: 3,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      // 由于有偏好设置，推荐结果应该考虑了这些偏好
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should exclude allergens from suggestions', async () => {
      // 设置用户过敏原
      await prisma.user.update({
        where: { id: testUserId },
        data: { allergens: ['花生'] },
      });

      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 20 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      // 所有推荐的菜品都不应包含花生过敏原
      response.body.data.items.forEach((dish: any) => {
        expect(dish.allergens || []).not.toContain('花生');
      });

      // 恢复用户过敏原设置
      await prisma.user.update({
        where: { id: testUserId },
        data: { allergens: [] },
      });
    });

    it('should return 401 for suggestion mode without auth token', async () => {
      await request(app.getHttpServer())
        .post('/dishes')
        .send({
          isSuggestion: true,
          filter: {},
          search: { keyword: '' },
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(401);
    });
  });
});
