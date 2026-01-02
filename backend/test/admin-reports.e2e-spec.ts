import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('AdminReportsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let normalAdminToken: string;
  let testUserId: string;
  let testSecondaryUserId: string;
  let testDishId: string;

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

    // 获取普通管理员token (无举报处理权限)
    const normalAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'normaladmin', password: 'admin123' });
    normalAdminToken = normalAdminLogin.body.data.token.accessToken;

    // 获取用户ID
    const user = await prisma.user.findFirst({
      where: { openId: 'baseline_user_openid' },
    });
    testUserId = user?.id || '';

    const secondaryUser = await prisma.user.findFirst({
      where: { openId: 'secondary_user_openid' },
    });
    testSecondaryUserId = secondaryUser?.id || '';

    // 获取菜品ID
    const dish = await prisma.dish.findFirst({ where: { name: '宫保鸡丁' } });
    testDishId = dish?.id || '';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/admin/reports (GET)', () => {
    it('should return all reports for super admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(20);
    });

    it('should return pending reports when filtering by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports?status=pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((report: any) => {
        expect(report.status).toBe('pending');
      });
    });

    it('should return approved reports when filtering by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports?status=approved')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((report: any) => {
        expect(report.status).toBe('approved');
      });
    });

    it('should return rejected reports when filtering by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports?status=rejected')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((report: any) => {
        expect(report.status).toBe('rejected');
      });
    });

    it('should filter reports by targetType=review', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports?targetType=review')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((report: any) => {
        expect(report.targetType).toBe('review');
      });
    });

    it('should filter reports by targetType=comment', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports?targetType=comment')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((report: any) => {
        expect(report.targetType).toBe('comment');
      });
    });

    it('should filter reports by both status and targetType', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports?status=pending&targetType=review')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((report: any) => {
        expect(report.status).toBe('pending');
        expect(report.targetType).toBe('review');
      });
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports?page=1&pageSize=2')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.meta.pageSize).toBe(2);
      expect(response.body.data.items.length).toBeLessThanOrEqual(2);
    });

    it('should return report with reporter info', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/reports')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      if (response.body.data.items.length > 0) {
        const report = response.body.data.items[0];
        expect(report.reporter).toBeDefined();
        expect(report.reporter.id).toBeDefined();
        expect(report.reporter.nickname).toBeDefined();
      }
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .get('/admin/reports')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/admin/reports').expect(401);
    });
  });

  describe('/admin/reports/:id/handle (POST)', () => {
    let testReportId: string;
    let testReviewId: string;
    let testReportDishId: string;

    beforeEach(async () => {
      // 创建新菜品避免唯一约束冲突
      const canteen = await prisma.canteen.findFirst();
      const dish = await prisma.dish.create({
        data: {
          name: `Report Test Dish ${Date.now()}`,
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowName: 'Test Window',
          availableMealTime: ['lunch'],
        },
      });
      testReportDishId = dish.id;

      // 创建用于测试的评价
      const review = await prisma.review.create({
        data: {
          dishId: testReportDishId,
          userId: testSecondaryUserId,
          rating: 2,
          content: '测试举报处理的评价',
          status: 'approved',
        },
      });
      testReviewId = review.id;

      // 创建用于测试的举报
      const report = await prisma.report.create({
        data: {
          reporterId: testUserId,
          targetType: 'review',
          targetId: testReviewId,
          reviewId: testReviewId,
          type: 'inappropriate',
          reason: '测试举报',
          status: 'pending',
        },
      });
      testReportId = report.id;
    });

    afterEach(async () => {
      // 清理测试数据
      await prisma.report.deleteMany({
        where: { id: testReportId },
      });
      await prisma.review.deleteMany({
        where: { id: testReviewId },
      });
      if (testReportDishId) {
        await prisma.dish.deleteMany({
          where: { id: testReportDishId },
        });
      }
    });

    it('should handle report with delete_content action', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'delete_content',
          result: '内容违规已删除',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('处理成功');

      // 验证举报状态已更新
      const updatedReport = await prisma.report.findUnique({
        where: { id: testReportId },
      });
      expect(updatedReport?.status).toBe('approved');
      expect(updatedReport?.handleResult).toBe('内容违规已删除');
      expect(updatedReport?.handledBy).toBeDefined();
      expect(updatedReport?.handledAt).toBeDefined();

      // 验证评价已被软删除
      const deletedReview = await prisma.review.findUnique({
        where: { id: testReviewId },
      });
      expect(deletedReview?.deletedAt).toBeDefined();
    });

    it('should handle delete_content gracefully when content is already deleted', async () => {
      // 先软删除评价
      await prisma.review.update({
        where: { id: testReviewId },
        data: { deletedAt: new Date() },
      });

      // 然后尝试处理举报
      const response = await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'delete_content',
          result: '内容已删除',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('处理成功');

      // 验证举报状态仍然被正确更新
      const updatedReport = await prisma.report.findUnique({
        where: { id: testReportId },
      });
      expect(updatedReport?.status).toBe('approved');
    });

    it('should handle report with warn_user action', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'warn_user',
          result: '已警告用户注意言行',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('处理成功');

      // 验证举报状态已更新
      const updatedReport = await prisma.report.findUnique({
        where: { id: testReportId },
      });
      expect(updatedReport?.status).toBe('approved');
      expect(updatedReport?.handleResult).toBe('已警告用户注意言行');
    });

    it('should handle report with reject_report action', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'reject_report',
          result: '举报理由不成立',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('处理成功');

      // 验证举报状态已更新
      const updatedReport = await prisma.report.findUnique({
        where: { id: testReportId },
      });
      expect(updatedReport?.status).toBe('rejected');
      expect(updatedReport?.handleResult).toBe('举报理由不成立');
    });

    it('should use default result when result is not provided', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'reject_report',
        })
        .expect(200);

      expect(response.body.code).toBe(200);

      const updatedReport = await prisma.report.findUnique({
        where: { id: testReportId },
      });
      expect(updatedReport?.handleResult).toBe('举报被拒绝');
    });

    it('should return error when report not found', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/reports/non-existent-id/handle')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'reject_report',
        })
        .expect(404);

      expect(response.body.message).toBe('举报不存在');
    });

    it('should return error when report already handled', async () => {
      // 先处理一次
      await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'reject_report',
        })
        .expect(200);

      // 再次尝试处理，应该返回 400 错误
      const response = await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'warn_user',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toBe('该举报已被处理');
    });

    it('should return 400 when action is invalid', async () => {
      await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'invalid_action',
        })
        .expect(400);
    });

    it('should return 400 when action is missing', async () => {
      await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({})
        .expect(400);
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send({
          action: 'reject_report',
        })
        .expect(403);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post(`/admin/reports/${testReportId}/handle`)
        .send({
          action: 'reject_report',
        })
        .expect(401);
    });
  });

  describe('/admin/reports/:id/handle (POST) - Comment handling', () => {
    let testCommentReportId: string;
    let testReviewId: string;
    let testCommentId: string;
    let testCommentDishId: string;

    beforeEach(async () => {
      // 创建新菜品避免唯一约束冲突
      const canteen = await prisma.canteen.findFirst();
      const dish = await prisma.dish.create({
        data: {
          name: `Comment Report Test Dish ${Date.now()}`,
          price: 10,
          canteenId: canteen!.id,
          canteenName: canteen!.name,
          windowName: 'Test Window',
          availableMealTime: ['lunch'],
        },
      });
      testCommentDishId = dish.id;

      // 创建用于测试的评价
      const review = await prisma.review.create({
        data: {
          dishId: testCommentDishId,
          userId: testSecondaryUserId,
          rating: 3,
          content: '测试评论举报的评价',
          status: 'approved',
        },
      });
      testReviewId = review.id;

      // 创建用于测试的评论
      const comment = await prisma.comment.create({
        data: {
          reviewId: testReviewId,
          userId: testSecondaryUserId,
          content: '测试被举报的评论',
          status: 'approved',
        },
      });
      testCommentId = comment.id;

      // 创建用于测试的评论举报
      const report = await prisma.report.create({
        data: {
          reporterId: testUserId,
          targetType: 'comment',
          targetId: testCommentId,
          commentId: testCommentId,
          type: 'spam',
          reason: '评论为垃圾信息',
          status: 'pending',
        },
      });
      testCommentReportId = report.id;
    });

    afterEach(async () => {
      // 清理测试数据
      await prisma.report.deleteMany({
        where: { id: testCommentReportId },
      });
      await prisma.comment.deleteMany({
        where: { id: testCommentId },
      });
      await prisma.review.deleteMany({
        where: { id: testReviewId },
      });
      if (testCommentDishId) {
        await prisma.dish.deleteMany({
          where: { id: testCommentDishId },
        });
      }
    });

    it('should delete comment when handling with delete_content action', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/reports/${testCommentReportId}/handle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'delete_content',
          result: '评论已删除',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('处理成功');

      // 验证举报状态已更新
      const updatedReport = await prisma.report.findUnique({
        where: { id: testCommentReportId },
      });
      expect(updatedReport?.status).toBe('approved');

      // 验证评论已被软删除（deletedAt 不为 null）
      const deletedComment = await prisma.comment.findUnique({
        where: { id: testCommentId },
      });
      expect(deletedComment).not.toBeNull();
      expect(deletedComment?.deletedAt).not.toBeNull();
    });
  });
});
