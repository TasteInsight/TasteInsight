import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '@/prisma.service';
import { AdminReportsController } from '@/admin-reports/admin-reports.controller';
import { AdminReportsService } from '@/admin-reports/admin-reports.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { NotificationService } from '@/notifications/notification.service';

const targets = [
  { targetType: 'review', permission: 'review:delete' },
  { targetType: 'comment', permission: 'comment:delete' },
  { targetType: 'post', permission: 'post:delete' },
  { targetType: 'postComment', permission: 'post:delete' },
] as const;
type ReportTarget = (typeof targets)[number]['targetType'];

describe('reported content deletion permissions (PostgreSQL and HTTP)', () => {
  const prefix = `report-permissions-${randomUUID()}`;
  const accessSecret = 'isolated-report-permissions-access-secret';
  const userIds: string[] = [];
  const canteenIds: string[] = [];
  const adminIds: string[] = [];
  const targetIds = {} as Record<ReportTarget, string>;
  let app: INestApplication;
  let prisma: PrismaService;
  let handlerId: string;
  let handlerToken: string;
  let superadminToken: string;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL)
      throw new Error('An explicit test database is required');
    const module = await Test.createTestingModule({
      controllers: [AdminReportsController],
      providers: [
        PrismaService,
        AdminReportsService,
        NotificationService,
        JwtService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            NODE_ENV: 'test',
            JWT_SECRET: accessSecret,
          }),
        },
        {
          provide: DishReviewStatsService,
          useValue: {
            recomputeBatch: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    for (const role of ['admin', 'superadmin']) {
      const admin = await prisma.admin.create({
        data: {
          scope: 'GLOBAL',
          username: `${prefix}-${role}`,
          password: 'unused-test-hash',
          role,
        },
      });
      adminIds.push(admin.id);
      const token = jwt.sign(
        { sub: admin.id, type: 'admin', tokenUse: 'access' },
        { secret: accessSecret },
      );
      if (role === 'admin') {
        handlerId = admin.id;
        handlerToken = token;
      } else {
        superadminToken = token;
      }
    }
    for (let index = 0; index < 2; index++) {
      userIds.push(
        (await prisma.user.create({ data: { nickname: prefix } })).id,
      );
      canteenIds.push(
        (
          await prisma.canteen.create({
            data: { name: `${prefix}-${index}`, images: [], openingHours: [] },
          })
        ).id,
      );
    }
    const dish = await prisma.dish.create({
      data: {
        name: prefix,
        price: 1,
        canteenId: canteenIds[0],
        canteenName: prefix,
        windowName: prefix,
      },
    });
    targetIds.review = (
      await prisma.review.create({
        data: {
          userId: userIds[0],
          dishId: dish.id,
          rating: 1,
          content: prefix,
          status: 'approved',
        },
      })
    ).id;
    targetIds.comment = (
      await prisma.comment.create({
        data: {
          userId: userIds[0],
          reviewId: targetIds.review,
          content: prefix,
          status: 'approved',
        },
      })
    ).id;
    targetIds.post = (
      await prisma.post.create({
        data: { userId: userIds[0], content: prefix, status: 'approved' },
      })
    ).id;
    targetIds.postComment = (
      await prisma.postComment.create({
        data: {
          userId: userIds[0],
          postId: targetIds.post,
          content: prefix,
          status: 'approved',
        },
      })
    ).id;
  });

  beforeEach(async () => {
    await prisma.admin.update({
      where: { id: handlerId },
      data: { scope: 'GLOBAL', canteens: { deleteMany: {} } },
    });
    await prisma.adminPermission.deleteMany({ where: { adminId: handlerId } });
    await Promise.all([
      prisma.review.update({
        where: { id: targetIds.review },
        data: { deletedAt: null },
      }),
      prisma.comment.update({
        where: { id: targetIds.comment },
        data: { deletedAt: null },
      }),
      prisma.post.update({
        where: { id: targetIds.post },
        data: { deletedAt: null },
      }),
      prisma.postComment.update({
        where: { id: targetIds.postComment },
        data: { deletedAt: null },
      }),
    ]);
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.report.deleteMany({
          where: { reporterId: { in: userIds } },
        });
        await prisma.admin.deleteMany({ where: { id: { in: adminIds } } });
        await prisma.canteen.deleteMany({ where: { id: { in: canteenIds } } });
        await prisma.post.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  const readTargets = {
    review: () =>
      prisma.review.findUniqueOrThrow({ where: { id: targetIds.review } }),
    comment: () =>
      prisma.comment.findUniqueOrThrow({ where: { id: targetIds.comment } }),
    post: () =>
      prisma.post.findUniqueOrThrow({ where: { id: targetIds.post } }),
    postComment: () =>
      prisma.postComment.findUniqueOrThrow({
        where: { id: targetIds.postComment },
      }),
  };
  const createReport = (targetType: ReportTarget) =>
    prisma.report.create({
      data: {
        reporterId: userIds[1],
        targetType,
        targetId: targetIds[targetType],
        ...{
          review: { reviewId: targetIds.review },
          comment: { commentId: targetIds.comment },
          post: { postId: targetIds.post },
          postComment: { postCommentId: targetIds.postComment },
        }[targetType],
        type: 'spam',
        reason: prefix,
      },
    });
  const setPermissions = async (permissions: string[]) => {
    await prisma.adminPermission.deleteMany({ where: { adminId: handlerId } });
    await prisma.adminPermission.createMany({
      data: permissions.map((permission) => ({
        adminId: handlerId,
        permission,
      })),
    });
  };
  const handle = (
    reportId: string,
    action: 'delete_content' | 'reject_report',
    token = handlerToken,
  ) =>
    request(app.getHttpServer())
      .post(`/admin/reports/${reportId}/handle`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action });

  it.each(targets)(
    'requires report handling and the matching delete permission for $targetType',
    async ({ targetType, permission }) => {
      const report = await createReport(targetType);
      const content = await readTargets[targetType]();
      const unrelatedDelete =
        permission === 'review:delete' ? 'post:delete' : 'review:delete';
      for (const permissions of [
        [permission],
        ['report:handle'],
        ['report:handle', unrelatedDelete],
      ]) {
        await setPermissions(permissions);
        await handle(report.id, 'delete_content').expect(403);
        expect(
          await prisma.report.findUnique({ where: { id: report.id } }),
        ).toEqual(report);
        expect(await readTargets[targetType]()).toEqual(content);
      }
      await setPermissions(['report:handle', permission]);
      await handle(report.id, 'delete_content').expect(200);
      expect(
        await prisma.report.findUnique({ where: { id: report.id } }),
      ).toMatchObject({ status: 'approved', handledBy: handlerId });
      expect((await readTargets[targetType]()).deletedAt).not.toBeNull();
    },
  );

  it.each(targets)(
    'allows superadmin to delete reported $targetType without permission rows',
    async ({ targetType }) => {
      const report = await createReport(targetType);
      await handle(report.id, 'delete_content', superadminToken).expect(200);
      expect((await readTargets[targetType]()).deletedAt).not.toBeNull();
      expect(
        await prisma.report.findUnique({ where: { id: report.id } }),
      ).toMatchObject({ status: 'approved' });
    },
  );

  it.each(targets)(
    'rejects a $targetType report with report:handle alone',
    async ({ targetType }) => {
      const report = await createReport(targetType);
      const content = await readTargets[targetType]();
      await setPermissions(['report:handle']);
      await handle(report.id, 'reject_report').expect(200);
      expect(
        await prisma.report.findUnique({ where: { id: report.id } }),
      ).toMatchObject({ status: 'rejected', handledBy: handlerId });
      expect(await readTargets[targetType]()).toEqual(content);
    },
  );

  it.each(targets)(
    'retains the canteen/global scope boundary for $targetType despite delete permission',
    async ({ targetType, permission }) => {
      const report = await createReport(targetType);
      const content = await readTargets[targetType]();
      await setPermissions(['report:handle', permission]);
      await prisma.admin.update({
        where: { id: handlerId },
        data: {
          scope: canteenIds[1] ? 'CANTEENS' : 'GLOBAL',
          canteens: {
            deleteMany: {},
            create: canteenIds[1] ? [{ canteenId: canteenIds[1] }] : [],
          },
        },
      });
      await handle(report.id, 'delete_content').expect(403);
      expect(
        await prisma.report.findUnique({ where: { id: report.id } }),
      ).toEqual(report);
      expect(await readTargets[targetType]()).toEqual(content);
    },
  );
});
