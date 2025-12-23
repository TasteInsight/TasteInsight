import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '@/prisma.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import { ConfigKeys } from '@/admin-config/config-definitions';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReportType } from '@/common/enums';

const mockPrisma = {
  dish: { findUnique: jest.fn(), update: jest.fn() },
  review: {
    create: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  report: { create: jest.fn() },
};

const mockAdminConfigService = {
  getBooleanConfigValue: jest.fn(),
};

const mockDishReviewStatsService = {
  recomputeDishStats: jest.fn(),
};

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    for (const key in mockPrisma) {
      for (const fn in mockPrisma[key]) {
        mockPrisma[key][fn].mockReset && mockPrisma[key][fn].mockReset();
      }
    }
    mockAdminConfigService.getBooleanConfigValue.mockReset();
    mockDishReviewStatsService.recomputeDishStats.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AdminConfigService, useValue: mockAdminConfigService },
        {
          provide: DishReviewStatsService,
          useValue: mockDishReviewStatsService,
        },
      ],
    }).compile();
    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReview', () => {
    it('should throw if dish not found', async () => {
      prisma.dish.findUnique.mockResolvedValue(null);
      await expect(
        service.createReview('u1', {
          dishId: 'd1',
          rating: 5,
          content: 'c',
          images: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });
    it('should create review with detailed ratings and return data', async () => {
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1', canteenId: 'c1' });
      mockAdminConfigService.getBooleanConfigValue.mockResolvedValue(false);

      // Mock findUnique to return null (no existing review)
      prisma.review.findUnique.mockResolvedValue(null);

      // Mock upsert to create new review
      prisma.review.upsert.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        userId: 'u1',
        rating: 5,
        content: 'c',
        images: [],
        status: 'pending',
        spicyLevel: 3,
        sweetness: 2,
        saltiness: 3,
        oiliness: 4,
        createdAt: new Date(),
        deletedAt: null,
        user: { id: 'u1', nickname: 'nick', avatar: 'a' },
      });
      const result = await service.createReview('u1', {
        dishId: 'd1',
        rating: 5,
        content: 'c',
        images: [],
        ratingDetails: {
          spicyLevel: 3,
          sweetness: 2,
          saltiness: 3,
          oiliness: 4,
        },
      });
      expect(prisma.dish.findUnique).toHaveBeenCalled();
      expect(prisma.review.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            spicyLevel: 3,
            sweetness: 2,
            saltiness: 3,
            oiliness: 4,
          }),
        }),
      );
      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).not.toHaveBeenCalled();
      expect(result).toHaveProperty('code', 201);
      expect(result).toHaveProperty('message', '创建成功');
      expect(result.data).toHaveProperty('id', 'r1');
      expect(result.data.ratingDetails).toHaveProperty('spicyLevel', 3);
    });

    it('should create approved review when auto-approve is enabled', async () => {
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1', canteenId: 'c1' });
      mockAdminConfigService.getBooleanConfigValue.mockResolvedValue(true);

      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.upsert.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        userId: 'u1',
        rating: 5,
        content: 'c',
        images: [],
        status: 'approved',
        spicyLevel: null,
        sweetness: null,
        saltiness: null,
        oiliness: null,
        createdAt: new Date(),
        deletedAt: null,
        user: { id: 'u1', nickname: 'nick', avatar: 'a' },
      });
      const result = await service.createReview('u1', {
        dishId: 'd1',
        rating: 5,
        content: 'c',
        images: [],
      });
      expect(mockAdminConfigService.getBooleanConfigValue).toHaveBeenCalledWith(
        ConfigKeys.REVIEW_AUTO_APPROVE,
        'c1',
      );
      expect(prisma.review.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'approved',
          }),
        }),
      );
      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).toHaveBeenCalledWith('d1');
      expect(result).toHaveProperty('code', 201);
      expect(result.data).toHaveProperty('id', 'r1');
    });

    it('should enqueue dish stats recompute (auto-approved)', async () => {
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1', canteenId: 'c1' });
      mockAdminConfigService.getBooleanConfigValue.mockResolvedValue(true);

      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.upsert.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        userId: 'u1',
        rating: 4,
        content: 'c',
        images: [],
        status: 'approved',
        spicyLevel: null,
        sweetness: null,
        saltiness: null,
        oiliness: null,
        createdAt: new Date(),
        deletedAt: null,
        user: { id: 'u1', nickname: 'nick', avatar: 'a' },
      });

      await service.createReview('u1', {
        dishId: 'd1',
        rating: 4,
        content: 'c',
        images: [],
      });

      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).toHaveBeenCalledWith('d1');
    });

    it('should enqueue dish stats recompute (pending)', async () => {
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1', canteenId: 'c1' });
      mockAdminConfigService.getBooleanConfigValue.mockResolvedValue(false);

      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.upsert.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        userId: 'u1',
        rating: 1,
        content: 'pending',
        images: [],
        status: 'pending',
        spicyLevel: null,
        sweetness: null,
        saltiness: null,
        oiliness: null,
        createdAt: new Date(),
        deletedAt: null,
        user: { id: 'u1', nickname: 'nick', avatar: 'a' },
      });

      await service.createReview('u1', {
        dishId: 'd1',
        rating: 1,
        content: 'pending',
        images: [],
      });

      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getReviews', () => {
    it('should return reviews with rating stats and details', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'r1',
          dishId: 'd1',
          userId: 'u1',
          rating: 5,
          content: 'c',
          images: [],
          spicyLevel: 3,
          sweetness: 2,
          saltiness: 3,
          oiliness: 4,
          createdAt: new Date(),
          deletedAt: null,
          user: { id: 'u1', nickname: 'nick', avatar: 'a' },
        },
      ]);
      prisma.review.count.mockResolvedValue(1);
      prisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { rating: 1 } },
      ]);
      const result = await service.getReviews('d1', 1, 20);
      expect(prisma.review.findMany).toHaveBeenCalled();
      expect(prisma.review.count).toHaveBeenCalled();
      expect(prisma.review.groupBy).toHaveBeenCalled();
      expect(result).toHaveProperty('code', 200);
      expect(result.data.items.length).toBe(1);
      expect(result.data.items[0].ratingDetails).toHaveProperty(
        'spicyLevel',
        3,
      );
      expect(result.data.rating.average).toBe(5);
    });

    it('should return empty reviews with zero average rating', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.review.count.mockResolvedValue(0);
      prisma.review.groupBy.mockResolvedValue([]);
      const result = await service.getReviews('d1', 1, 20);
      expect(prisma.review.findMany).toHaveBeenCalled();
      expect(prisma.review.count).toHaveBeenCalled();
      expect(prisma.review.groupBy).toHaveBeenCalled();
      expect(result).toHaveProperty('code', 200);
      expect(result.data.items.length).toBe(0);
      expect(result.data.rating.average).toBe(0);
      expect(result.data.rating.total).toBe(0);
    });
  });

  describe('reportReview', () => {
    it('should throw if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(
        service.reportReview('u1', 'r1', {
          type: ReportType.SPAM,
          reason: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
    it('should create report and return id', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.report.create.mockResolvedValue({ id: 'rep1' });
      const result = await service.reportReview('u1', 'r1', {
        type: ReportType.SPAM,
        reason: 'test',
      });
      expect(prisma.review.findUnique).toHaveBeenCalled();
      expect(prisma.report.create).toHaveBeenCalled();
      expect(result).toHaveProperty('code', 201);
      expect(result.data).toBe('rep1');
    });
  });

  describe('deleteReview', () => {
    it('should throw if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(service.deleteReview('u1', 'r1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if user is not owner', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'other',
        deletedAt: null,
      });
      await expect(service.deleteReview('u1', 'r1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should soft delete review and return success', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        dishId: 'd1',
        deletedAt: null,
      });
      prisma.review.update.mockResolvedValue({});
      const result = await service.deleteReview('u1', 'r1');
      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).toHaveBeenCalledWith('d1');
      expect(result.code).toBe(200);
    });
  });
});
