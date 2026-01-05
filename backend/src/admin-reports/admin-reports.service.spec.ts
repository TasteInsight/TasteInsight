import { Test, TestingModule } from '@nestjs/testing';
import { AdminReportsService } from './admin-reports.service';
import { PrismaService } from '@/prisma.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

const mockPrismaService = {
  report: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
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
  let prisma: typeof mockPrismaService;
  let dishReviewStatsService: typeof mockDishReviewStatsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: DishReviewStatsService,
          useValue: mockDishReviewStatsService,
        },
      ],
    }).compile();

    service = module.get<AdminReportsService>(AdminReportsService);
    prisma = mockPrismaService;
    dishReviewStatsService = mockDishReviewStatsService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReports', () => {
    const mockReports = [
      {
        id: 'report-1',
        reporterId: 'u1',
        targetType: 'review',
        targetId: 'r1',
        type: 'spam',
        reason: 'Spam content',
        status: 'pending',
        handleResult: null,
        handledBy: null,
        handledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        reporter: {
          id: 'u1',
          nickname: 'User 1',
          avatar: 'avatar.jpg',
        },
        review: {
          content: 'Review content',
          userId: 'u2',
          deletedAt: null,
          images: ['image.jpg'],
          user: {
            id: 'u2',
            nickname: 'User 2',
            avatar: null,
          },
        },
        comment: null,
      },
    ];

    it('should return list of reports', async () => {
      prisma.report.findMany.mockResolvedValue(mockReports);
      prisma.report.count.mockResolvedValue(1);

      const result = await service.getReports(1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.report.findMany.mockResolvedValue([]);
      prisma.report.count.mockResolvedValue(0);

      await service.getReports(1, 20, 'pending');

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('should filter by targetType', async () => {
      prisma.report.findMany.mockResolvedValue([]);
      prisma.report.count.mockResolvedValue(0);

      await service.getReports(1, 20, undefined, 'review');

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ targetType: 'review' }),
        }),
      );
    });

    it('should handle comment reports', async () => {
      const commentReport = {
        ...mockReports[0],
        targetType: 'comment',
        review: null,
        comment: {
          content: 'Comment content',
          userId: 'u2',
          deletedAt: null,
          user: {
            id: 'u2',
            nickname: 'User 2',
            avatar: null,
          },
        },
      };
      prisma.report.findMany.mockResolvedValue([commentReport]);
      prisma.report.count.mockResolvedValue(1);

      const result = await service.getReports(1, 20);

      expect(result.data.items[0].targetContent?.content).toBe(
        'Comment content',
      );
    });
  });

  describe('handleReport', () => {
    const adminInfo = { id: 'admin-1', canteenId: null, role: 'superadmin' };

    beforeEach(() => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        status: 'pending',
        targetType: 'review',
        reviewId: 'r1',
        commentId: null,
        review: {
          id: 'r1',
          dishId: 'd1',
          dish: { canteenId: 'c1' },
        },
        comment: null,
      });
    });

    it('should reject report', async () => {
      prisma.report.update.mockResolvedValue({});

      const result = await service.handleReport(
        'report-1',
        { action: 'reject_report', result: 'Not valid' },
        adminInfo as any,
      );

      expect(result.code).toBe(200);
      expect(result.message).toBe('处理成功');
    });

    it('should delete content for approved reports', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        dishId: 'd1',
        deletedAt: null,
      });
      prisma.report.update.mockResolvedValue({});
      prisma.review.update.mockResolvedValue({});

      const result = await service.handleReport(
        'report-1',
        { action: 'delete_content' },
        adminInfo as any,
      );

      expect(result.code).toBe(200);
      expect(prisma.review.update).toHaveBeenCalled();
      expect(dishReviewStatsService.recomputeDishStats).toHaveBeenCalledWith(
        'd1',
      );
    });

    it('should warn user', async () => {
      prisma.report.update.mockResolvedValue({});

      const result = await service.handleReport(
        'report-1',
        { action: 'warn_user' },
        adminInfo as any,
      );

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if report not found', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(
        service.handleReport(
          'unknown',
          { action: 'reject_report' },
          adminInfo as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already handled', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        status: 'approved',
      });

      await expect(
        service.handleReport(
          'report-1',
          { action: 'reject_report' },
          adminInfo as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      const canteenAdmin = { id: 'admin-1', canteenId: 'c2', role: 'admin' };

      await expect(
        service.handleReport(
          'report-1',
          { action: 'reject_report' },
          canteenAdmin as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
