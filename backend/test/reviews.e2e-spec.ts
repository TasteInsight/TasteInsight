import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('ReviewsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAccessToken: string;
  let testDishId: string;
  let testReviewId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // 获取测试用户登录token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' });

    userAccessToken = loginResponse.body.data.token.accessToken;

    // 获取测试菜品ID（从种子数据中获取）
    const dish = await prisma.dish.findFirst({
      where: { name: '宫保鸡丁' },
    });
    testDishId = dish?.id || '';

    // 如果没有找到，创建一个测试菜品
    if (!testDishId) {
      const canteen = await prisma.canteen.findFirst();
      const window = await prisma.window.findFirst();
      const testDish = await prisma.dish.create({
        data: {
          name: '测试菜品',
          tags: ['川菜'],
          price: 15.0,
          description: '测试用菜品',
          images: [],
          ingredients: ['鸡肉', '花生'],
          allergens: [],
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowId: window!.id,
          windowName: window!.name,
          availableMealTime: ['lunch'],
        },
      });
      testDishId = testDish.id;
    }
  });

  afterAll(async () => {
    // 清理测试数据
    if (testReviewId) {
      await prisma.report.deleteMany({
        where: { reviewId: testReviewId },
      });
      await prisma.review.deleteMany({
        where: { id: testReviewId },
      });
    }
    await app.close();
  });

  describe('/dishes/:dishId/reviews (GET)', () => {
    it('should return reviews for a dish', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dishes/${testDishId}/reviews`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('获取成功');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.rating).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/dishes/${testDishId}/reviews`)
        .expect(401);
    });

    it('should handle pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dishes/${testDishId}/reviews?page=1&pageSize=5`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(5);
    });
  });

  describe('/reviews (POST)', () => {
    it('should create a review', async () => {
      const createReviewDto = {
        dishId: testDishId,
        rating: 5,
        content: '很好吃！',
        images: ['https://example.com/image1.jpg'],
      };

      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createReviewDto)
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.message).toBe('创建成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.dishId).toBe(testDishId);
      expect(response.body.data.rating).toBe(5);
      expect(response.body.data.content).toBe('很好吃！');
      expect(response.body.data.status).toBe('pending');

      testReviewId = response.body.data.id;
    });

    it('should return 401 without authentication', async () => {
      const createReviewDto = {
        dishId: testDishId,
        rating: 4,
        content: '不错',
      };

      await request(app.getHttpServer())
        .post('/reviews')
        .send(createReviewDto)
        .expect(401);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({})
        .expect(400);
    });

    it('should validate rating range', async () => {
      const createReviewDto = {
        dishId: testDishId,
        rating: 6, // 超出范围
        content: '测试',
      };

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createReviewDto)
        .expect(400);
    });

    it('should return 404 for non-existent dish', async () => {
      const createReviewDto = {
        dishId: 'non-existent-dish-id',
        rating: 5,
        content: '测试',
      };

      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createReviewDto)
        .expect(404);

      expect(response.body.message).toContain('未找到对应的菜品');
    });
  });

  describe('/reviews/:id/report (POST)', () => {
    it('should report a review', async () => {
      // 首先创建一个评论用于举报
      const createReviewDto = {
        dishId: testDishId,
        rating: 3,
        content: '一般般',
      };

      const reviewResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createReviewDto)
        .expect(201);

      const reviewId = reviewResponse.body.data.id;

      const reportDto = {
        type: 'inappropriate',
        reason: '包含不当内容',
      };

      const response = await request(app.getHttpServer())
        .post(`/reviews/${reviewId}/report`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(reportDto)
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.message).toBe('举报成功');
      expect(response.body.data).toBeDefined();

      // 清理测试数据
      await prisma.report.deleteMany({
        where: { reviewId },
      });
      await prisma.review.deleteMany({
        where: { id: reviewId },
      });
    });

    it('should return 401 without authentication', async () => {
      const reportDto = {
        type: 'spam',
        reason: '垃圾内容',
      };

      await request(app.getHttpServer())
        .post(`/reviews/${testReviewId}/report`)
        .send(reportDto)
        .expect(401);
    });

    it('should return 404 for non-existent review', async () => {
      const reportDto = {
        type: 'false_info',
        reason: '虚假信息',
      };

      const response = await request(app.getHttpServer())
        .post(`/reviews/non-existent-review-id/report`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(reportDto)
        .expect(404);

      expect(response.body.message).toContain('未找到对应的评论');
    });

    it('should validate report type', async () => {
      const reportDto = {
        type: 'invalid_type',
        reason: '测试',
      };

      await request(app.getHttpServer())
        .post(`/reviews/${testReviewId}/report`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(reportDto)
        .expect(400);
    });
  });
});
