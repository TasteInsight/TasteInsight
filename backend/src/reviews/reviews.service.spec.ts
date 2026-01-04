import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '@/prisma.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReportType } from '@/common/enums';

const mockPrismaService = {
  dish: {
    findUnique: jest.fn(),
  },
  review: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  report: {
    create: jest.fn(),
  },
};

const mockAdminConfigService = {
  getBooleanConfigValue: jest.fn(),
};

const mockDishReviewStatsService = {
  recomputeDishStats: jest.fn(),
};

const mockEmbeddingQueueService = {
  enqueueRefreshUser: jest.fn(),
};

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: typeof mockPrismaService;
  let adminConfigService: typeof mockAdminConfigService;
  let dishReviewStatsService: typeof mockDishReviewStatsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AdminConfigService, useValue: mockAdminConfigService },
        {
          provide: DishReviewStatsService,
          useValue: mockDishReviewStatsService,
        },
        { provide: EmbeddingQueueService, useValue: mockEmbeddingQueueService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = mockPrismaService;
    adminConfigService = mockAdminConfigService;
    dishReviewStatsService = mockDishReviewStatsService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReview', () => {
    const createDto = {
      dishId: 'd1',
      rating: 4,
      content: 'Great dish!',
      images: ['image.jpg'],
      ratingDetails: {
        spicyLevel: 2,
        sweetness: 1,
        saltiness: 1,
        oiliness: 2,
      },
    };

    beforeEach(() => {
      prisma.dish.findUnique.mockResolvedValue({
        id: 'd1',
        canteenId: 'c1',
      });
      adminConfigService.getBooleanConfigValue.mockResolvedValue(true);
      prisma.review.findUnique.mockResolvedValue(null);
    });

    it('should create a new review', async () => {
      prisma.review.upsert.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        userId: 'u1',
        rating: 4,
        content: 'Great dish!',
        images: ['image.jpg'],
        status: 'approved',
        spicyLevel: 2,
        sweetness: 1,
        saltiness: 1,
        oiliness: 2,
        createdAt: new Date(),
        deletedAt: null,
        user: {
          id: 'u1',
          nickname: 'User 1',
          avatar: 'avatar.jpg',
        },
      });

      const result = await service.createReview('u1', createDto);

      expect(result.code).toBe(201);
      expect(result.message).toBe('创建成功');
      expect(dishReviewStatsService.recomputeDishStats).toHaveBeenCalledWith(
        'd1',
      );
    });

    it('should update existing review', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'existing-r1',
        dishId: 'd1',
        userId: 'u1',
      });
      prisma.review.upsert.mockResolvedValue({
        id: 'existing-r1',
        dishId: 'd1',
        userId: 'u1',
        rating: 5,
        content: 'Updated!',
        images: [],
        status: 'approved',
        createdAt: new Date(),
        deletedAt: null,
        user: {
          id: 'u1',
          nickname: 'User 1',
          avatar: null,
        },
      });

      const result = await service.createReview('u1', {
        ...createDto,
        rating: 5,
      });

      expect(result.code).toBe(201);
      expect(result.message).toBe('更新成功');
    });

    it('should throw NotFoundException if dish not found', async () => {
      prisma.dish.findUnique.mockResolvedValue(null);

      await expect(service.createReview('u1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set status to pending if auto-approve is disabled', async () => {
      adminConfigService.getBooleanConfigValue.mockResolvedValue(false);
      prisma.review.upsert.mockResolvedValue({
        id: 'r1',
        status: 'pending',
        createdAt: new Date(),
        deletedAt: null,
        user: { id: 'u1', nickname: 'User', avatar: null },
      });

      await service.createReview('u1', createDto);

      expect(dishReviewStatsService.recomputeDishStats).not.toHaveBeenCalled();
    });
  });

  describe('getReviews', () => {
    const mockReviews = [
      {
        id: 'r1',
        dishId: 'd1',
        userId: 'u1',
        rating: 4,
        content: 'Great!',
        images: [],
        spicyLevel: null,
        sweetness: null,
        saltiness: null,
        oiliness: null,
        createdAt: new Date(),
        deletedAt: null,
        user: {
          id: 'u1',
          nickname: 'User 1',
          avatar: 'avatar.jpg',
        },
      },
    ];

    it('should return list of reviews', async () => {
      prisma.review.findMany.mockResolvedValue(mockReviews);
      prisma.review.count.mockResolvedValue(1);
      prisma.review.groupBy.mockResolvedValue([
        { rating: 4, _count: { rating: 1 } },
      ]);

      const result = await service.getReviews('d1', 1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.rating.average).toBe(4);
      expect(result.data.rating.total).toBe(1);
    });

    it('should calculate average rating correctly', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.review.count.mockResolvedValue(0);
      prisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { rating: 2 } },
        { rating: 4, _count: { rating: 3 } },
      ]);

      const result = await service.getReviews('d1', 1, 20);

      expect(result.data.rating.average).toBe((5 * 2 + 4 * 3) / 5);
      expect(result.data.rating.total).toBe(5);
    });

    it('should return 0 average if no reviews', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.review.count.mockResolvedValue(0);
      prisma.review.groupBy.mockResolvedValue([]);

      const result = await service.getReviews('d1', 1, 20);

      expect(result.data.rating.average).toBe(0);
      expect(result.data.rating.total).toBe(0);
    });
  });

  describe('reportReview', () => {
    it('should create a report', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        deletedAt: null,
      });
      prisma.report.create.mockResolvedValue({
        id: 'report-1',
      });

      const result = await service.reportReview('u1', 'r1', {
        type: ReportType.SPAM,
        reason: 'This is spam',
      });

      expect(result.code).toBe(201);
      expect(result.message).toBe('举报成功');
      expect(result.data).toBe('report-1');
    });

    it('should throw NotFoundException if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.reportReview('u1', 'unknown', {
          type: ReportType.SPAM,
          reason: 'spam',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteReview', () => {
    it('should soft delete a review', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        dishId: 'd1',
        deletedAt: null,
      });
      prisma.review.update.mockResolvedValue({});

      const result = await service.deleteReview('u1', 'r1');

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

      await expect(service.deleteReview('u1', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if review already deleted', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        deletedAt: new Date(),
      });

      await expect(service.deleteReview('u1', 'r1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'other-user',
        deletedAt: null,
      });

      await expect(service.deleteReview('u1', 'r1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
