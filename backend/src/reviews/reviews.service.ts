import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import {
  ReviewListResponseDto,
  ReviewResponseDto,
  DeleteReviewResponseDto,
} from './dto/review-response.dto';
import { ReviewData, ReviewDetailData } from './dto/review.dto';
import { ReportReviewResponseDto } from './dto/report-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private adminConfigService: AdminConfigService,
  ) {}

  async createReview(
    userId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const dish = await this.prisma.dish.findUnique({
      where: { id: createReviewDto.dishId },
    });
    if (!dish) {
      throw new NotFoundException('未找到对应的菜品');
    }
    const { ratingDetails } = createReviewDto;

    // 根据管理员配置决定评价初始状态
    const autoApprove = await this.adminConfigService.getBooleanConfigValue(
      'review.autoApprove',
      dish.canteenId,
    );

    const review = await this.prisma.review.create({
      data: {
        dishId: createReviewDto.dishId,
        userId: userId,
        rating: createReviewDto.rating,
        content: createReviewDto.content,
        images: createReviewDto.images,
        status: autoApprove ? 'approved' : 'pending',
        spicyLevel: ratingDetails?.spicyLevel,
        sweetness: ratingDetails?.sweetness,
        saltiness: ratingDetails?.saltiness,
        oiliness: ratingDetails?.oiliness,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    return {
      code: 201,
      message: '创建成功',
      data: this.mapToReviewDetailData(review),
    };
  }

  async getReviews(
    dishId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<ReviewListResponseDto> {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { dishId, status: 'approved', deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({
        where: { dishId, status: 'approved', deletedAt: null },
      }),
    ]);

    // 计算评分统计
    const ratings = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { dishId, status: 'approved', deletedAt: null },
      _count: {
        rating: true,
      },
    });

    const ratingDetail = {};
    let totalRating = 0;
    let totalCount = 0;

    ratings.forEach((r) => {
      ratingDetail[r.rating] = r._count.rating;
      totalRating += r.rating * r._count.rating;
      totalCount += r._count.rating;
    });

    const average = totalCount > 0 ? totalRating / totalCount : 0;

    return {
      code: 200,
      message: '获取成功',
      data: {
        items: items.map((item) => this.mapToReviewData(item)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        rating: {
          average: average,
          total: totalCount,
          detail: ratingDetail,
        },
      },
    };
  }

  async reportReview(
    userId: string,
    reviewId: string,
    reportReviewDto: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId, deletedAt: null },
    });
    if (!review) {
      throw new NotFoundException('未找到对应的评论');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: 'review',
        targetId: reviewId,
        reviewId: reviewId,
        type: reportReviewDto.type,
        reason: reportReviewDto.reason,
        status: 'pending',
      },
    });

    return {
      code: 201,
      message: '举报成功',
      data: report.id, // 返回举报记录的ID
    };
  }

  async deleteReview(
    userId: string,
    reviewId: string,
  ): Promise<DeleteReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review || review.deletedAt) {
      throw new NotFoundException('评价不存在');
    }
    if (review.userId !== userId) {
      throw new ForbiddenException('无权删除此评价');
    }

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() },
    });

    return {
      code: 200,
      message: '删除成功',
      data: null,
    };
  }

  private mapToReviewData(review: any): ReviewData {
    const hasDetails =
      review.spicyLevel ||
      review.sweetness ||
      review.saltiness ||
      review.oiliness;

    return {
      id: review.id,
      dishId: review.dishId,
      userId: review.userId,
      userNickname: review.user.nickname,
      userAvatar: review.user.avatar,
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
      createdAt: review.createdAt.toISOString(),
      deletedAt: review.deletedAt?.toISOString() ?? null,
    };
  }

  private mapToReviewDetailData(review: any): ReviewDetailData {
    return {
      ...this.mapToReviewData(review),
      status: review.status,
    };
  }
}
