import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { afterEach } from 'node:test';

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
    it('should create a review with detailed ratings', async () => {
      // 创建新菜品避免与 seed 数据冲突
      const canteen = await prisma.canteen.findFirst();
      const window = await prisma.window.findFirst();
      const dish1 = await prisma.dish.create({
        data: {
          name: 'Test Dish With Details',
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowId: window!.id,
          windowName: window!.name,
          availableMealTime: ['lunch'],
        },
      });

      const createReviewDto = {
        dishId: dish1.id,
        rating: 5,
        content: '很好吃！',
        images: ['https://example.com/image1.jpg'],
        ratingDetails: {
          spicyLevel: 3,
          sweetness: 2,
          saltiness: 3,
          oiliness: 4,
        },
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
      expect(response.body.data.dishId).toBe(dish1.id);
      expect(response.body.data.rating).toBe(5);
      expect(response.body.data.content).toBe('很好吃！');
      expect(response.body.data.status).toBe('pending');

      // 验证详细评分
      expect(response.body.data.ratingDetails).toBeDefined();
      expect(response.body.data.ratingDetails.spicyLevel).toBe(3);
      expect(response.body.data.ratingDetails.sweetness).toBe(2);
      expect(response.body.data.ratingDetails.saltiness).toBe(3);
      expect(response.body.data.ratingDetails.oiliness).toBe(4);

      testReviewId = response.body.data.id;

      // 清理
      await prisma.review.delete({ where: { id: testReviewId } });
      await prisma.dish.delete({ where: { id: dish1.id } });
    });

    it('should create a review without rating details', async () => {
      // 创建新菜品避免与第一个测试冲突
      const canteen = await prisma.canteen.findFirst();
      const window = await prisma.window.findFirst();
      const dish2 = await prisma.dish.create({
        data: {
          name: 'Test Dish Without Details',
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowId: window!.id,
          windowName: window!.name,
          availableMealTime: ['lunch'],
        },
      });

      const createReviewDto = {
        dishId: dish2.id,
        rating: 4,
        content: '没有详细评分',
        images: [],
      };

      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createReviewDto)
        .expect(201);

      expect(response.body.data.ratingDetails).toBeNull();

      // 清理
      await prisma.review.delete({ where: { id: response.body.data.id } });
      await prisma.dish.delete({ where: { id: dish2.id } });
    });

    it('should fail to create a review with partial rating details', async () => {
      const createReviewDto = {
        dishId: testDishId,
        rating: 4,
        content: '部分详细评分',
        ratingDetails: {
          spicyLevel: 3,
          // 缺少其他字段
        },
      };

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createReviewDto)
        .expect(400);
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

    it('should update existing review when user reviews the same dish again', async () => {
      // 创建新菜品用于此测试
      const canteen = await prisma.canteen.findFirst();
      const window = await prisma.window.findFirst();
      const updateTestDish = await prisma.dish.create({
        data: {
          name: 'Update Test Dish',
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowId: window!.id,
          windowName: window!.name,
          availableMealTime: ['lunch'],
        },
      });

      // 第一次创建评分
      const firstReviewDto = {
        dishId: updateTestDish.id,
        rating: 4,
        content: '第一次评价',
        images: ['https://example.com/image1.jpg'],
        ratingDetails: {
          spicyLevel: 3,
          sweetness: 2,
          saltiness: 3,
          oiliness: 4,
        },
      };

      const firstResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(firstReviewDto)
        .expect(201);

      expect(firstResponse.body.message).toBe('创建成功');
      const firstReviewId = firstResponse.body.data.id;

      // 第二次对同一菜品评分（应该更新而不是创建新的）
      const secondReviewDto = {
        dishId: updateTestDish.id,
        rating: 5,
        content: '更新后的评价',
        images: ['https://example.com/image2.jpg'],
        ratingDetails: {
          spicyLevel: 4,
          sweetness: 3,
          saltiness: 2,
          oiliness: 3,
        },
      };

      const secondResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(secondReviewDto)
        .expect(201);

      expect(secondResponse.body.message).toBe('更新成功');
      expect(secondResponse.body.data.id).toBe(firstReviewId); // 应该是同一个ID
      expect(secondResponse.body.data.rating).toBe(5);
      expect(secondResponse.body.data.content).toBe('更新后的评价');
      expect(secondResponse.body.data.ratingDetails.spicyLevel).toBe(4);

      // 验证数据库中只有一条记录
      const reviewCount = await prisma.review.count({
        where: {
          userId: firstResponse.body.data.userId,
          dishId: updateTestDish.id,
        },
      });
      expect(reviewCount).toBe(1);

      // 清理
      await prisma.review.delete({ where: { id: firstReviewId } });
      await prisma.dish.delete({ where: { id: updateTestDish.id } });
    });

    it('should restore deleted review when user reviews again', async () => {
      // 创建评分
      const createReviewDto = {
        dishId: testDishId,
        rating: 4,
        content: '准备删除的评价',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createReviewDto)
        .expect(201);

      const reviewId = createResponse.body.data.id;

      // 删除评分
      await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      // 验证已被软删除
      const deletedReview = await prisma.review.findUnique({
        where: { id: reviewId },
      });
      expect(deletedReview?.deletedAt).toBeTruthy();

      // 再次评分（应该恢复并更新）
      const newReviewDto = {
        dishId: testDishId,
        rating: 5,
        content: '恢复后的评价',
      };

      const restoreResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(newReviewDto)
        .expect(201);

      expect(restoreResponse.body.message).toBe('更新成功');
      expect(restoreResponse.body.data.id).toBe(reviewId); // 应该是同一个ID
      expect(restoreResponse.body.data.rating).toBe(5);
      expect(restoreResponse.body.data.content).toBe('恢复后的评价');

      // 验证 deletedAt 已被清除
      const restoredReview = await prisma.review.findUnique({
        where: { id: reviewId },
      });
      expect(restoredReview?.deletedAt).toBeNull();

      // 清理
      await prisma.review.delete({ where: { id: reviewId } });
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

  describe('/reviews/:id (DELETE)', () => {
    let reviewIdToDelete: string;

    beforeEach(async () => {
      const createReviewDto = {
        dishId: testDishId,
        rating: 4,
        content: '准备删除的评价',
      };

      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createReviewDto);

      reviewIdToDelete = response.body.data.id;
    });

    it('should soft delete a review', async () => {
      await request(app.getHttpServer())
        .delete(`/reviews/${reviewIdToDelete}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      const deleted = await prisma.review.findUnique({
        where: { id: reviewIdToDelete },
      });
      expect(deleted?.deletedAt).toBeTruthy();
    });

    it('should forbid deleting others review', async () => {
      const otherLogin = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'secondary_user_code_placeholder' });
      const otherToken = otherLogin.body.data.token.accessToken;

      await request(app.getHttpServer())
        .delete(`/reviews/${reviewIdToDelete}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
    afterEach(async () => {
      // 清理测试数据
      if (reviewIdToDelete) {
        await prisma.report.deleteMany({
          where: { reviewId: reviewIdToDelete },
        });
        await prisma.review.deleteMany({
          where: { id: reviewIdToDelete },
        });
      }
    });
  });
});
