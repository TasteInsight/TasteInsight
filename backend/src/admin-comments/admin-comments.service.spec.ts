import { Test, TestingModule } from '@nestjs/testing';
import { AdminCommentsService } from './admin-comments.service';
import { PrismaService } from '@/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrismaService = {
  comment: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('AdminCommentsService', () => {
  let service: AdminCommentsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCommentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminCommentsService>(AdminCommentsService);
    prisma = mockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPendingComments', () => {
    const mockComments = [
      {
        id: 'c1',
        reviewId: 'r1',
        userId: 'u1',
        content: 'Test comment',
        status: 'pending',
        rejectReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        review: {
          content: 'Review content',
          dish: {
            name: 'Dish 1',
          },
        },
      },
    ];

    it('should return list of pending comments', async () => {
      prisma.comment.findMany.mockResolvedValue(mockComments);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.getPendingComments(1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it('should filter by canteenId for canteen admin', async () => {
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.count.mockResolvedValue(0);

      await service.getPendingComments(1, 20, { canteenId: 'can1' });

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            review: expect.objectContaining({
              dish: expect.objectContaining({
                canteenId: 'can1',
              }),
            }),
          }),
        }),
      );
    });

    it('should use default pagination values', async () => {
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.count.mockResolvedValue(0);

      await service.getPendingComments();

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  describe('approveComment', () => {
    beforeEach(() => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'pending',
        review: {
          dish: {
            canteenId: 'can1',
          },
        },
      });
    });

    it('should approve a comment', async () => {
      prisma.comment.update.mockResolvedValue({
        id: 'c1',
        status: 'approved',
      });

      const result = await service.approveComment('c1');

      expect(result.code).toBe(200);
      expect(result.message).toBe('操作成功');
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'approved' },
      });
    });

    it('should throw NotFoundException if comment not found', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.approveComment('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      await expect(
        service.approveComment('c1', { canteenId: 'can2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectComment', () => {
    beforeEach(() => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'pending',
        review: {
          dish: {
            canteenId: 'can1',
          },
        },
      });
    });

    it('should reject a comment with reason', async () => {
      prisma.comment.update.mockResolvedValue({
        id: 'c1',
        status: 'rejected',
        rejectReason: 'Inappropriate content',
      });

      const result = await service.rejectComment('c1', {
        reason: 'Inappropriate content',
      });

      expect(result.code).toBe(200);
      expect(result.message).toBe('操作成功');
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          status: 'rejected',
          rejectReason: 'Inappropriate content',
        },
      });
    });

    it('should throw NotFoundException if comment not found', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectComment('unknown', { reason: 'reason' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      await expect(
        service.rejectComment(
          'c1',
          { reason: 'reason' },
          { canteenId: 'can2' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteComment', () => {
    beforeEach(() => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        deletedAt: null,
        review: {
          dish: {
            canteenId: 'can1',
          },
        },
      });
    });

    it('should soft delete a comment', async () => {
      prisma.comment.update.mockResolvedValue({
        id: 'c1',
        deletedAt: new Date(),
      });

      const result = await service.deleteComment('c1');

      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if comment not found', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.deleteComment('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      await expect(
        service.deleteComment('c1', { canteenId: 'can2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
