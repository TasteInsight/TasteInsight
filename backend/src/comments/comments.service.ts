import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import { ConfigKeys } from '@/admin-config/config-definitions';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  CommentListResponseDto,
  CommentResponseDto,
  SuccessResponseDto,
  CommentData,
} from './dto/comment-response.dto';
import { ReportCommentDto } from './dto/report-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private adminConfigService: AdminConfigService,
  ) {}

  async getComments(
    reviewId: string,
    page = 1,
    pageSize = 10,
    viewerId: string,
  ): Promise<CommentListResponseDto> {
    const skip = (page - 1) * pageSize;
    const reviewVisibility = {
      deletedAt: null,
      OR: [{ status: 'approved' }, { userId: viewerId }],
    };
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId, ...reviewVisibility },
      select: { status: true },
    });
    if (!review) throw new NotFoundException('评价不存在或暂不可查看');
    const where: Prisma.CommentWhereInput = {
      reviewId,
      deletedAt: null,
      review: reviewVisibility,
      OR: [
        { status: 'approved' },
        { userId: viewerId, status: { in: ['pending', 'rejected'] } },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          parentComment: {
            select: {
              id: true,
              userId: true,
              status: true,
              user: {
                select: {
                  nickname: true,
                },
              },
              deletedAt: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.comment.count({
        where,
      }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((comment) => this.mapToCommentData(comment, viewerId)),
        canReply: review.status === 'approved',
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async createComment(
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 使用悲观锁锁定 Review 记录，防止并发导致楼层号重复
      const lockedReviews =
        await tx.$queryRaw`SELECT id FROM reviews WHERE id = ${dto.reviewId} FOR UPDATE`;

      if (!Array.isArray(lockedReviews) || lockedReviews.length === 0) {
        throw new NotFoundException('评价不存在或暂不可回复');
      }

      const review = await tx.review.findUnique({
        where: { id: dto.reviewId, status: 'approved', deletedAt: null },
      });
      if (!review) {
        throw new NotFoundException('评价不存在或暂不可回复');
      }

      if (dto.parentCommentId) {
        const parent = await tx.comment.findUnique({
          where: { id: dto.parentCommentId },
        });
        if (
          !parent ||
          parent.reviewId !== dto.reviewId ||
          parent.status !== 'approved'
        ) {
          throw new NotFoundException('父评论不存在');
        }
        if (parent.deletedAt) {
          throw new BadRequestException('无法回复已删除的评论');
        }
      }

      // 获取菜品信息以确定食堂ID
      const dish = await tx.dish.findUnique({
        where: { id: review.dishId },
      });

      // 根据管理员配置决定评论初始状态
      const autoApprove = dish
        ? await this.adminConfigService.getBooleanConfigValue(
            ConfigKeys.COMMENT_AUTO_APPROVE,
            dish.canteenId,
            tx,
          )
        : false;

      const count = await tx.comment.count({
        where: { reviewId: dto.reviewId },
      });
      const floor = count + 1;

      const comment = await tx.comment.create({
        data: {
          reviewId: dto.reviewId,
          userId,
          content: dto.content,
          parentCommentId: dto.parentCommentId,
          status: autoApprove ? 'approved' : 'pending',
          floor,
        },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          parentComment: {
            select: {
              id: true,
              userId: true,
              status: true,
              user: {
                select: {
                  nickname: true,
                },
              },
              deletedAt: true,
            },
          },
        },
      });

      return {
        code: 201,
        message: '回复已提交',
        data: this.mapToCommentData(comment, userId),
      };
    });
  }

  async reportComment(
    userId: string,
    commentId: string,
    dto: ReportCommentDto,
  ): Promise<SuccessResponseDto> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: 'comment',
        targetId: commentId,
        commentId,
        type: dto.type,
        reason: dto.reason,
        status: 'pending',
      },
    });

    return {
      code: 201,
      message: '举报提交成功',
      data: null,
    };
  }

  async deleteComment(
    userId: string,
    commentId: string,
  ): Promise<SuccessResponseDto> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('无权删除该评论');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return {
      code: 200,
      message: '删除成功',
      data: null,
    };
  }

  private mapToCommentData(comment: any, viewerId: string): CommentData {
    return {
      id: comment.id,
      reviewId: comment.reviewId,
      userId: comment.userId,
      userNickname: comment.user.nickname,
      userAvatar: comment.user?.avatar,
      content: comment.deletedAt ? '该评论已删除' : comment.content,
      status: comment.status,
      floor: comment.floor,
      createdAt: comment.createdAt.toISOString(),
      parentComment:
        comment.parentComment &&
        (comment.parentComment.status === 'approved' ||
          comment.parentComment.userId === viewerId)
          ? {
              id: comment.parentComment.id,
              userId: comment.parentComment.userId,
              userNickname: comment.parentComment.user.nickname,
              deleted: !!comment.parentComment.deletedAt,
            }
          : null,
    };
  }
}
