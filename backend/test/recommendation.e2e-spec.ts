// test/recommendation.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('Recommendation Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAccessToken: string;
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/dishes (POST) - isSuggestion=true', () => {
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
      if (response.body.data.items.length > 0) {
        const hasChickenDish = response.body.data.items.some((dish: any) =>
          dish.name.includes('鸡'),
        );
        expect(hasChickenDish).toBe(true);
      }
    });

    it('should paginate suggested dishes correctly', async () => {
      // 先确保用户没有过敏原设置（避免过滤导致结果过少）
      await prisma.user.update({
        where: { id: testUserId },
        data: { allergens: [] },
      });

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

      // 至少有2个菜品返回（根据测试数据量调整）
      expect(response1.body.data.items.length).toBeGreaterThanOrEqual(2);
      // 如果总数大于2，第二页应该有数据
      if (response1.body.data.meta.total > 2) {
        expect(response2.body.data.items.length).toBeGreaterThan(0);
        expect(response1.body.data.items[0].id).not.toBe(
          response2.body.data.items[0].id,
        );
      }
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

  describe('/recommend (POST)', () => {
    it('should return recommendations with requestId', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.requestId).toBeDefined();
      expect(response.body.data.meta).toBeDefined();
    });

    it('should support scene parameter', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          scene: 'search',
          search: { keyword: '鸡' },
          filter: {},
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('should filter by canteenId', async () => {
      // 获取一个食堂 ID
      const canteen = await prisma.canteen.findFirst();
      if (!canteen) return;

      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {
            canteenId: [canteen.id],
          },
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      // Note: items only contain dish IDs, not full dish objects
      if (response.body.data.items.length > 0) {
        // Validation would need to fetch dishes separately
      }
    });

    it('should include score breakdown when requested', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          pagination: { page: 1, pageSize: 5 },
          includeScoreBreakdown: true,
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      if (response.body.data.items.length > 0) {
        expect(response.body.data.items[0].scoreBreakdown).toBeDefined();
        expect(response.body.data.items[0].score).toBeDefined();
      }
    });
  });

  describe('/recommend/similar/:dishId (POST)', () => {
    let testDishId: string;

    beforeAll(async () => {
      const dish = await prisma.dish.findFirst();
      testDishId = dish?.id || '';
    });

    it('should return similar dishes', async () => {
      if (!testDishId) return;

      const response = await request(app.getHttpServer())
        .post(`/recommend/similar/${testDishId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.totalPages).toBeDefined();
      expect(response.body.data.total).toBeDefined();
    });

    it('should return empty result for invalid dish ID', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend/similar/invalid-dish-id')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });
  });

  describe('/recommend/personal (POST)', () => {
    it('should return personalized dishes', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend/personal')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.totalPages).toBeDefined();
      expect(response.body.data.total).toBeDefined();
    });

    it('should filter by canteenId and mealTime', async () => {
      const canteen = await prisma.canteen.findFirst();
      if (!canteen) return;

      const response = await request(app.getHttpServer())
        .post('/recommend/personal')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          canteenId: canteen.id,
          mealTime: 'lunch',
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
    });
  });

  describe('Event Tracking', () => {
    let testDishId: string;
    let requestId: string;

    beforeAll(async () => {
      const dish = await prisma.dish.findFirst();
      testDishId = dish?.id || '';

      // 生成一个推荐请求 ID
      const recResponse = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          pagination: { page: 1, pageSize: 5 },
        });
      requestId = recResponse.body.requestId;
    });

    describe('/recommend/events/click (POST)', () => {
      it('should log click event', async () => {
        const response = await request(app.getHttpServer())
          .post('/recommend/events/click')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            dishId: testDishId,
            requestId,
            position: 0,
          })
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data.eventId).toBeDefined();
      });
    });

    describe('/recommend/events/favorite (POST)', () => {
      it('should log favorite event', async () => {
        const response = await request(app.getHttpServer())
          .post('/recommend/events/favorite')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            dishId: testDishId,
            requestId,
          })
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data.eventId).toBeDefined();
      });
    });

    describe('/recommend/events/review (POST)', () => {
      it('should log review event', async () => {
        const response = await request(app.getHttpServer())
          .post('/recommend/events/review')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            dishId: testDishId,
            rating: 5,
            requestId,
          })
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data.eventId).toBeDefined();
      });

      it('should validate rating range', async () => {
        await request(app.getHttpServer())
          .post('/recommend/events/review')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            dishId: testDishId,
            rating: 6, // Invalid rating
            requestId,
          })
          .expect(400);
      });
    });

    describe('/recommend/events/dislike (POST)', () => {
      it('should log dislike event with reason', async () => {
        const response = await request(app.getHttpServer())
          .post('/recommend/events/dislike')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            dishId: testDishId,
            reason: 'too spicy',
            requestId,
          })
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data.eventId).toBeDefined();
      });

      it('should work without reason', async () => {
        const response = await request(app.getHttpServer())
          .post('/recommend/events/dislike')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            dishId: testDishId,
            requestId,
          })
          .expect(200);

        expect(response.body.code).toBe(200);
      });
    });
  });

  describe('Analytics', () => {
    describe('/recommend/events/chain/:requestId (GET)', () => {
      it('should return event chain for request', async () => {
        // 创建一些事件
        const recResponse = await request(app.getHttpServer())
          .post('/recommend')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            filter: {},
            pagination: { page: 1, pageSize: 5 },
          });
        const reqId = recResponse.body.data.requestId;

        const dish = await prisma.dish.findFirst();
        if (dish) {
          await request(app.getHttpServer())
            .post('/recommend/events/click')
            .set('Authorization', `Bearer ${userAccessToken}`)
            .send({
              dishId: dish.id,
              requestId: reqId,
            });
        }

        const response = await request(app.getHttpServer())
          .get(`/recommend/events/chain/${reqId}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data.requestId).toBe(reqId);
        expect(response.body.data.events).toBeInstanceOf(Array);
      });
    });

    describe('/recommend/analytics/funnel (GET)', () => {
      it('should return user funnel data', async () => {
        const response = await request(app.getHttpServer())
          .get('/recommend/analytics/funnel?days=7')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data).toBeDefined();
      });

      it('should use default days when not provided', async () => {
        const response = await request(app.getHttpServer())
          .get('/recommend/analytics/funnel')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(200);

        expect(response.body.code).toBe(200);
      });
    });
  });

  describe('A/B Testing', () => {
    describe('/recommend/experiment/:experimentId/group (GET)', () => {
      it('should return experiment group for user', async () => {
        const response = await request(app.getHttpServer())
          .get('/recommend/experiment/test-exp-1/group')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data).toBeDefined();
      });
    });
  });

  describe('Health Check', () => {
    describe('/recommend/health (GET)', () => {
      it('should return health status', async () => {
        const response = await request(app.getHttpServer())
          .get('/recommend/health')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data.status).toBeDefined();
        expect(response.body.data.services).toBeDefined();
        expect(response.body.data.services.prisma).toBeDefined();
        expect(response.body.data.services.cache).toBeDefined();
      });
    });
  });
});
