import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from '@/prisma.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

const mockPrismaService = {
  comment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  review: {
    findUnique: jest.fn(),
  },
  dish: {
    findUnique: jest.fn(),
  },
  report: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
  $queryRaw: jest.fn(),
};

const mockAdminConfigService = {
  getBooleanConfigValue: jest.fn(),
};

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: typeof mockPrismaService;
  let adminConfigService: typeof mockAdminConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AdminConfigService, useValue: mockAdminConfigService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    prisma = mockPrismaService;
    adminConfigService = mockAdminConfigService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getComments', () => {
    const mockComments = [
      {
        id: 'c1',
        reviewId: 'r1',
        userId: 'u1',
        content: 'Great!',
        floor: 1,
        status: 'approved',
        createdAt: new Date(),
        deletedAt: null,
        user: {
          id: 'u1',
          nickname: 'User 1',
          avatar: 'avatar.jpg',
        },
        parentComment: null,
      },
    ];

    it('should return list of comments', async () => {
      prisma.comment.findMany.mockResolvedValue(mockComments);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.getComments('r1', 1, 10);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it('should handle comments with parent', async () => {
      const commentWithParent = {
        ...mockComments[0],
        parentComment: {
          id: 'c0',
          userId: 'u0',
          user: { nickname: 'Parent User' },
          deletedAt: null,
        },
      };
      prisma.comment.findMany.mockResolvedValue([commentWithParent]);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.getComments('r1', 1, 10);

      expect(result.data.items[0].parentComment).not.toBeNull();
      expect(result.data.items[0].parentComment?.userNickname).toBe(
        'Parent User',
      );
    });
  });

  describe('createComment', () => {
    const createDto = {
      reviewId: 'r1',
      content: 'Nice review!',
      parentCommentId: undefined,
    };

    beforeEach(() => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'r1' }]);
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'approved',
        deletedAt: null,
        dishId: 'd1',
      });
      prisma.dish.findUnique.mockResolvedValue({
        id: 'd1',
        canteenId: 'c1',
      });
      prisma.comment.count.mockResolvedValue(0);
      adminConfigService.getBooleanConfigValue.mockResolvedValue(true);
    });

    it('should create a new comment', async () => {
      prisma.comment.create.mockResolvedValue({
        id: 'c1',
        reviewId: 'r1',
        userId: 'u1',
        content: 'Nice review!',
        floor: 1,
        status: 'approved',
        createdAt: new Date(),
        deletedAt: null,
        user: {
          id: 'u1',
          nickname: 'User 1',
          avatar: null,
        },
        parentComment: null,
      });

      const result = await service.createComment('u1', createDto);

      expect(result.code).toBe(201);
      expect(result.message).toBe('评论发布成功');
    });

    it('should throw NotFoundException if review not found', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.createComment('u1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if review not approved', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'r1' }]);
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.createComment('u1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if parent comment not found', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.createComment('u1', {
          ...createDto,
          parentCommentId: 'invalid',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if parent comment is deleted', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'parent-c',
        reviewId: 'r1',
        deletedAt: new Date(),
      });

      await expect(
        service.createComment('u1', {
          ...createDto,
          parentCommentId: 'parent-c',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reportComment', () => {
    it('should create a report', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        deletedAt: null,
      });
      prisma.report.create.mockResolvedValue({
        id: 'report-1',
      });

      const result = await service.reportComment('u1', 'c1', {
        type: 'spam',
        reason: 'Spam content',
      });

      expect(result.code).toBe(201);
      expect(result.message).toBe('举报提交成功');
    });

    it('should throw NotFoundException if comment not found', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.reportComment('u1', 'unknown', {
          type: 'spam',
          reason: 'spam',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteComment', () => {
    it('should soft delete a comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        deletedAt: null,
      });
      prisma.comment.update.mockResolvedValue({});

      const result = await service.deleteComment('u1', 'c1');

      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
    });

    it('should throw NotFoundException if comment not found', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.deleteComment('u1', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'other-user',
        deletedAt: null,
      });

      await expect(service.deleteComment('u1', 'c1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
