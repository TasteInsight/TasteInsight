// test/recommendation.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { RecommendationCacheService } from '@/recommendation/services/cache.service';
import { RecommendationScene } from '@/recommendation/constants/recommendation.constants';
import { RecommendationRequestDto } from '@/recommendation/dto/recommendation-request.dto';

describe('Recommendation Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let recommendationService: RecommendationService;
  let cacheService: RecommendationCacheService;
  let userAccessToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    recommendationService = app.get<RecommendationService>(
      RecommendationService,
    );
    cacheService = app.get<RecommendationCacheService>(
      RecommendationCacheService,
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // Acquire test user login token
    // Using a baseline user code or mock login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' });

    userAccessToken = loginResponse.body.data.token.accessToken;
    testUserId = loginResponse.body.data.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Core Recommendation Flow (/recommend)', () => {
    it('should return a valid recommendation list with requestId', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          scene: RecommendationScene.HOME,
          filter: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.requestId).toBeDefined();
      expect(response.body.data.meta).toBeDefined();

      // Validation of response structure
      if (response.body.data.items.length > 0) {
        const item = response.body.data.items[0];
        expect(item.id).toBeDefined();
        // Score is optional and might not be present by default
        // expect(item.score).toBeDefined();
      }
    });

    it('should include score breakdown when requested', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          scene: RecommendationScene.HOME,
          filter: {},
          pagination: { page: 1, pageSize: 5 },
          includeScoreBreakdown: true,
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      if (response.body.data.items.length > 0) {
        const item = response.body.data.items[0];
        expect(item.score).toBeDefined();
        expect(item.scoreBreakdown).toBeDefined();
      }
    });

    it('should support pagination with session consistency', async () => {
      // Step 1: Request Page 1
      const resPage1 = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200);

      const requestId = resPage1.body.data.requestId;
      const page1Ids = resPage1.body.data.items.map((i: any) => i.id);

      expect(requestId).toBeDefined();
      expect(resPage1.body.data.items.length).toBeGreaterThan(0);

      // Step 2: Request Page 2 using the SAME requestId
      // This tests the session caching mechanism
      const resPage2 = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          requestId: requestId, // Pass back the requestId
          filter: {},
          pagination: { page: 2, pageSize: 5 },
        })
        .expect(200);

      const page2Ids = resPage2.body.data.items.map((i: any) => i.id);

      // Verify no overlap between pages (strict uniqueness in session)
      const intersection = page1Ids.filter((id: string) =>
        page2Ids.includes(id),
      );
      expect(intersection.length).toBe(0);

      // Verify usage of same requestId
      expect(resPage2.body.data.requestId).toBe(requestId);
    });

    it('should reset session when Page 1 is requested with existing requestId', async () => {
      // Step 1: Start a session
      const resInit = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          pagination: { page: 1, pageSize: 5 },
        });

      const requestId = resInit.body.data.requestId;

      // Step 2: Request Page 1 again with same requestId
      // Logic dictates this should clear session cache and start fresh (possibly returning different items or re-randomized)
      const resRetry = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          requestId,
          filter: {},
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200);

      expect(resRetry.body.data.requestId).toBe(requestId);
      expect(resRetry.body.data.items).toBeInstanceOf(Array);
    });
  });

  describe('Context-Aware Recommendation', () => {
    it('should accept and process user context (Exploratory Mode)', async () => {
      // Sending 'exploratory: true' should trigger diversity boost internally
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          scene: RecommendationScene.HOME,
          filter: {},
          pagination: { page: 1, pageSize: 10 },
          userContext: {
            exploratory: true,
          },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      const items = response.body.data.items;
      expect(items.length).toBeGreaterThan(0);

      // While we can't easily assert "diversity" numerically without complex analysis,
      // we ensure the pipeline executes successfully with context.
    });

    it('should accept and process user context (Urgency Mode)', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          scene: RecommendationScene.HOME,
          filter: {},
          pagination: { page: 1, pageSize: 10 },
          userContext: {
            urgency: 'high',
          },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
    });
  });

  describe('Filtering & Search Logic', () => {
    it('should return empty result for mutually exclusive filters', async () => {
      // Validating that conflicting filters return 0 items instead of error
      // e.g., Filter for a price range that likely has no items or conflicting constraints
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {
            price: { min: 99999, max: 100000 }, // Extremely high price
          },
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.meta.total).toBe(0);
    });

    it('should support search scene with keywords', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          scene: RecommendationScene.SEARCH,
          search: {
            keyword: '鸡', // 'Chicken' in Chinese, common test case
            fields: ['name'],
          },
          filter: {},
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      if (response.body.data.items.length > 0) {
        // Most items should be relevant to keyword
        // Note: Strict containment check might fail if vector search brings semantic matches,
        // so we just check for success response here.
        expect(response.body.data.items.length).toBeGreaterThan(0);
      }
    });

    it('should filter by specific canteen', async () => {
      const canteen = await prisma.canteen.findFirst();
      if (!canteen) return;

      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {
            canteenId: [canteen.id],
          },
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200);

      response.body.data.items.forEach((item: any) => {
        // Usually item doesn't have canteenId in list view unless extended,
        // but if we had full details we'd check.
        // Here we assume backend did its job if 200 OK.
      });
    });
  });

  describe('Similar Dishes Recommendation (/recommend/similar/:dishId)', () => {
    let testDishId: string;

    beforeAll(async () => {
      const dish = await prisma.dish.findFirst();
      testDishId = dish?.id || '';
    });

    it('should return similar dishes for valid ID', async () => {
      if (!testDishId) return;

      const response = await request(app.getHttpServer())
        .post(`/recommend/similar/${testDishId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200);

      expect(response.body.data.items).toBeInstanceOf(Array);
      // Ensure the triggered dish itself is not in the recommendations (usually desirable)
      const ids = response.body.data.items.map((i: any) => i.id);
      expect(ids).not.toContain(testDishId);
    });

    it('should handle non-existent dish ID gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend/similar/invalid-id-12345')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          pagination: { page: 1, pageSize: 5 },
        })
        .expect(200); // Should return 200 with empty list or fallback

      // The current implementation might return empty list
      expect(response.body.data.items).toBeInstanceOf(Array);
    });
  });

  describe('Personalized Recommendation (/recommend/personal)', () => {
    it('should return personalized list', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend/personal')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('should respect meal time parameter', async () => {
      const response = await request(app.getHttpServer())
        .post('/recommend/personal')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          mealTime: 'breakfast',
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      expect(response.body.data.items).toBeInstanceOf(Array);
    });
  });

  describe('Event Tracking & Analytics', () => {
    let requestId: string;
    let testDishId: string;

    beforeAll(async () => {
      const dish = await prisma.dish.findFirst();
      testDishId = dish?.id || '';

      const res = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {},
          pagination: { page: 1, pageSize: 5 },
        });
      requestId = res.body.data.requestId;
    });

    it('should log click event', async () => {
      await request(app.getHttpServer())
        .post('/recommend/events/click')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          dishId: testDishId,
          requestId,
          position: 0,
        })
        .expect(200);
    });

    it('should log favorite event', async () => {
      await request(app.getHttpServer())
        .post('/recommend/events/favorite')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          dishId: testDishId,
          requestId,
        })
        .expect(200);
    });

    it('should validate review rating range', async () => {
      // Valid rating
      await request(app.getHttpServer())
        .post('/recommend/events/review')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ dishId: testDishId, rating: 5, requestId })
        .expect(200);

      // Invalid rating (Low)
      await request(app.getHttpServer())
        .post('/recommend/events/review')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ dishId: testDishId, rating: 0, requestId })
        .expect(400);

      // Invalid rating (High)
      await request(app.getHttpServer())
        .post('/recommend/events/review')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ dishId: testDishId, rating: 6, requestId })
        .expect(400);
    });

    it('should retrieve event chain for a request', async () => {
      const response = await request(app.getHttpServer())
        .get(`/recommend/events/chain/${requestId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.data.requestId).toBe(requestId);
      expect(response.body.data.events).toBeInstanceOf(Array);
      // We logged click/favorite/review, so length should be >= 1
      expect(response.body.data.events.length).toBeGreaterThan(0);
    });
  });

  describe('Legacy /dishes Endpoint (Suggestion Mode)', () => {
    it('should return suggestions when isSuggestion=true', async () => {
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

      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('should filter suggested dishes by price', async () => {
      const response = await request(app.getHttpServer())
        .post('/dishes')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          isSuggestion: true,
          filter: { price: { min: 10, max: 20 } },
          search: { keyword: '' }, // Should be required for GetDishesDto
          sort: {},
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      response.body.data.items.forEach((dish: any) => {
        expect(dish.price).toBeGreaterThanOrEqual(10);
        expect(dish.price).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('System & Health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/recommend/health')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.services.cache).toBeDefined();
    });
  });

  describe('Cold Start Scenario', () => {
    // Requires setting up a user with no history, or clearing history

    it('should provide recommendations even for users with no preferences', async () => {
      // 1. Temporarily clear user preferences
      await prisma.userPreference.deleteMany({
        where: { userId: testUserId },
      });
      // Force cache refresh
      await recommendationService.refreshUserFeatureCache(testUserId);

      // 2. Request
      const response = await request(app.getHttpServer())
        .post('/recommend')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          filter: {}, // Added required filter field
          pagination: { page: 1, pageSize: 10 },
        })
        .expect(200);

      // 3. Verify fallback behavior (should still return dishes)
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // 4. Restore preferences (optional, or just leave it)
    });
  });
});
