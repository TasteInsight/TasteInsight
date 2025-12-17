import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { RejectReviewDto } from './dto/reject-review.dto';
import {
  PendingReviewListResponseDto,
  SuccessResponseDto,
  ReviewItemData,
  ReviewCommentListResponseDto,
  ReviewCommentItemData,
} from './dto/review-response.dto';

@Injectable()
export class AdminReviewsService {
  constructor(private prisma: PrismaService) {}

  async getPendingReviews(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PendingReviewListResponseDto> {
    const skip = (page - 1) * pageSize;
    const where = { status: 'pending', deletedAt: null };

    const [total, reviews] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          dish: {
            select: {
              name: true,
              images: true,
            },
          },
        },
      }),
    ]);

    const items: ReviewItemData[] = reviews.map((review) => {
      const hasDetails =
        review.spicyLevel ||
        review.sweetness ||
        review.saltiness ||
        review.oiliness;

      return {
        id: review.id,
        dishId: review.dishId,
        userId: review.userId,
        rating: review.rating,
        ratingDetails: hasDetails
          ? {
              spicyLevel: review.spicyLevel,
              sweetness: review.sweetness,
              saltiness: review.saltiness,
              oiliness: review.oiliness,
            }
          : null,
        content: review.content,
        images: review.images,
        status: review.status,
        rejectReason: review.rejectReason,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        dishName: review.dish.name,
        dishImage: review.dish.images.length > 0 ? review.dish.images[0] : null,
      };
    });

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

  async approveReview(id: string): Promise<SuccessResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id, deletedAt: null },
    });
    if (!review) {
      throw new NotFoundException('评价不存在');
    }

    await this.prisma.review.update({
      where: { id },
      data: { status: 'approved' },
    });

    return {
      code: 200,
      message: '审核通过',
      data: null,
    };
  }

  async rejectReview(
    id: string,
    dto: RejectReviewDto,
  ): Promise<SuccessResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id, deletedAt: null },
    });
    if (!review) {
      throw new NotFoundException('评价不存在');
    }

    await this.prisma.review.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: dto.reason,
      },
    });

    return {
      code: 200,
      message: '已拒绝',
      data: null,
    };
  }

  async deleteReview(id: string): Promise<SuccessResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id, deletedAt: null },
    });
    if (!review) {
      throw new NotFoundException('评价不存在');
    }

    await this.prisma.review.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return {
      code: 200,
      message: '删除成功',
      data: null,
    };
  }

  /**
   * 获取评价的评论列表
   */
  async getReviewComments(
    reviewId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<ReviewCommentListResponseDto> {
    // 检查评价是否存在
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('评价不存在');
    }

    const skip = (page - 1) * pageSize;
    const where = { reviewId, deletedAt: null };

    const [total, comments] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    const items: ReviewCommentItemData[] = comments.map((comment) => ({
      id: comment.id,
      reviewId: comment.reviewId,
      userId: comment.userId,
      content: comment.content,
      floor: comment.floor,
      parentCommentId: comment.parentCommentId,
      status: comment.status,
      rejectReason: comment.rejectReason,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      user: {
        id: comment.user.id,
        nickname: comment.user.nickname,
        avatar: comment.user.avatar,
      },
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
}
