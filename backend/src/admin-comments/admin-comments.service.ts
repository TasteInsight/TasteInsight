import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { RejectCommentDto } from './dto/reject-comment.dto';
import {
  PendingCommentListResponseDto,
  SuccessResponseDto,
  CommentItemData,
} from './dto/comment-response.dto';

@Injectable()
export class AdminCommentsService {
  constructor(private prisma: PrismaService) {}

  async getPendingComments(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PendingCommentListResponseDto> {
    const skip = (page - 1) * pageSize;
    const where = { status: 'pending' };

    const [total, comments] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          review: {
            select: {
              content: true,
              dish: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items: CommentItemData[] = comments.map((comment) => ({
      id: comment.id,
      reviewId: comment.reviewId,
      userId: comment.userId,
      content: comment.content,
      status: comment.status,
      rejectReason: comment.rejectReason,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      reviewContent: comment.review.content,
      dishName: comment.review.dish.name,
    }));

    return {
      code: 200,
      message: 'success',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async approveComment(id: string): Promise<SuccessResponseDto> {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    await this.prisma.comment.update({
      where: { id },
      data: {
        status: 'approved',
      },
    });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  async rejectComment(
    id: string,
    dto: RejectCommentDto,
  ): Promise<SuccessResponseDto> {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    await this.prisma.comment.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: dto.reason,
      },
    });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  async deleteComment(id: string): Promise<SuccessResponseDto> {
    const comment = await this.prisma.comment.findUnique({
      where: { id, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    await this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return {
      code: 200,
      message: '删除成功',
      data: null,
    };
  }
}
