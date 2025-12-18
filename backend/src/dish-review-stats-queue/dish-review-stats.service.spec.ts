import { Test, TestingModule } from '@nestjs/testing';
import { DishReviewStatsService } from './dish-review-stats.service';
import { PrismaService } from '@/prisma.service';
import { ConfigService } from '@nestjs/config';

const mockPrisma = {
  review: {
    aggregate: jest.fn(),
  },
  dish: {
    update: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('DishReviewStatsService', () => {
  let service: DishReviewStatsService;

  describe('recomputeDishStats (sync mode)', () => {
    beforeEach(async () => {
      mockPrisma.review.aggregate.mockReset();
      mockPrisma.dish.update.mockReset();
      mockConfigService.get.mockReset();
      mockQueue.add.mockReset();

      mockConfigService.get.mockReturnValue('test');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DishReviewStatsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: 'BullQueue_dish-review-stats', useValue: mockQueue },
        ],
      }).compile();

      service = module.get(DishReviewStatsService);
    });

    it('should run synchronously in test environment (no enqueue)', async () => {
      mockPrisma.review.aggregate.mockResolvedValue({
        _count: { _all: 1 },
        _avg: { rating: 4 },
      });
      mockPrisma.dish.update.mockResolvedValue({});

      await service.recomputeDishStats('d1');

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(mockPrisma.review.aggregate).toHaveBeenCalledWith({
        where: { dishId: 'd1', status: 'approved', deletedAt: null },
        _count: { _all: true },
        _avg: { rating: true },
      });
      expect(mockPrisma.dish.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { reviewCount: 1, averageRating: 4 },
      });
    });
  });

  describe('recomputeDishStats (async mode)', () => {
    beforeEach(async () => {
      mockPrisma.review.aggregate.mockReset();
      mockPrisma.dish.update.mockReset();
      mockConfigService.get.mockReset();
      mockQueue.add.mockReset();

      mockConfigService.get.mockReturnValue('development');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DishReviewStatsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: 'BullQueue_dish-review-stats', useValue: mockQueue },
        ],
      }).compile();

      service = module.get(DishReviewStatsService);
    });

    it('should enqueue a job outside test environment', async () => {
      mockQueue.add.mockResolvedValue({});

      await service.recomputeDishStats('d1');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'recompute-dish-review-stats',
        { dishId: 'd1' },
        expect.any(Object),
      );
      expect(mockPrisma.review.aggregate).not.toHaveBeenCalled();
      expect(mockPrisma.dish.update).not.toHaveBeenCalled();
    });
  });

  describe('recomputeDishStatsNow', () => {
    it('should update dish stats using approved, non-deleted reviews', async () => {
      mockConfigService.get.mockReturnValue('test');
      mockPrisma.review.aggregate.mockResolvedValue({
        _count: { _all: 4 },
        _avg: { rating: 3.25 },
      });
      mockPrisma.dish.update.mockResolvedValue({});

      await service.recomputeDishStatsNow('d1');

      expect(mockPrisma.review.aggregate).toHaveBeenCalledWith({
        where: { dishId: 'd1', status: 'approved', deletedAt: null },
        _count: { _all: true },
        _avg: { rating: true },
      });
      expect(mockPrisma.dish.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { reviewCount: 4, averageRating: 3.25 },
      });
    });

    it('should write zeros when there are no approved reviews', async () => {
      mockConfigService.get.mockReturnValue('test');
      mockPrisma.review.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _avg: { rating: null },
      });
      mockPrisma.dish.update.mockResolvedValue({});

      await service.recomputeDishStatsNow('d1');

      expect(mockPrisma.dish.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { reviewCount: 0, averageRating: 0 },
      });
    });
  });
});
