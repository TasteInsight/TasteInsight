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
    beforeEach(() => {
      prisma.review.findUnique.mockResolvedValue({ status: 'approved' });
    });
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

    it('returns the moderation state and the ability to reply', async () => {
      prisma.review.findUnique.mockResolvedValue({ status: 'approved' });
      prisma.comment.findMany.mockResolvedValue([
        { ...mockComments[0], status: 'pending' },
      ]);
      prisma.comment.count.mockResolvedValue(1);
      const result = await Reflect.apply(service.getComments, service, [
        'r1',
        1,
        10,
        'u1',
      ]);
      expect(result.data).toMatchObject({ canReply: true });
      expect(result.data.items[0]).toMatchObject({ status: 'pending' });
    });

    it('uses the same viewer-specific visibility for items and pagination totals', async () => {
      prisma.review.findUnique.mockResolvedValue({ status: 'approved' });
      prisma.comment.findMany.mockResolvedValue([]);
      prisma.comment.count.mockResolvedValue(0);
      await Reflect.apply(service.getComments, service, ['r1', 1, 10, 'u1']);
      const where = {
        reviewId: 'r1',
        deletedAt: null,
        review: {
          deletedAt: null,
          OR: [{ status: 'approved' }, { userId: 'u1' }],
        },
        OR: [
          { status: 'approved' },
          { userId: 'u1', status: { in: ['pending', 'rejected'] } },
        ],
      };
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(prisma.comment.count).toHaveBeenCalledWith({ where });
    });

    it('does not read replies when their review is hidden from the viewer', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(
        Reflect.apply(service.getComments, service, ['r1', 1, 10, 'u2']),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.comment.findMany).not.toHaveBeenCalled();
    });

    it('allows the author to read replies to their unpublished review without allowing new replies', async () => {
      prisma.review.findUnique.mockResolvedValue({ status: 'pending' });
      prisma.comment.findMany.mockResolvedValue(mockComments);
      prisma.comment.count.mockResolvedValue(1);
      const result = await Reflect.apply(service.getComments, service, [
        'r1',
        1,
        10,
        'u1',
      ]);
      expect(result.data.canReply).toBe(false);
      expect(result.data.items).toHaveLength(1);
    });

    it('omits a parent reply that is not visible to the viewer', async () => {
      prisma.review.findUnique.mockResolvedValue({ status: 'approved' });
      prisma.comment.findMany.mockResolvedValue([
        {
          ...mockComments[0],
          parentComment: {
            id: 'hidden-parent',
            userId: 'other',
            status: 'rejected',
            deletedAt: null,
            user: { nickname: 'Private author' },
          },
        },
      ]);
      prisma.comment.count.mockResolvedValue(1);
      const result = await Reflect.apply(service.getComments, service, [
        'r1',
        1,
        10,
        'u1',
      ]);
      expect(result.data.items[0].parentComment).toBeNull();
    });

    it('should return list of comments', async () => {
      prisma.comment.findMany.mockResolvedValue(mockComments);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.getComments('r1', 1, 10, 'u1');

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
          status: 'approved',
          user: { nickname: 'Parent User' },
          deletedAt: null,
        },
      };
      prisma.comment.findMany.mockResolvedValue([commentWithParent]);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.getComments('r1', 1, 10, 'u1');

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

    it.each(['pending', 'rejected'])(
      'does not allow replying to a %s reply',
      async (status) => {
        prisma.comment.create.mockResolvedValue({
          id: 'new-reply',
          reviewId: 'r1',
          userId: 'u1',
          content: createDto.content,
          floor: 2,
          status: 'approved',
          createdAt: new Date(),
          deletedAt: null,
          user: { id: 'u1', nickname: 'User 1', avatar: null },
          parentComment: null,
        });
        prisma.comment.findUnique.mockResolvedValue({
          id: 'hidden-parent',
          reviewId: 'r1',
          userId: 'u1',
          status,
          deletedAt: null,
        });
        await expect(
          service.createComment('u1', {
            ...createDto,
            parentCommentId: 'hidden-parent',
          }),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.comment.create).not.toHaveBeenCalled();
      },
    );

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
      expect(result.message).toBe('回复已提交');
      expect(adminConfigService.getBooleanConfigValue).toHaveBeenCalledWith(
        'comment.autoApprove',
        'c1',
        prisma,
      );
    });

    it('acknowledges a pending reply without exposing the moderation workflow in the message', async () => {
      adminConfigService.getBooleanConfigValue.mockResolvedValue(false);
      prisma.comment.create.mockResolvedValue({
        id: 'pending-reply',
        reviewId: 'r1',
        userId: 'u1',
        content: createDto.content,
        floor: 1,
        status: 'pending',
        createdAt: new Date(),
        deletedAt: null,
        user: { id: 'u1', nickname: 'User 1', avatar: null },
        parentComment: null,
      });
      const result = await service.createComment('u1', createDto);
      expect(result.message).toBe('回复已提交');
      expect(result.data.status).toBe('pending');
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
        status: 'approved',
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
