import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('AdminReviewsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let normalAdminToken: string;
  let userToken: string;
  let testReviewId: string;
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

    // 获取超级管理员token
    const superAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'testadmin', password: 'password123' });
    superAdminToken = superAdminLogin.body.data.token.accessToken;

    // 获取普通管理员token (无审核权限)
    const normalAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'normaladmin', password: 'admin123' });
    normalAdminToken = normalAdminLogin.body.data.token.accessToken;

    // 获取普通用户token
    const userLogin = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' });
    userToken = userLogin.body.data.token.accessToken;

    // 获取用户ID
    const user = await prisma.user.findFirst({
      where: { openId: 'baseline_user_openid' },
    });
    testUserId = user?.id || '';

    // 创建一个新的测试菜品（避免与 seed 数据中的评论冲突）
    const canteen = await prisma.canteen.findFirst();
    const dish = await prisma.dish.create({
      data: {
        name: 'Admin Reviews Test Dish',
        price: 10,
        canteenId: canteen!.id,
        canteenName: canteen!.name,
        windowName: 'Test Window',
        availableMealTime: ['lunch'],
      },
    });
    testDishId = dish.id;

    // 创建待审核评价
    const review = await prisma.review.create({
      data: {
        dishId: testDishId,
        userId: testUserId,
        rating: 5,
        content: '待审核评价测试',
        status: 'pending',
        spicyLevel: 3,
        sweetness: 2,
        saltiness: 3,
        oiliness: 4,
      },
    });
    testReviewId = review.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testReviewId) {
      await prisma.review.deleteMany({ where: { id: testReviewId } });
    }
    if (testDishId) {
      await prisma.dish.deleteMany({ where: { id: testDishId } });
    }
    await app.close();
  });

  describe('/admin/reviews/pending (GET)', () => {
    it('should return pending reviews for super admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reviews/pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      const found = response.body.data.items.find(
        (r: any) => r.id === testReviewId,
      );
      expect(found).toBeDefined();
      expect(found.status).toBe('pending');
      expect(found.ratingDetails).toBeDefined();
      expect(found.ratingDetails.spicyLevel).toBe(3);
      expect(found.ratingDetails.sweetness).toBe(2);
      expect(found.ratingDetails.saltiness).toBe(3);
      expect(found.ratingDetails.oiliness).toBe(4);
    });

    it('should return pending reviews without rating details', async () => {
      // 创建新菜品避免冲突
      const canteen = await prisma.canteen.findFirst();
      const dish2 = await prisma.dish.create({
        data: {
          name: 'Test Dish No Details',
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowName: 'Test Window',
          availableMealTime: ['lunch'],
        },
      });

      // 创建一个没有详细评分的待审核评价
      const reviewNoDetails = await prisma.review.create({
        data: {
          dishId: dish2.id,
          userId: testUserId,
          rating: 4,
          content: '无详细评分测试',
          status: 'pending',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/admin/reviews/pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const found = response.body.data.items.find(
        (r: any) => r.id === reviewNoDetails.id,
      );
      expect(found).toBeDefined();
      expect(found.ratingDetails).toBeNull();

      // 清理
      await prisma.review.delete({ where: { id: reviewNoDetails.id } });
      await prisma.dish.delete({ where: { id: dish2.id } });
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .get('/admin/reviews/pending')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });
  });

  describe('/admin/reviews/:id/approve (POST)', () => {
    let reviewToApproveId: string;

    let approveDishId: string;

    beforeEach(async () => {
      const canteen = await prisma.canteen.findFirst();
      const dish = await prisma.dish.create({
        data: {
          name: `Approve Test Dish ${Date.now()}`,
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowName: 'Test Window',
          availableMealTime: ['lunch'],
        },
      });
      approveDishId = dish.id;

      const review = await prisma.review.create({
        data: {
          dishId: approveDishId,
          userId: testUserId,
          rating: 4,
          content: '待通过评价',
          status: 'pending',
        },
      });
      reviewToApproveId = review.id;
    });

    afterEach(async () => {
      if (reviewToApproveId) {
        await prisma.review.deleteMany({ where: { id: reviewToApproveId } });
      }
      if (approveDishId) {
        await prisma.dish.deleteMany({ where: { id: approveDishId } });
      }
    });

    it('should approve review', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/reviews/${reviewToApproveId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('审核通过');

      const updatedReview = await prisma.review.findUnique({
        where: { id: reviewToApproveId },
      });
      expect(updatedReview?.status).toBe('approved');
    });

    it('should return 403 for normal admin', async () => {
      await request(app.getHttpServer())
        .post(`/admin/reviews/${reviewToApproveId}/approve`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent review', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/admin/reviews/${nonExistentId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });
  });

  describe('/admin/reviews/:id/reject (POST)', () => {
    let reviewToRejectId: string;

    let rejectDishId: string;

    beforeEach(async () => {
      const canteen = await prisma.canteen.findFirst();
      const dish = await prisma.dish.create({
        data: {
          name: `Reject Test Dish ${Date.now()}`,
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowName: 'Test Window',
          availableMealTime: ['lunch'],
        },
      });
      rejectDishId = dish.id;

      const review = await prisma.review.create({
        data: {
          dishId: rejectDishId,
          userId: testUserId,
          rating: 3,
          content: '待拒绝评价',
          status: 'pending',
        },
      });
      reviewToRejectId = review.id;
    });

    afterEach(async () => {
      if (reviewToRejectId) {
        await prisma.review.deleteMany({ where: { id: reviewToRejectId } });
      }
      if (rejectDishId) {
        await prisma.dish.deleteMany({ where: { id: rejectDishId } });
      }
    });

    it('should reject review with reason', async () => {
      const reason = '内容不当';
      const response = await request(app.getHttpServer())
        .post(`/admin/reviews/${reviewToRejectId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('已拒绝');

      const updatedReview = await prisma.review.findUnique({
        where: { id: reviewToRejectId },
      });
      expect(updatedReview?.status).toBe('rejected');
      expect(updatedReview?.rejectReason).toBe(reason);
    });

    it('should return 400 if reason is missing', async () => {
      await request(app.getHttpServer())
        .post(`/admin/reviews/${reviewToRejectId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({})
        .expect(400);
    });

    it('should return 404 for non-existent review', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/admin/reviews/${nonExistentId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: '测试拒绝' })
        .expect(404);
    });
  });

  describe('/admin/reviews/:id (DELETE)', () => {
    let reviewToDeleteId: string;

    let deleteDishId: string;

    beforeEach(async () => {
      const canteen = await prisma.canteen.findFirst();
      const dish = await prisma.dish.create({
        data: {
          name: `Delete Test Dish ${Date.now()}`,
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowName: 'Test Window',
          availableMealTime: ['lunch'],
        },
      });
      deleteDishId = dish.id;

      const review = await prisma.review.create({
        data: {
          dishId: deleteDishId,
          userId: testUserId,
          rating: 2,
          content: '待删除评价',
          status: 'pending',
        },
      });
      reviewToDeleteId = review.id;
    });

    afterEach(async () => {
      if (reviewToDeleteId) {
        await prisma.review.deleteMany({ where: { id: reviewToDeleteId } });
      }
      if (deleteDishId) {
        await prisma.dish.deleteMany({ where: { id: deleteDishId } });
      }
    });

    it('should delete review (soft delete)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/admin/reviews/${reviewToDeleteId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('删除成功');

      const deletedReview = await prisma.review.findUnique({
        where: { id: reviewToDeleteId },
      });
      expect(deletedReview?.deletedAt).not.toBeNull();
    });

    it('should return 404 for non-existent review', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/admin/reviews/${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/reviews/${reviewToDeleteId}`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });
  });

  describe('/admin/reviews/:reviewId/comments (GET)', () => {
    let reviewForCommentsId: string;
    let testCommentId: string;

    let commentsDishId: string;

    beforeAll(async () => {
      // 创建新菜品避免冲突
      const canteen = await prisma.canteen.findFirst();
      const dish = await prisma.dish.create({
        data: {
          name: 'Comments Test Dish',
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowName: 'Test Window',
          availableMealTime: ['lunch'],
        },
      });
      commentsDishId = dish.id;

      // 创建用于测试的评价
      const review = await prisma.review.create({
        data: {
          dishId: commentsDishId,
          userId: testUserId,
          rating: 4,
          content: '用于测试评论列表的评价',
          status: 'approved',
        },
      });
      reviewForCommentsId = review.id;

      // 创建用于测试的评论
      const comment = await prisma.comment.create({
        data: {
          reviewId: reviewForCommentsId,
          userId: testUserId,
          content: '测试评论内容',
          status: 'approved',
          floor: 1,
        },
      });
      testCommentId = comment.id;
    });

    afterAll(async () => {
      if (testCommentId) {
        await prisma.comment.deleteMany({ where: { id: testCommentId } });
      }
      if (reviewForCommentsId) {
        await prisma.review.deleteMany({ where: { id: reviewForCommentsId } });
      }
      if (commentsDishId) {
        await prisma.dish.deleteMany({ where: { id: commentsDishId } });
      }
    });

    it('should return comments for a review', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/reviews/${reviewForCommentsId}/comments`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.meta.page).toBe(1);
    });

    it('should return comment with user info', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/reviews/${reviewForCommentsId}/comments`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const found = response.body.data.items.find(
        (c: any) => c.id === testCommentId,
      );
      expect(found).toBeDefined();
      expect(found.user).toBeDefined();
      expect(found.user.nickname).toBeDefined();
      expect(found.content).toBe('测试评论内容');
      expect(found.floor).toBe(1);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/reviews/${reviewForCommentsId}/comments?page=1&pageSize=5`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.meta.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should return 404 for non-existent review', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/admin/reviews/${nonExistentId}/comments`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/admin/reviews/${reviewForCommentsId}/comments`)
        .expect(401);
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .get(`/admin/reviews/${reviewForCommentsId}/comments`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });
  });
});
