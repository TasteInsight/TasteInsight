import { ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReviewsService } from './reviews.service';
import { AdminReviewsService } from '@/admin-reviews/admin-reviews.service';
import { AdminCommentsService } from '@/admin-comments/admin-comments.service';
import { AdminReportsService } from '@/admin-reports/admin-reports.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';

const timestamp = new Date('2026-10-10T00:00:00.000Z');
const admin = {
  id: 'admin',
  username: 'admin',
  role: 'superadmin',
  scope: 'GLOBAL' as const,
  canteenIds: [],
  canteens: [],
  permissions: [],
};

function fixture() {
  const state = {
    status: 'pending',
    deletedAt: null as Date | null,
    canteenId: 'canteen',
    reviewCount: 0,
    reportStatus: 'pending',
  };
  const view = () => ({
    id: 'review',
    userId: 'author',
    dishId: 'dish',
    status: state.status,
    deletedAt: state.deletedAt,
    rating: 4,
    createdAt: timestamp,
    updatedAt: timestamp,
    user: { nickname: 'Author', avatar: null },
    dish: { canteenId: state.canteenId },
  });
  const comment = () => ({
    id: 'comment',
    reviewId: 'review',
    userId: 'commenter',
    status: 'pending',
    deletedAt: state.deletedAt,
    review: view(),
  });
  const locks: string[] = [];
  const prisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn((query) => {
      locks.push(query.sql ?? query.join('?'));
      return Promise.resolve([{ id: 'dish' }]);
    }),
    dish: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: 'dish',
          canteenId: state.canteenId,
        }),
      ),
    },
    studentVerification: {
      findFirst: jest.fn(() => Promise.resolve({ id: 'verification' })),
    },
    review: {
      findUnique: jest.fn(() => Promise.resolve(view())),
      findMany: jest.fn(() => Promise.resolve([view()])),
      upsert: jest.fn(({ update }) => {
        Object.assign(state, update);
        return Promise.resolve(view());
      }),
      update: jest.fn(({ data }) => {
        Object.assign(state, data);
        return Promise.resolve(view());
      }),
      updateMany: jest.fn(({ data }) => {
        Object.assign(state, data);
        return Promise.resolve({ count: 1 });
      }),
    },
    comment: {
      findUnique: jest.fn(() => Promise.resolve(comment())),
      findMany: jest.fn(() => Promise.resolve([comment()])),
      update: jest.fn(({ data }) => {
        Object.assign(state, data);
        return Promise.resolve(comment());
      }),
      updateMany: jest.fn(({ data }) => {
        Object.assign(state, data);
        return Promise.resolve({ count: 1 });
      }),
    },
    report: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: 'report',
          status: state.reportStatus,
          targetType: 'review',
          reviewId: 'review',
          review: view(),
          comment: null,
        }),
      ),
      updateMany: jest.fn(({ data }) => {
        state.reportStatus = data.status;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  let beforeTransaction = () => {};
  let insideTransaction = false;
  prisma.$transaction.mockImplementation(async (callback) => {
    beforeTransaction();
    const snapshot = { ...state };
    insideTransaction = true;
    try {
      return await callback(prisma);
    } catch (error) {
      Object.assign(state, snapshot);
      throw error;
    } finally {
      insideTransaction = false;
    }
  });
  const stats = {
    recomputeDishStats: jest.fn(
      (): Promise<void> => Promise.reject(new Error('Redis unavailable')),
    ),
    recomputeBatch: jest.fn(() => {
      expect(insideTransaction).toBe(true);
      state.reviewCount =
        state.status === 'approved' && !state.deletedAt ? 1 : 0;
      return Promise.resolve();
    }),
  };
  const notifications = {
    create: jest.fn(),
    withdraw: jest.fn(),
    withdrawThread: jest.fn(),
  };
  const config = { getBooleanConfigValue: jest.fn().mockResolvedValue(false) };
  const embeddingService = new EmbeddingQueueService(
    {} as never,
    new ConfigService({ NODE_ENV: 'test' }),
  );
  const enqueueRefreshUser = jest
    .spyOn(embeddingService, 'enqueueRefreshUser')
    .mockResolvedValue('job');
  const embedding = Object.assign(embeddingService, { enqueueRefreshUser });
  return {
    state,
    prisma,
    stats,
    locks,
    config,
    notifications,
    embedding,
    beforeTransaction: (callback: () => void) => {
      beforeTransaction = callback;
    },
    reviews: new ReviewsService(
      prisma as never,
      config as never,
      stats as never,
      notifications as never,
      embedding as never,
    ),
    adminReviews: new AdminReviewsService(
      prisma as never,
      stats as never,
      notifications as never,
      embedding,
    ),
    adminComments: new AdminCommentsService(
      prisma as never,
      notifications as never,
    ),
    reports: new AdminReportsService(
      prisma as never,
      stats as never,
      notifications as never,
      embedding,
    ),
  };
}

const submission = {
  dishId: 'dish',
  rating: 4,
  content: 'Updated',
  images: [],
};

describe('review write consistency', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    'create',
    'edit',
    'delete',
    'approve',
    'admin-delete',
    'admin-batch-delete',
    'report-delete',
  ] as const)(
    '%s responds after commit without waiting for a stalled recommendation queue',
    async (kind) => {
      const f = fixture();
      const approvedBefore = !['create', 'approve'].includes(kind);
      f.state.status = approvedBefore ? 'approved' : 'pending';
      f.state.reviewCount = approvedBefore ? 1 : 0;
      f.config.getBooleanConfigValue.mockResolvedValue(kind === 'create');
      if (kind === 'create')
        f.prisma.review.findUnique.mockResolvedValueOnce(null as never);
      f.embedding.enqueueRefreshUser.mockImplementation(
        () => new Promise(() => {}),
      );
      const operation =
        kind === 'create' || kind === 'edit'
          ? f.reviews.createReview('author', submission)
          : kind === 'delete'
            ? f.reviews.deleteReview('author', 'review')
            : kind === 'approve'
              ? f.adminReviews.approveReview(
                  'review',
                  { expectedUpdatedAt: timestamp.toISOString() },
                  admin,
                )
              : kind === 'admin-delete'
                ? f.adminReviews.deleteReview('review', admin)
                : kind === 'admin-batch-delete'
                  ? f.adminReviews.batchDeleteReviews(['review'], admin)
                  : f.reports.handleReport(
                      'report',
                      { action: 'delete_content' },
                      admin,
                    );
      const nextTurn = new Promise<never>((_resolve, reject) => {
        setImmediate(() =>
          reject(new Error('Response waited for derived refresh')),
        );
      });
      const result = await Promise.race([operation, nextTurn]);
      expect(result.code).toBe(
        kind === 'create' || kind === 'edit' ? 201 : 200,
      );
      expect(f.state.reviewCount).toBe(
        kind === 'create' || kind === 'approve' ? 1 : 0,
      );
      expect(f.embedding.enqueueRefreshUser).toHaveBeenCalledWith('author');
      expect(f.stats.recomputeDishStats).not.toHaveBeenCalled();
    },
  );

  it('removes an approval committed before resubmission from the same aggregate transaction', async () => {
    const f = fixture();
    f.beforeTransaction(() => {
      f.state.status = 'approved';
      f.state.reviewCount = 1;
    });
    await f.reviews.createReview('author', submission);
    expect(f.state.status).toBe('pending');
    expect(f.state.reviewCount).toBe(0);
    expect(f.stats.recomputeBatch).toHaveBeenCalledWith(f.prisma, ['dish']);
    expect(f.locks[0]).toContain('FROM dishes');
  });

  it('saves an approved review and its aggregate without requiring Redis delivery', async () => {
    const f = fixture();
    f.config.getBooleanConfigValue.mockResolvedValue(true);
    await expect(
      f.reviews.createReview('author', submission),
    ).resolves.toMatchObject({
      code: 201,
      data: { status: 'approved' },
    });
    expect(f.state.reviewCount).toBe(1);
    expect(f.stats.recomputeDishStats).not.toHaveBeenCalled();
  });

  it('reports a committed review as saved when the derived embedding refresh fails', async () => {
    const f = fixture();
    f.embedding.enqueueRefreshUser.mockRejectedValue(
      new Error('Redis unavailable'),
    );
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await expect(
      f.reviews.createReview('author', submission),
    ).resolves.toMatchObject({
      code: 201,
      data: { status: 'pending' },
    });
    expect(warning).toHaveBeenCalled();
  });

  it('rolls back a review update if its aggregate cannot be written', async () => {
    const f = fixture();
    f.config.getBooleanConfigValue.mockResolvedValue(true);
    f.stats.recomputeBatch.mockRejectedValue(new Error('aggregate failed'));
    await expect(f.reviews.createReview('author', submission)).rejects.toThrow(
      'aggregate failed',
    );
    expect(f.state.status).toBe('pending');
    expect(f.state.reviewCount).toBe(0);
    expect(f.embedding.enqueueRefreshUser).not.toHaveBeenCalled();
  });

  it('deletes an owned review and removes its aggregate before commit', async () => {
    const f = fixture();
    f.state.status = 'approved';
    f.state.reviewCount = 1;
    await expect(
      f.reviews.deleteReview('author', 'review'),
    ).resolves.toMatchObject({ code: 200 });
    expect(f.state.deletedAt).toBeInstanceOf(Date);
    expect(f.state.reviewCount).toBe(0);
    expect(f.stats.recomputeDishStats).not.toHaveBeenCalled();
  });

  it('approves a review and its aggregate together without a post-commit queue', async () => {
    const f = fixture();
    await expect(
      f.adminReviews.approveReview(
        'review',
        {
          expectedUpdatedAt: timestamp.toISOString(),
        },
        admin,
      ),
    ).resolves.toMatchObject({ code: 200 });
    expect(f.state.status).toBe('approved');
    expect(f.state.reviewCount).toBe(1);
    expect(f.locks[0]).toContain('FROM dishes');
  });

  it('commits report-triggered deletion and its aggregate atomically', async () => {
    const f = fixture();
    f.state.status = 'approved';
    f.state.reviewCount = 1;
    await expect(
      f.reports.handleReport('report', { action: 'delete_content' }, admin),
    ).resolves.toMatchObject({ code: 200 });
    expect(f.state.reportStatus).toBe('approved');
    expect(f.state.reviewCount).toBe(0);
    expect(f.locks[0]).toContain('FROM dishes');
  });

  it.each(['owner', 'moderation', 'report'] as const)(
    'rolls back the %s state transition when its aggregate update fails',
    async (kind) => {
      const f = fixture();
      const status = kind === 'moderation' ? 'pending' : 'approved';
      f.state.status = status;
      f.state.reviewCount = status === 'approved' ? 1 : 0;
      f.stats.recomputeBatch.mockRejectedValue(new Error('aggregate failed'));
      const operation =
        kind === 'owner'
          ? f.reviews.deleteReview('author', 'review')
          : kind === 'moderation'
            ? f.adminReviews.approveReview(
                'review',
                { expectedUpdatedAt: timestamp.toISOString() },
                admin,
              )
            : f.reports.handleReport(
                'report',
                { action: 'delete_content' },
                admin,
              );
      await expect(operation).rejects.toThrow('aggregate failed');
      expect(f.state.status).toBe(status);
      expect(f.state.deletedAt).toBeNull();
      expect(f.state.reviewCount).toBe(status === 'approved' ? 1 : 0);
      expect(f.state.reportStatus).toBe('pending');
      expect(f.embedding.enqueueRefreshUser).not.toHaveBeenCalled();
    },
  );

  it.each(['review', 'comment', 'report'] as const)(
    'rechecks %s moderation scope after acquiring its dish lock',
    async (kind) => {
      const f = fixture();
      f.prisma.$queryRaw.mockImplementationOnce(() => {
        f.state.canteenId = 'other';
        return Promise.resolve([]);
      });
      const scope = {
        ...admin,
        scope: 'CANTEENS' as const,
        canteenIds: ['canteen'],
      };
      const operation =
        kind === 'review'
          ? f.adminReviews.approveReview(
              'review',
              { expectedUpdatedAt: timestamp.toISOString() },
              scope,
            )
          : kind === 'comment'
            ? f.adminComments.approveComment('comment', scope)
            : f.reports.handleReport(
                'report',
                { action: 'delete_content' },
                scope,
              );
      await expect(operation).rejects.toThrow(ForbiddenException);
      expect(f.prisma.review.updateMany).not.toHaveBeenCalled();
      expect(f.prisma.comment.updateMany).not.toHaveBeenCalled();
      expect(f.prisma.report.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each(['review', 'comment'] as const)(
    'rejects single %s deletion after canteen reassignment before its transaction',
    async (kind) => {
      const f = fixture();
      f.beforeTransaction(() => {
        f.state.canteenId = 'other';
      });
      const scope = {
        ...admin,
        scope: 'CANTEENS' as const,
        canteenIds: ['canteen'],
      };
      const operation =
        kind === 'review'
          ? f.adminReviews.deleteReview('review', scope)
          : f.adminComments.deleteComment('comment', scope);
      await expect(operation).rejects.toThrow(ForbiddenException);
      expect(f.state.deletedAt).toBeNull();
      expect(f.notifications.withdraw).not.toHaveBeenCalled();
    },
  );

  it.each(['review', 'comment'] as const)(
    'uses dish-before-review locks for permitted single %s deletion',
    async (kind) => {
      const f = fixture();
      const operation =
        kind === 'review'
          ? f.adminReviews.deleteReview('review', admin)
          : f.adminComments.deleteComment('comment', admin);
      await expect(operation).resolves.toEqual({
        code: 200,
        message: '删除成功',
        data: null,
      });
      expect(f.locks[0]).toContain('FROM dishes');
      expect(f.locks[1]).toContain('FROM reviews');
      expect(f.notifications.withdraw).toHaveBeenCalled();
      if (kind === 'comment') expect(f.locks[2]).toContain('FROM comments');
    },
  );
});
