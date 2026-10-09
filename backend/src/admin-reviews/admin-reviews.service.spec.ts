import { Test, TestingModule } from '@nestjs/testing';
import { AdminReviewsService } from './admin-reviews.service';
import { PrismaService } from '@/prisma.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AdminReviewsController } from './admin-reviews.controller';
import { PERMISSIONS_KEY } from '@/auth/decorators/permissions.decorator';

const mockPrismaService = {
  review: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockDishReviewStatsService = {
  recomputeDishStats: jest.fn(),
};

describe('AdminReviewsService', () => {
  let service: AdminReviewsService;
  let prisma: typeof mockPrismaService;
  let dishReviewStatsService: typeof mockDishReviewStatsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: DishReviewStatsService,
          useValue: mockDishReviewStatsService,
        },
      ],
    }).compile();

    service = module.get<AdminReviewsService>(AdminReviewsService);
    prisma = mockPrismaService;
    dishReviewStatsService = mockDishReviewStatsService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPendingReviews', () => {
    const mockReviews = [
      {
        id: 'r1',
        dishId: 'd1',
        userId: 'u1',
        rating: 4,
        content: 'Great!',
        images: ['image.jpg'],
        status: 'pending',
        rejectReason: null,
        spicyLevel: null,
        sweetness: null,
        saltiness: null,
        oiliness: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        dish: {
          name: 'Dish 1',
          images: ['dish.jpg'],
        },
        user: {
          id: 'u1',
          nickname: 'User 1',
          avatar: 'avatar.jpg',
        },
      },
    ];

    it('should return list of pending reviews', async () => {
      prisma.review.findMany.mockResolvedValue(mockReviews);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getPendingReviews(1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it('preserves explicitly supplied zero intensity ratings in pending review details', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          ...mockReviews[0],
          spicyLevel: 0,
          sweetness: 0,
          saltiness: 0,
          oiliness: 0,
        },
      ]);
      prisma.review.count.mockResolvedValue(1);
      const result = await service.getPendingReviews();
      expect(result.data.items[0].ratingDetails).toEqual({
        spicyLevel: 0,
        sweetness: 0,
        saltiness: 0,
        oiliness: 0,
      });
    });

    it('should filter by canteenId for canteen admin', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.review.count.mockResolvedValue(0);

      await service.getPendingReviews(1, 20, { canteenId: 'c1' });

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dish: { canteenId: 'c1' },
          }),
        }),
      );
    });

    it('should handle reviews with rating details', async () => {
      const reviewWithDetails = {
        ...mockReviews[0],
        spicyLevel: 3,
        sweetness: 2,
        saltiness: 1,
        oiliness: 2,
      };
      prisma.review.findMany.mockResolvedValue([reviewWithDetails]);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getPendingReviews(1, 20);

      expect(result.data.items[0].ratingDetails).not.toBeNull();
      expect(result.data.items[0].ratingDetails?.spicyLevel).toBe(3);
    });
  });

  describe('approveReview', () => {
    beforeEach(() => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        status: 'pending',
        dish: { canteenId: 'c1' },
      });
    });

    it('should approve a review', async () => {
      prisma.review.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.approveReview('r1', {
        expectedUpdatedAt: '2026-10-08T12:00:00.000Z',
      });

      expect(result.code).toBe(200);
      expect(result.message).toBe('审核通过');
      expect(prisma.review.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'r1',
          deletedAt: null,
          status: 'pending',
          updatedAt: new Date('2026-10-08T12:00:00.000Z'),
        },
        data: { status: 'approved', rejectReason: null },
      });
      expect(dishReviewStatsService.recomputeDishStats).toHaveBeenCalledWith(
        'd1',
      );
    });

    it('should throw NotFoundException if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.approveReview('unknown', {
          expectedUpdatedAt: '2026-10-08T12:00:00.000Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      await expect(
        service.approveReview(
          'r1',
          { expectedUpdatedAt: '2026-10-08T12:00:00.000Z' },
          { canteenId: 'c2' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectReview', () => {
    beforeEach(() => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        status: 'pending',
        dish: { canteenId: 'c1' },
      });
    });

    it('should reject a review with reason', async () => {
      prisma.review.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.rejectReview('r1', {
        reason: 'Inappropriate',
        expectedUpdatedAt: '2026-10-08T12:00:00.000Z',
      });

      expect(result.code).toBe(200);
      expect(result.message).toBe('已拒绝');
      expect(prisma.review.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'r1',
          deletedAt: null,
          status: 'pending',
          updatedAt: new Date('2026-10-08T12:00:00.000Z'),
        },
        data: {
          status: 'rejected',
          rejectReason: 'Inappropriate',
        },
      });
      expect(dishReviewStatsService.recomputeDishStats).toHaveBeenCalledWith(
        'd1',
      );
    });

    it('should throw NotFoundException if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectReview('unknown', {
          reason: 'reason',
          expectedUpdatedAt: '2026-10-08T12:00:00.000Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      await expect(
        service.rejectReview(
          'r1',
          { reason: 'reason', expectedUpdatedAt: '2026-10-08T12:00:00.000Z' },
          { canteenId: 'c2' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteReview', () => {
    beforeEach(() => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        deletedAt: null,
        dish: { canteenId: 'c1' },
      });
    });

    it('should soft delete a review', async () => {
      prisma.review.update.mockResolvedValue({});

      const result = await service.deleteReview('r1');

      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(dishReviewStatsService.recomputeDishStats).toHaveBeenCalledWith(
        'd1',
      );
    });

    it('should throw NotFoundException if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.deleteReview('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      await expect(
        service.deleteReview('r1', { canteenId: 'c2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getReviewComments', () => {
    const mockComments = [
      {
        id: 'c1',
        reviewId: 'r1',
        userId: 'u1',
        content: 'Great review!',
        floor: 1,
        parentCommentId: null,
        status: 'approved',
        rejectReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        user: {
          id: 'u1',
          nickname: 'User 1',
          avatar: 'avatar.jpg',
        },
      },
    ];

    beforeEach(() => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dish: { canteenId: 'c1' },
      });
    });

    it('should return list of comments', async () => {
      prisma.comment.findMany.mockResolvedValue(mockComments);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.getReviewComments('r1', 1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
      expect(result.data.items[0]).toMatchObject({
        userNickname: 'User 1',
        userAvatar: 'avatar.jpg',
        parentComment: null,
      });
    });

    it('returns reply target identity even when the parent comment is deleted', async () => {
      prisma.comment.findMany.mockResolvedValue([
        {
          ...mockComments[0],
          parentCommentId: 'parent',
          parentComment: {
            id: 'parent',
            userId: 'u2',
            deletedAt: new Date(),
            user: { nickname: 'Parent author' },
          },
        },
      ]);
      prisma.comment.count.mockResolvedValue(1);
      const result = await service.getReviewComments('r1');
      expect((result.data.items[0] as any).parentComment).toEqual({
        id: 'parent',
        userId: 'u2',
        userNickname: 'Parent author',
        deleted: true,
      });
    });

    it('should throw NotFoundException if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.getReviewComments('unknown', 1, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      await expect(
        service.getReviewComments('r1', 1, 20, { canteenId: 'c2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

describe('AdminReviewsController permissions', () => {
  it('allows review or comment deletion duties to read comments for deletion management', () => {
    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdminReviewsController.prototype.getReviewComments,
    );

    expect(permissions).toEqual([
      'review:approve',
      'review:delete',
      'comment:delete',
    ]);
  });
});
