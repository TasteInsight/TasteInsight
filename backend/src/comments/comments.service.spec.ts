import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from '@/prisma.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { ReportType } from '@/common/enums';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReportCommentDto } from './dto/report-comment.dto';

const createMockPrisma = () => {
  const mock = {
    comment: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
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
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation(async (cb) => cb(mock));
  return mock;
};

const createMockAdminConfigService = () => ({
  getBooleanConfigValue: jest.fn(),
});

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let adminConfigService: ReturnType<typeof createMockAdminConfigService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    adminConfigService = createMockAdminConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminConfigService, useValue: adminConfigService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getComments', () => {
    it('returns paginated comments with parent metadata', async () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      prisma.comment.findMany.mockResolvedValue([
        {
          id: 'c1',
          reviewId: 'r1',
          userId: 'u1',
          content: 'hello',
          createdAt,
          deletedAt: null,
          user: { id: 'u1', nickname: 'nick', avatar: 'ava' },
          parentComment: {
            id: 'p1',
            userId: 'u2',
            deletedAt: null,
            user: { nickname: 'parent' },
          },
        },
      ]);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.getComments('r1', 2, 5);

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: { reviewId: 'r1', status: 'approved', deletedAt: null },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
        skip: 5,
        take: 5,
      });
      expect(result.code).toBe(200);
      expect(result.data.meta).toEqual({
        total: 1,
        page: 2,
        pageSize: 5,
        totalPages: 1,
      });
      expect(result.data.items[0]).toMatchObject({
        id: 'c1',
        parentComment: {
          id: 'p1',
          userNickname: 'parent',
          deleted: false,
        },
      });
      expect(result.data.items[0].createdAt).toBe(createdAt.toISOString());
    });

    it('returns comments without parent data when none exists', async () => {
      const createdAt = new Date();
      prisma.comment.findMany.mockResolvedValue([
        {
          id: 'c2',
          reviewId: 'r1',
          userId: 'u1',
          content: 'visible content',
          createdAt,
          deletedAt: null,
          user: { id: 'u1', nickname: 'nick', avatar: null },
          parentComment: null,
        },
      ]);
      prisma.comment.count.mockResolvedValue(1);

      const result = await service.getComments('r1', 1, 10);

      expect(result.data.items[0].content).toBe('visible content');
      expect(result.data.items[0].parentComment).toBeNull();
      expect(result.data.items[0].createdAt).toBe(createdAt.toISOString());
    });
  });

  describe('createComment', () => {
    const dto: CreateCommentDto = {
      reviewId: 'r1',
      content: 'new comment',
    };

    it('throws when review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.createComment('user', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('validates parent comment belongs to same review', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'r1' }]);
      prisma.review.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.comment.findUnique.mockResolvedValue({
        id: 'p1',
        reviewId: 'other',
        deletedAt: null,
      });

      await expect(
        service.createComment('user', { ...dto, parentCommentId: 'p1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects replying to deleted parent comment', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'r1' }]);
      prisma.review.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.comment.findUnique.mockResolvedValue({
        id: 'p1',
        reviewId: 'r1',
        deletedAt: new Date(),
      });

      await expect(
        service.createComment('user', { ...dto, parentCommentId: 'p1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates comment and returns detail response', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'r1' }]);
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', dishId: 'd1' });
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1', canteenId: 'c1' });
      prisma.comment.findUnique.mockResolvedValue(null);
      prisma.comment.count.mockResolvedValue(0);
      adminConfigService.getBooleanConfigValue.mockResolvedValue(false);
      const created = {
        id: 'c1',
        reviewId: 'r1',
        userId: 'user',
        content: 'new comment',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        deletedAt: null,
        status: 'pending',
        floor: 1,
        user: { id: 'user', nickname: 'nick', avatar: 'ava' },
        parentComment: {
          id: 'p1',
          userId: 'parent',
          user: { nickname: 'parentNick' },
          deletedAt: null,
        },
      };
      prisma.comment.create.mockResolvedValue(created);

      const result = await service.createComment('user', dto);

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          reviewId: 'r1',
          userId: 'user',
          content: 'new comment',
          parentCommentId: undefined,
          status: 'pending',
          floor: 1,
        },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          parentComment: {
            select: {
              id: true,
              userId: true,
              user: { select: { nickname: true } },
              deletedAt: true,
            },
          },
        },
      });
      expect(result.code).toBe(201);
      expect(result.data).toMatchObject({
        id: 'c1',
        status: 'pending',
        floor: 1,
        parentComment: {
          id: 'p1',
          userId: 'parent',
          userNickname: 'parentNick',
          deleted: false,
        },
      });
    });

    it('creates approved comment when auto-approve is enabled', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'r1' }]);
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', dishId: 'd1' });
      prisma.dish.findUnique.mockResolvedValue({ id: 'd1', canteenId: 'c1' });
      prisma.comment.findUnique.mockResolvedValue(null);
      prisma.comment.count.mockResolvedValue(0);
      adminConfigService.getBooleanConfigValue.mockResolvedValue(true);
      const created = {
        id: 'c1',
        reviewId: 'r1',
        userId: 'user',
        content: 'new comment',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        deletedAt: null,
        status: 'approved',
        floor: 1,
        user: { id: 'user', nickname: 'nick', avatar: 'ava' },
        parentComment: null,
      };
      prisma.comment.create.mockResolvedValue(created);

      const result = await service.createComment('user', dto);

      expect(adminConfigService.getBooleanConfigValue).toHaveBeenCalledWith(
        'comment.autoApprove',
        'c1',
      );
      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          reviewId: 'r1',
          userId: 'user',
          content: 'new comment',
          parentCommentId: undefined,
          status: 'approved',
          floor: 1,
        },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          parentComment: {
            select: {
              id: true,
              userId: true,
              user: { select: { nickname: true } },
              deletedAt: true,
            },
          },
        },
      });
      expect(result.code).toBe(201);
      expect(result.data.status).toBe('approved');
    });
  });

  describe('reportComment', () => {
    const reportDto: ReportCommentDto = {
      type: ReportType.SPAM,
      reason: 'spam content',
    };

    it('throws when comment not found', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.reportComment('user', 'c1', reportDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates report entry', async () => {
      prisma.comment.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.report.create.mockResolvedValue({ id: 'rep1' });

      const result = await service.reportComment('user', 'c1', reportDto);

      expect(prisma.report.create).toHaveBeenCalledWith({
        data: {
          reporterId: 'user',
          targetType: 'comment',
          targetId: 'c1',
          commentId: 'c1',
          type: ReportType.SPAM,
          reason: 'spam content',
          status: 'pending',
        },
      });
      expect(result.code).toBe(201);
    });
  });

  describe('deleteComment', () => {
    it('throws when comment does not exist', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.deleteComment('user', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when user is not owner', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'other',
      });

      await expect(service.deleteComment('user', 'c1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('soft deletes comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'user',
        deletedAt: null,
      });
      prisma.comment.update.mockResolvedValue({
        id: 'c1',
        reviewId: 'r1',
        userId: 'user',
        content: 'old',
        createdAt: new Date(),
        deletedAt: new Date(),
        status: 'approved',
        user: { id: 'user', nickname: 'nick', avatar: null },
        parentComment: null,
      });

      const result = await service.deleteComment('user', 'c1');

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.code).toBe(HttpStatus.OK);
    });
  });
});
