import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { RejectReviewDto } from './dto/reject-review.dto';
import {
  PendingReviewListResponseDto,
  SuccessResponseDto,
  ReviewItemData,
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
}
