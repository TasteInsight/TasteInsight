import { Test, TestingModule } from '@nestjs/testing';
import { AdminReviewsService } from './admin-reviews.service';
import { PrismaService } from '@/prisma.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  review: {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  comment: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockDishReviewStatsService = {
  recomputeDishStats: jest.fn(),
};

describe('AdminReviewsService', () => {
  let service: AdminReviewsService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    for (const key in mockPrisma) {
      for (const fn in mockPrisma[key]) {
        mockPrisma[key][fn].mockReset && mockPrisma[key][fn].mockReset();
      }
    }
    mockDishReviewStatsService.recomputeDishStats.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminReviewsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: DishReviewStatsService,
          useValue: mockDishReviewStatsService,
        },
      ],
    }).compile();

    service = module.get(AdminReviewsService);
    prisma = module.get(PrismaService);
  });

  describe('approveReview', () => {
    it('should throw if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(service.approveReview('r1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should approve and recompute dish stats', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        deletedAt: null,
      });
      prisma.review.update.mockResolvedValue({});

      const result = await service.approveReview('r1');

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'approved' },
      });
      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).toHaveBeenCalledWith('d1');
      expect(result.code).toBe(200);
    });
  });

  describe('rejectReview', () => {
    it('should reject and recompute dish stats', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        deletedAt: null,
      });
      prisma.review.update.mockResolvedValue({});

      const result = await service.rejectReview('r1', { reason: 'no' });

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          status: 'rejected',
          rejectReason: 'no',
        },
      });
      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).toHaveBeenCalledWith('d1');
      expect(result.code).toBe(200);
    });
  });

  describe('deleteReview', () => {
    it('should delete and recompute dish stats', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        deletedAt: null,
      });
      prisma.review.update.mockResolvedValue({});

      const result = await service.deleteReview('r1');

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).toHaveBeenCalledWith('d1');
      expect(result.code).toBe(200);
    });
  });
});
