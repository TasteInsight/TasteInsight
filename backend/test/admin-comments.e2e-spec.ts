import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('AdminCommentsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let normalAdminToken: string;
  let userToken: string;
  let testReviewId: string;
  let testCommentId: string;
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

    // 创建评价
    const review = await prisma.review.create({
      data: {
        dishId: testDishId,
        userId: testUserId,
        rating: 5,
        content: '评价测试',
        status: 'approved',
      },
    });
    testReviewId = review.id;

    // 创建待审核评论
    const comment = await prisma.comment.create({
      data: {
        reviewId: testReviewId,
        userId: testUserId,
        content: '待审核评论测试',
        status: 'pending',
      },
    });
    testCommentId = comment.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testCommentId) {
      await prisma.comment.deleteMany({ where: { id: testCommentId } });
    }
    if (testReviewId) {
      await prisma.review.deleteMany({ where: { id: testReviewId } });
    }
    await app.close();
  });

  describe('/admin/comments/pending (GET)', () => {
    it('should return pending comments for super admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/comments/pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      const found = response.body.data.items.find(
        (c: any) => c.id === testCommentId,
      );
      expect(found).toBeDefined();
      expect(found.status).toBe('pending');
      expect(found.content).toBe('待审核评论测试');
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .get('/admin/comments/pending')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });
  });

  describe('/admin/comments/:id/approve (POST)', () => {
    it('should approve comment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/comments/${testCommentId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);

      const updatedComment = await prisma.comment.findUnique({
        where: { id: testCommentId },
      });
      expect(updatedComment?.status).toBe('approved');
    });
  });

  describe('/admin/comments/:id/reject (POST)', () => {
    let rejectCommentId: string;

    beforeAll(async () => {
      const comment = await prisma.comment.create({
        data: {
          reviewId: testReviewId,
          userId: testUserId,
          content: '待拒绝评论测试',
          status: 'pending',
        },
      });
      rejectCommentId = comment.id;
    });

    afterAll(async () => {
      if (rejectCommentId) {
        await prisma.comment.deleteMany({ where: { id: rejectCommentId } });
      }
    });

    it('should reject comment with reason', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/comments/${rejectCommentId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: '内容不当' })
        .expect(200);

      expect(response.body.code).toBe(200);

      const updatedComment = await prisma.comment.findUnique({
        where: { id: rejectCommentId },
      });
      expect(updatedComment?.status).toBe('rejected');
      expect(updatedComment?.rejectReason).toBe('内容不当');
    });
  });
});
