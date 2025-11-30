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

    // 获取菜品ID
    const dish = await prisma.dish.findFirst({ where: { name: '宫保鸡丁' } });
    testDishId = dish?.id || '';

    // 创建待审核评价
    const review = await prisma.review.create({
      data: {
        dishId: testDishId,
        userId: testUserId,
        rating: 5,
        content: '待审核评价测试',
        status: 'pending',
      },
    });
    testReviewId = review.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testReviewId) {
      await prisma.review.deleteMany({ where: { id: testReviewId } });
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

    beforeEach(async () => {
      const review = await prisma.review.create({
        data: {
          dishId: testDishId,
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
  });

  describe('/admin/reviews/:id/reject (POST)', () => {
    let reviewToRejectId: string;

    beforeEach(async () => {
      const review = await prisma.review.create({
        data: {
          dishId: testDishId,
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

  describe('/admin/reviews/:id/approve (POST) - not found', () => {
    it('should return 404 for non-existent review', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/admin/reviews/${nonExistentId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });
  });

  describe('/admin/reviews/:id (DELETE)', () => {
    let reviewToDeleteId: string;

    beforeEach(async () => {
      const review = await prisma.review.create({
        data: {
          dishId: testDishId,
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
});
