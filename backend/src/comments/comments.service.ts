import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  CommentListResponseDto,
  CommentResponseDto,
  SuccessResponseDto,
  CommentData,
  CommentDetailData,
} from './dto/comment-response.dto';
import { ReportCommentDto } from './dto/report-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async getComments(
    reviewId: string,
    page = 1,
    pageSize = 10,
  ): Promise<CommentListResponseDto> {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { reviewId, status: 'approved', deletedAt: null },
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
              user: {
                select: {
                  nickname: true,
                },
              },
              deletedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.comment.count({
        where: { reviewId, status: 'approved', deletedAt: null },
      }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((comment) => this.mapToCommentData(comment)),
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
      const lockedReviews = await tx.$queryRaw`SELECT id FROM reviews WHERE id = ${dto.reviewId} FOR UPDATE`;
      
      if (!Array.isArray(lockedReviews) || lockedReviews.length === 0) {
        throw new NotFoundException('评价不存在或未通过审核');
      }

      const review = await tx.review.findUnique({
        where: { id: dto.reviewId, status: 'approved', deletedAt: null },
      });
      if (!review) {
        throw new NotFoundException('评价不存在或未通过审核');
      }

      if (dto.parentCommentId) {
        const parent = await tx.comment.findUnique({
          where: { id: dto.parentCommentId },
        });
        if (!parent || parent.reviewId !== dto.reviewId) {
          throw new NotFoundException('父评论不存在');
        }
        if (parent.deletedAt) {
          throw new BadRequestException('无法回复已删除的评论');
        }
      }

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
          status: 'pending',
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
        message: '评论发布成功',
        data: this.mapToCommentDetailData(comment),
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

  private mapToCommentData(comment: any): CommentData {
    return {
      id: comment.id,
      reviewId: comment.reviewId,
      userId: comment.userId,
      userNickname: comment.user.nickname,
      userAvatar: comment.user?.avatar,
      content: comment.deletedAt ? '该评论已删除' : comment.content,
      floor: comment.floor,
      createdAt: comment.createdAt.toISOString(),
      parentComment: comment.parentComment
        ? {
            id: comment.parentComment.id,
            userId: comment.parentComment.userId,
            userNickname: comment.parentComment.user.nickname,
            deleted: !!comment.parentComment.deletedAt,
          }
        : null,
    };
  }

  private mapToCommentDetailData(comment: any): CommentDetailData {
    return {
      ...this.mapToCommentData(comment),
      status: comment.status,
    };
  }
}
