import { Test, TestingModule } from '@nestjs/testing';
import { AdminReportsService } from './admin-reports.service';
import { PrismaService } from '@/prisma.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  report: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  review: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  comment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockDishReviewStatsService = {
  recomputeDishStats: jest.fn(),
};

describe('AdminReportsService', () => {
  let service: AdminReportsService;
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
        AdminReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: DishReviewStatsService,
          useValue: mockDishReviewStatsService,
        },
      ],
    }).compile();

    service = module.get(AdminReportsService);
    prisma = module.get(PrismaService);
  });

  describe('handleReport', () => {
    it('should throw if report not found', async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(
        service.handleReport(
          'rep1',
          { action: 'delete_content', result: 'x' } as any,
          'a1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if report already handled', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'rep1',
        status: 'approved',
      });
      await expect(
        service.handleReport(
          'rep1',
          { action: 'delete_content', result: 'x' } as any,
          'a1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should soft delete reported review and recompute dish stats', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'rep1',
        status: 'pending',
        targetType: 'review',
        reviewId: 'r1',
        commentId: null,
      });
      prisma.report.update.mockResolvedValue({});
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        deletedAt: null,
      });
      prisma.review.update.mockResolvedValue({});

      const result = await service.handleReport(
        'rep1',
        { action: 'delete_content', result: '内容已删除' } as any,
        'a1',
      );

      expect(prisma.report.update).toHaveBeenCalled();
      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).toHaveBeenCalledWith('d1');
      expect(result.code).toBe(200);
    });

    it('should not recompute if review already deleted', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'rep1',
        status: 'pending',
        targetType: 'review',
        reviewId: 'r1',
        commentId: null,
      });
      prisma.report.update.mockResolvedValue({});
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        deletedAt: new Date(),
      });

      const result = await service.handleReport(
        'rep1',
        { action: 'delete_content', result: '内容已删除' } as any,
        'a1',
      );

      expect(prisma.review.update).not.toHaveBeenCalled();
      expect(
        mockDishReviewStatsService.recomputeDishStats,
      ).not.toHaveBeenCalled();
      expect(result.code).toBe(200);
    });
  });
});
