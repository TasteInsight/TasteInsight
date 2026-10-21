import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { Report } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { AdminReportsController } from '@/admin-reports/admin-reports.controller';
import { AdminReportsService } from '@/admin-reports/admin-reports.service';
import { UserProfileController } from '@/user-profile/user-profile.controller';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { NotificationsController } from '@/notifications/notifications.controller';
import { NotificationService } from '@/notifications/notification.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { DishesService } from '@/dishes/dishes.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { AdminCanteensService } from '@/admin-canteens/admin-canteens.service';

describe('history and report feedback (PostgreSQL and HTTP)', () => {
  const prefix = `report-feedback-${randomUUID()}`;
  const secret = 'isolated-report-feedback-secret';
  const userIds: string[] = [];
  const reportIds: string[] = [];
  let app: INestApplication;
  let prisma: PrismaService;
  let notifications: NotificationService;
  let reports: AdminReportsService;
  let canteenId: string;
  let dishId: string;
  let postId: string;
  let adminId: string;
  let adminToken: string;
  let ownerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AdminReportsController,
        UserProfileController,
        NotificationsController,
      ],
      providers: [
        PrismaService,
        AdminReportsService,
        UserProfileService,
        NotificationService,
        JwtService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            NODE_ENV: 'test',
            JWT_SECRET: secret,
            NOTIFICATION_WEBHOOK_URL:
              'https://hooks.example.invalid/report-feedback',
          }),
        },
        {
          provide: DishReviewStatsService,
          useValue: { recomputeBatch: jest.fn() },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    reports = app.get(AdminReportsService);
    notifications = app.get(NotificationService);
    const jwt = app.get(JwtService);
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({
        data: {
          nickname: `${prefix}-${i}`,
          settings: {
            create: { reviewReplyAlert: false, postReplyAlert: false },
          },
        },
      });
      userIds.push(user.id);
    }
    const token = (sub: string, type = 'user') =>
      jwt.sign(
        { sub, type, tokenUse: 'access', sessionVersion: 0 },
        { secret },
      );
    ownerToken = token(userIds[0]);
    otherToken = token(userIds[1]);
    const admin = await prisma.admin.create({
      data: {
        username: prefix,
        password: 'unused-test-hash',
        scope: 'GLOBAL',
        role: 'superadmin',
      },
    });
    adminId = admin.id;
    adminToken = token(adminId, 'admin');
    const canteen = await prisma.canteen.create({
      data: { name: prefix, images: [], openingHours: [] },
    });
    canteenId = canteen.id;
    dishId = (
      await prisma.dish.create({
        data: {
          name: prefix,
          price: 1,
          canteenId,
          canteenName: prefix,
          windowName: prefix,
        },
      })
    ).id;
    postId = (
      await prisma.post.create({
        data: { userId: userIds[1], content: prefix, status: 'approved' },
      })
    ).id;
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (prisma) {
      await prisma.notification.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
      if (postId) await prisma.post.delete({ where: { id: postId } });
      if (canteenId) await prisma.canteen.delete({ where: { id: canteenId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (adminId) await prisma.admin.delete({ where: { id: adminId } });
    }
    await app?.close();
  });
  const makeReport = async () => {
    const report = await prisma.report.create({
      data: {
        reporterId: userIds[0],
        targetType: 'post',
        targetId: postId,
        postId,
        type: 'spam',
        reason: '垃圾广告',
      },
    });
    reportIds.push(report.id);
    return report;
  };
  const handle = (id: string, action = 'reject_report') =>
    request(app.getHttpServer())
      .post(`/admin/reports/${id}/handle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action });

  it('bulk data hydration leaves browse history untouched and opening a detail records a view', async () => {
    const dishes = new DishesService(prisma);
    await dishes.getDishesByIds([dishId], userIds[0]);
    expect(
      await prisma.browseHistory.count({ where: { userId: userIds[0] } }),
    ).toBe(0);
    await dishes.getDishById(dishId, userIds[0]);
    expect(
      await prisma.browseHistory.count({
        where: { userId: userIds[0], dishId },
      }),
    ).toBe(1);
    await dishes.getDishesByIds([dishId], userIds[0]);
    expect(
      await prisma.browseHistory.count({ where: { userId: userIds[0] } }),
    ).toBe(1);
  });

  it('keeps deleted-content results in the reporter service inbox and exact owned result route', async () => {
    const report = await makeReport();
    await handle(report.id, 'delete_content').expect(200);
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: postId } }))
        .deletedAt,
    ).not.toBeNull();
    const inbox = await request(app.getHttpServer())
      .get('/notifications?scope=service')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const notice = inbox.body.data.items.find(
      (item: any) => item.targetId === report.id,
    );
    expect(notice).toMatchObject({
      type: 'report_handled',
      targetType: 'report',
      actor: null,
    });
    const detail = await request(app.getHttpServer())
      .get(`/user/reports/${report.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(detail.body.data).toMatchObject({
      id: report.id,
      status: 'approved',
      handleResult: '内容已删除',
      handledAt: expect.any(String),
    });
    await request(app.getHttpServer())
      .get(`/user/reports/${report.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/user/reports/${report.id}`)
      .expect(401);
    const others = await request(app.getHttpServer())
      .get('/user/reports')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(others.body.data.items).toEqual([]);
    const otherInbox = await notifications.getInbox(
      userIds[1],
      1,
      20,
      'service',
    );
    expect(otherInbox.data.items).toEqual([]);
    expect(
      await prisma.notificationOutbox.count({
        where: { notificationId: notice.id },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .put(`/notifications/${notice.id}/read?scope=service`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(
      (
        await prisma.notification.findUniqueOrThrow({
          where: { id: notice.id },
        })
      ).readAt,
    ).toBeNull();
    await request(app.getHttpServer())
      .put(`/notifications/${notice.id}/read?scope=service`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(
      (
        await prisma.notification.findUniqueOrThrow({
          where: { id: notice.id },
        })
      ).readAt,
    ).not.toBeNull();
  });

  it('commits one result and outbox event when administrators race or retry', async () => {
    const report = await makeReport();
    const results = await Promise.all([handle(report.id), handle(report.id)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    await handle(report.id).expect(400);
    expect(
      await prisma.notification.count({
        where: { targetType: 'report', targetId: report.id },
      }),
    ).toBe(1);
    expect(
      await prisma.notificationOutbox.count({
        where: { notification: { targetType: 'report', targetId: report.id } },
      }),
    ).toBe(1);
    const detail = await new UserProfileService(prisma).getMyReport(
      userIds[0],
      report.id,
    );
    expect(detail.data.status).toBe('rejected');
    expect(detail.data.handleResult).toBe('举报被拒绝');
  });

  it('rolls back the handling result and inbox/outbox rows together on a notification failure', async () => {
    const report = await makeReport();
    const create = notifications.create.bind(notifications);
    jest
      .spyOn(notifications, 'create')
      .mockImplementationOnce(async (tx, event) => {
        await create(tx, event);
        throw new Error('transaction rollback probe');
      });
    await expect(
      reports.handleReport(
        report.id,
        { action: 'warn_user' },
        {
          id: adminId,
          username: prefix,
          role: 'superadmin',
          scope: 'GLOBAL',
          canteenIds: [],
          permissions: [],
        },
      ),
    ).rejects.toThrow('transaction rollback probe');
    expect(
      (await prisma.report.findUniqueOrThrow({ where: { id: report.id } }))
        .status,
    ).toBe('pending');
    expect(
      await prisma.notification.count({
        where: { targetType: 'report', targetId: report.id },
      }),
    ).toBe(0);
    expect(
      await prisma.notificationOutbox.count({
        where: { notification: { targetType: 'report', targetId: report.id } },
      }),
    ).toBe(0);
  });

  const assertRetained = async (
    id: string,
    targetId: string,
    targetType: string,
  ) => {
    const detail = await request(app.getHttpServer())
      .get(`/user/reports/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(detail.body.data).toMatchObject({
      id,
      targetId,
      targetType,
      status: 'rejected',
      handleResult: '举报被拒绝',
      handledAt: expect.any(String),
    });
    await request(app.getHttpServer())
      .get(`/user/reports/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    const list = await request(app.getHttpServer())
      .get('/user/reports?pageSize=50')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.data.items.some((item: any) => item.id === id)).toBe(true);
    const inbox = await request(app.getHttpServer())
      .get('/notifications?scope=service&pageSize=50')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(inbox.body.data.items).toContainEqual(
      expect.objectContaining({
        targetId: id,
        targetType: 'report',
        type: 'report_handled',
      }),
    );
    const notice = await prisma.notification.findFirstOrThrow({
      where: { userId: userIds[0], targetType: 'report', targetId: id },
    });
    expect(await notifications.canDeliver(prisma, notice)).toBe(true);
    expect(
      (await notifications.getInbox(userIds[1], 1, 50, 'service')).data.items,
    ).toEqual([]);
  };

  it.each(['dish', 'canteen'])(
    'retains review and comment results after administrative %s deletion',
    async (removal) => {
      const canteen = await prisma.canteen.create({
        data: { name: `${prefix}-${removal}`, images: [], openingHours: [] },
      });
      try {
        const dish = await prisma.dish.create({
          data: {
            name: prefix,
            price: 1,
            canteenId: canteen.id,
            canteenName: prefix,
            windowName: prefix,
          },
        });
        const review = await prisma.review.create({
          data: {
            userId: userIds[1],
            dishId: dish.id,
            rating: 1,
            content: prefix,
            status: 'approved',
          },
        });
        const comment = await prisma.comment.create({
          data: {
            userId: userIds[1],
            reviewId: review.id,
            content: prefix,
            status: 'approved',
          },
        });
        const targets = [
          { targetType: 'review', targetId: review.id, reviewId: review.id },
          {
            targetType: 'comment',
            targetId: comment.id,
            commentId: comment.id,
          },
        ];
        const handled: Report[] = [];
        for (const target of targets) {
          const report = await prisma.report.create({
            data: {
              ...target,
              reporterId: userIds[0],
              type: 'spam',
              reason: '广告链接',
            },
          });
          reportIds.push(report.id);
          handled.push(report);
          await handle(report.id).expect(200);
        }
        const pending = await prisma.report.create({
          data: {
            targetType: 'review',
            targetId: review.id,
            reviewId: review.id,
            reporterId: userIds[0],
            type: 'other',
            reason: '待核实',
          },
        });
        reportIds.push(pending.id);
        const admin = {
          id: adminId,
          username: prefix,
          role: 'superadmin',
          scope: 'GLOBAL' as const,
          canteenIds: [],
          permissions: [],
        };
        if (removal === 'dish')
          await new AdminDishesService(prisma).deleteAdminDish(dish.id, admin);
        else
          await new AdminCanteensService(prisma, {} as never).remove(
            canteen.id,
            admin,
          );
        expect(
          await prisma.review.findUnique({ where: { id: review.id } }),
        ).toBeNull();
        expect(
          await prisma.comment.findUnique({ where: { id: comment.id } }),
        ).toBeNull();
        for (const report of handled) {
          const retained = await prisma.report.findUniqueOrThrow({
            where: { id: report.id },
          });
          expect(retained.reviewId).toBeNull();
          expect(retained.commentId).toBeNull();
          await assertRetained(report.id, report.targetId, report.targetType);
        }
        const management = await reports.getReports(
          1,
          50,
          'pending',
          undefined,
          admin,
        );
        expect(management.data.items).toContainEqual(
          expect.objectContaining({ id: pending.id, targetContent: undefined }),
        );
        await handle(pending.id).expect(200);
        await assertRetained(pending.id, review.id, 'review');
      } finally {
        await prisma.canteen.deleteMany({ where: { id: canteen.id } });
      }
    },
  );

  it('retains post and reply report results after physical post deletion', async () => {
    const post = await prisma.post.create({
      data: { userId: userIds[1], content: prefix, status: 'approved' },
    });
    try {
      const comment = await prisma.postComment.create({
        data: {
          userId: userIds[1],
          postId: post.id,
          content: prefix,
          status: 'approved',
        },
      });
      const handled: Report[] = [];
      for (const target of [
        { targetType: 'post', targetId: post.id, postId: post.id },
        {
          targetType: 'postComment',
          targetId: comment.id,
          postCommentId: comment.id,
        },
      ]) {
        const report = await prisma.report.create({
          data: {
            ...target,
            reporterId: userIds[0],
            type: 'spam',
            reason: '广告链接',
          },
        });
        reportIds.push(report.id);
        handled.push(report);
        await handle(report.id).expect(200);
      }
      await prisma.post.delete({ where: { id: post.id } });
      for (const report of handled) {
        const retained = await prisma.report.findUniqueOrThrow({
          where: { id: report.id },
        });
        expect(retained.postId).toBeNull();
        expect(retained.postCommentId).toBeNull();
        await assertRetained(report.id, report.targetId, report.targetType);
      }
    } finally {
      await prisma.post.deleteMany({ where: { id: post.id } });
    }
  });

  it('paginates owned reports deterministically and validates report query bounds', async () => {
    const first = await request(app.getHttpServer())
      .get('/user/reports?page=1&pageSize=1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/user/reports?page=2&pageSize=1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(first.body.data.meta).toMatchObject({
      page: 1,
      pageSize: 1,
      total: reportIds.length,
    });
    expect(first.body.data.items[0].id).not.toBe(second.body.data.items[0].id);
    for (const query of [
      'page=0',
      'page=-1',
      'page=1.5',
      'pageSize=51',
      'pageSize=nope',
    ]) {
      await request(app.getHttpServer())
        .get('/user/reports?' + query)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    }
  });
});
