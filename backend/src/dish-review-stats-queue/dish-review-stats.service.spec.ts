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

describe('DishReviewStatsService', () => {
  let service: DishReviewStatsService;

  beforeEach(async () => {
    mockPrisma.review.aggregate.mockReset();
    mockPrisma.dish.update.mockReset();
    mockConfigService.get.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishReviewStatsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        // Queue is not needed for sync-mode tests; service won't enqueue.
        { provide: 'BullQueue_dish-review-stats', useValue: {} },
      ],
    }).compile();

    service = module.get(DishReviewStatsService);
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
