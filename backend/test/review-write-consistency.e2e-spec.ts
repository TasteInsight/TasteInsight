import { randomUUID } from 'crypto';
import { ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { ReviewsService } from '@/reviews/reviews.service';
import { AdminReviewsService } from '@/admin-reviews/admin-reviews.service';
import { AdminCommentsService } from '@/admin-comments/admin-comments.service';
import { AdminReportsService } from '@/admin-reports/admin-reports.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { NotificationService } from '@/notifications/notification.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';

describe('review mutation consistency (PostgreSQL)', () => {
  const prefix = `review-consistency-${randomUUID()}`;
  const canteenIds: string[] = [];
  const dishIds: string[] = [];
  const userIds: string[] = [];
  let db: PrismaService;
  let reviews: ReviewsService;
  let adminReviews: AdminReviewsService;
  let adminComments: AdminCommentsService;
  let reports: AdminReportsService;
  let stats: DishReviewStatsService;
  let embedding: EmbeddingQueueService;
  const queue = {
    add: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  };
  const embeddingQueue = {
    add: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  };
  const config = { getBooleanConfigValue: jest.fn().mockResolvedValue(false) };
  const admin = {
    id: '',
    username: 'review-test-admin',
    role: 'superadmin',
    scope: 'GLOBAL' as const,
    canteenIds: [],
    canteens: [],
    permissions: [],
  };

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL)
      throw new Error('An explicit test database is required');
    db = new PrismaService();
    await db.$connect();
    admin.id = (
      await db.admin.create({
        data: {
          scope: 'GLOBAL',
          username: prefix,
          password: 'unused-token-fixture',
          role: 'superadmin',
        },
      })
    ).id;
    const notifications = new NotificationService(
      db,
      new ConfigService({ NOTIFICATION_WEBHOOK_URL: '' }),
    );
    stats = new DishReviewStatsService(
      queue as never,
      new ConfigService({ NODE_ENV: 'production' }),
      db,
    );
    embedding = new EmbeddingQueueService(
      embeddingQueue as never,
      new ConfigService({ NODE_ENV: 'production' }),
    );
    reviews = new ReviewsService(
      db,
      config as never,
      stats,
      notifications,
      embedding,
    );
    adminReviews = new AdminReviewsService(db, stats, notifications, embedding);
    adminComments = new AdminCommentsService(db, notifications);
    reports = new AdminReportsService(db, stats, notifications, embedding);
    for (let index = 0; index < 2; index++) {
      canteenIds.push(
        (
          await db.canteen.create({
            data: { name: `${prefix}-${index}`, openingHours: [], images: [] },
          })
        ).id,
      );
      userIds.push(
        (
          await db.user.create({
            data: {
              nickname: `${prefix}-${index}`,
              studentVerification: {
                create: {
                  method: 'MANUAL_REVIEW',
                  status: 'VERIFIED',
                  expiresAt: new Date(Date.now() + 86400000),
                },
              },
            },
          })
        ).id,
      );
    }
  });

  beforeEach(() => {
    config.getBooleanConfigValue.mockResolvedValue(false);
    queue.add.mockClear();
    embeddingQueue.add
      .mockReset()
      .mockRejectedValue(new Error('Redis unavailable'));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    try {
      if (db) {
        await db.report.deleteMany({ where: { reporterId: { in: userIds } } });
        await db.dish.deleteMany({ where: { id: { in: dishIds } } });
        if (admin.id) await db.admin.delete({ where: { id: admin.id } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        await db.canteen.deleteMany({ where: { id: { in: canteenIds } } });
      }
    } finally {
      await db?.$disconnect();
    }
  });

  const createReview = async (status: 'pending' | 'approved') => {
    const dish = await db.dish.create({
      data: {
        name: prefix,
        price: 10,
        canteenId: canteenIds[0],
        canteenName: prefix,
        windowName: '窗口',
        reviewCount: status === 'approved' ? 1 : 0,
        averageRating: status === 'approved' ? 4 : 0,
      },
    });
    dishIds.push(dish.id);
    return db.review.create({
      data: {
        dishId: dish.id,
        userId: userIds[0],
        rating: 4,
        content: prefix,
        status,
      },
    });
  };

  it('keeps submitted state and aggregates aligned while approval competes with editing', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const review = await createReview('pending');
      const outcomes = await Promise.allSettled([
        adminReviews.approveReview(
          review.id,
          { expectedUpdatedAt: review.updatedAt.toISOString() },
          admin,
        ),
        reviews.createReview(userIds[0], {
          dishId: review.dishId,
          rating: 2,
          content: 'Edited',
          images: [],
        }),
      ]);
      expect(outcomes[1].status).toBe('fulfilled');
      if (outcomes[0].status === 'rejected')
        expect(outcomes[0].reason).toBeInstanceOf(ConflictException);
      expect(
        await db.review.findUniqueOrThrow({ where: { id: review.id } }),
      ).toMatchObject({ status: 'pending', rating: 2 });
      expect(
        await db.dish.findUniqueOrThrow({ where: { id: review.dishId } }),
      ).toMatchObject({ reviewCount: 0, averageRating: 0 });
    }
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns a saved review when both Redis-backed queues are unavailable', async () => {
    config.getBooleanConfigValue.mockResolvedValue(true);
    const review = await createReview('pending');
    await expect(
      reviews.createReview(userIds[0], {
        dishId: review.dishId,
        rating: 5,
        content: 'Approved',
        images: [],
      }),
    ).resolves.toMatchObject({ code: 201, data: { status: 'approved' } });
    expect(
      await db.dish.findUniqueOrThrow({ where: { id: review.dishId } }),
    ).toMatchObject({ reviewCount: 1, averageRating: 5 });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns an approved review while its background embedding producer remains pending', async () => {
    config.getBooleanConfigValue.mockResolvedValue(true);
    embeddingQueue.add.mockImplementation(() => new Promise(() => {}));
    const review = await createReview('pending');
    await expect(
      reviews.createReview(userIds[0], {
        dishId: review.dishId,
        rating: 5,
        content: 'Saved before queue recovers',
        images: [],
      }),
    ).resolves.toMatchObject({ code: 201, data: { status: 'approved' } });
    expect(
      await db.dish.findUniqueOrThrow({ where: { id: review.dishId } }),
    ).toMatchObject({ reviewCount: 1, averageRating: 5 });
    expect(embeddingQueue.add).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rolls back the review when the aggregate update fails in its transaction', async () => {
    config.getBooleanConfigValue.mockResolvedValue(true);
    const review = await createReview('pending');
    jest
      .spyOn(stats, 'recomputeBatch')
      .mockRejectedValueOnce(new Error('aggregate failed'));
    await expect(
      reviews.createReview(userIds[0], {
        dishId: review.dishId,
        rating: 5,
        content: 'Not committed',
        images: [],
      }),
    ).rejects.toThrow('aggregate failed');
    expect(
      await db.review.findUniqueOrThrow({ where: { id: review.id } }),
    ).toMatchObject({ status: 'pending', rating: 4, content: prefix });
    expect(
      await db.dish.findUniqueOrThrow({ where: { id: review.dishId } }),
    ).toMatchObject({ reviewCount: 0, averageRating: 0 });
  });

  it.each(['owner', 'admin', 'report'] as const)(
    'updates statistics synchronously for %s deletion',
    async (actor) => {
      const review = await createReview('approved');
      if (actor === 'owner') await reviews.deleteReview(userIds[0], review.id);
      else if (actor === 'admin')
        await adminReviews.deleteReview(review.id, admin);
      else {
        const report = await db.report.create({
          data: {
            reporterId: userIds[1],
            targetType: 'review',
            targetId: review.id,
            reviewId: review.id,
            type: 'spam',
            reason: prefix,
          },
        });
        await reports.handleReport(
          report.id,
          { action: 'delete_content' },
          admin,
        );
      }
      expect(
        await db.dish.findUniqueOrThrow({ where: { id: review.dishId } }),
      ).toMatchObject({ reviewCount: 0, averageRating: 0 });
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it.each(['review', 'comment'] as const)(
    'denies single %s deletion outside the current canteen',
    async (kind) => {
      const review = await createReview('approved');
      const comment = await db.comment.create({
        data: {
          reviewId: review.id,
          userId: userIds[1],
          content: prefix,
          status: 'approved',
        },
      });
      await db.dish.update({
        where: { id: review.dishId },
        data: { canteenId: canteenIds[1] },
      });
      const scoped = {
        ...admin,
        role: 'admin',
        scope: 'CANTEENS' as const,
        canteenIds: [canteenIds[0]],
        canteens: [{ id: canteenIds[0], name: canteenIds[0] }],
      };
      await expect(
        kind === 'review'
          ? adminReviews.deleteReview(review.id, scoped)
          : adminComments.deleteComment(comment.id, scoped),
      ).rejects.toThrow(ForbiddenException);
      expect(
        (await db.review.findUniqueOrThrow({ where: { id: review.id } }))
          .deletedAt,
      ).toBeNull();
      expect(
        (await db.comment.findUniqueOrThrow({ where: { id: comment.id } }))
          .deletedAt,
      ).toBeNull();
    },
  );
});
