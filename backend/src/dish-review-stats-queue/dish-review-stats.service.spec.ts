import { Test, TestingModule } from '@nestjs/testing';
import { DishReviewStatsService } from './dish-review-stats.service';
import { PrismaService } from '@/prisma.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { DISH_REVIEW_STATS_QUEUE } from './dish-review-stats.constants';

const mockPrismaService = {
  review: {
    aggregate: jest.fn(),
  },
  dish: {
    update: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test'),
};

const mockQueue = {
  add: jest.fn(),
};

describe('DishReviewStatsService', () => {
  let service: DishReviewStatsService;
  let prisma: typeof mockPrismaService;
  let queue: typeof mockQueue;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('test');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishReviewStatsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getQueueToken(DISH_REVIEW_STATS_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<DishReviewStatsService>(DishReviewStatsService);
    prisma = mockPrismaService;
    queue = mockQueue;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recomputeDishStats', () => {
    it('should recompute stats synchronously in test mode', async () => {
      prisma.review.aggregate.mockResolvedValue({
        _count: { _all: 10 },
        _avg: { rating: 4.5 },
      });
      prisma.dish.update.mockResolvedValue({});

      await service.recomputeDishStats('d1');

      expect(prisma.review.aggregate).toHaveBeenCalledWith({
        where: {
          dishId: 'd1',
          status: 'approved',
          deletedAt: null,
        },
        _count: { _all: true },
        _avg: { rating: true },
      });

      expect(prisma.dish.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          reviewCount: 10,
          averageRating: 4.5,
        },
      });
    });

    it('should use queue in async mode', async () => {
      mockConfigService.get.mockReturnValue('production');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DishReviewStatsService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
          {
            provide: getQueueToken(DISH_REVIEW_STATS_QUEUE),
            useValue: mockQueue,
          },
        ],
      }).compile();

      const asyncService = module.get<DishReviewStatsService>(
        DishReviewStatsService,
      );
      await asyncService.recomputeDishStats('d1');

      expect(queue.add).toHaveBeenCalled();
    });
  });

  describe('recomputeDishStatsNow', () => {
    it('should update dish with aggregated stats', async () => {
      prisma.review.aggregate.mockResolvedValue({
        _count: { _all: 5 },
        _avg: { rating: 3.8 },
      });
      prisma.dish.update.mockResolvedValue({});

      await service.recomputeDishStatsNow('d1');

      expect(prisma.dish.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          reviewCount: 5,
          averageRating: 3.8,
        },
      });
    });

    it('should handle no reviews', async () => {
      prisma.review.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _avg: { rating: null },
      });
      prisma.dish.update.mockResolvedValue({});

      await service.recomputeDishStatsNow('d1');

      expect(prisma.dish.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          reviewCount: 0,
          averageRating: 0,
        },
      });
    });
  });
});
