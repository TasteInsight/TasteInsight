import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import { ConfigKeys } from '@/admin-config/config-definitions';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import {
  ReviewListResponseDto,
  ReviewResponseDto,
  DeleteReviewResponseDto,
  OwnReviewResponseDto,
} from './dto/review-response.dto';
import { ReviewData } from './dto/review.dto';
import { ReportReviewResponseDto } from './dto/report-review.dto';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import { NotificationService } from '@/notifications/notification.service';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private adminConfigService: AdminConfigService,
    private dishReviewStatsService: DishReviewStatsService,
    private notifications: NotificationService,
    @Optional() private embeddingQueueService?: EmbeddingQueueService,
  ) {}

  async getOwnReview(
    userId: string,
    dishId: string,
  ): Promise<OwnReviewResponseDto> {
    const review = await this.prisma.review.findUnique({
      where: { userId_dishId: { userId, dishId }, deletedAt: null },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        _count: { select: { likes: true } },
        likes: { where: { userId }, select: { userId: true } },
      },
    });
    return {
      code: 200,
      message: '获取成功',
      data: review ? this.mapToReviewData(review) : null,
    };
  }

  async createReview(
    userId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const { ratingDetails } = createReviewDto;
    const { review, isUpdate } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM dishes WHERE id = ${createReviewDto.dishId} FOR UPDATE`;
      const dish = await tx.dish.findUnique({
        where: { id: createReviewDto.dishId },
      });
      if (!dish) throw new NotFoundException('未找到对应的菜品');
      const autoApprove = await this.adminConfigService.getBooleanConfigValue(
        ConfigKeys.REVIEW_AUTO_APPROVE,
        dish.canteenId,
        tx,
      );
      const existingReview = await tx.review.findUnique({
        where: {
          userId_dishId: {
            userId,
            dishId: createReviewDto.dishId,
          },
        },
      });
      const saved = await tx.review.upsert({
        where: {
          userId_dishId: {
            userId: userId,
            dishId: createReviewDto.dishId,
          },
        },
        update: {
          rating: createReviewDto.rating,
          content: createReviewDto.content,
          images: createReviewDto.images,
          status: autoApprove ? 'approved' : 'pending',
          rejectReason: null,
          spicyLevel: ratingDetails?.spicyLevel ?? null,
          sweetness: ratingDetails?.sweetness ?? null,
          saltiness: ratingDetails?.saltiness ?? null,
          oiliness: ratingDetails?.oiliness ?? null,
          deletedAt: null, // 如果之前被删除，现在恢复
          updatedAt: new Date(),
        },
        create: {
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
          _count: { select: { likes: true } },
          likes: { where: { userId }, select: { userId: true } },
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
        },
      });
      if (!autoApprove)
        await this.notifications.withdrawThread(tx, 'review', saved.id);
      if (autoApprove || existingReview?.status === 'approved') {
        await this.dishReviewStatsService.recomputeBatch(tx, [dish.id]);
      }
      return { review: saved, isUpdate: !!existingReview };
    });

    this.embeddingQueueService?.scheduleRefreshUser(userId);

    return {
      code: 201,
      message: isUpdate ? '更新成功' : '创建成功',
      data: this.mapToReviewData(review),
    };
  }

  async getReviews(
    dishId: string,
    page: number = 1,
    pageSize: number = 20,
    viewerId?: string,
  ): Promise<ReviewListResponseDto> {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { dishId, status: 'approved', deletedAt: null },
        include: {
          _count: { select: { likes: true } },
          likes: viewerId
            ? { where: { userId: viewerId }, select: { userId: true } }
            : false,
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
      where: { id: reviewId, status: 'approved', deletedAt: null },
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
    const initial = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { dishId: true },
    });
    if (!initial) throw new NotFoundException('评价不存在');

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM dishes WHERE id = ${initial.dishId} FOR UPDATE`;
      const review = await tx.review.findUnique({ where: { id: reviewId } });
      if (!review || review.deletedAt)
        throw new NotFoundException('评价不存在');
      if (review.userId !== userId)
        throw new ForbiddenException('无权删除此评价');
      await tx.review.update({
        where: { id: reviewId },
        data: { deletedAt: new Date() },
      });
      await this.notifications.withdrawThread(tx, 'review', reviewId);
      await this.dishReviewStatsService.recomputeBatch(tx, [review.dishId]);
    });
    this.embeddingQueueService?.scheduleRefreshUser(userId);

    return {
      code: 200,
      message: '删除成功',
      data: null,
    };
  }

  private mapToReviewData(review: any): ReviewData {
    const hasDetails = [
      review.spicyLevel,
      review.sweetness,
      review.saltiness,
      review.oiliness,
    ].some((value) => value != null);

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
      status: review.status,
      images: review.images,
      createdAt: review.createdAt.toISOString(),
      deletedAt: review.deletedAt?.toISOString() ?? null,
      likeCount: review._count?.likes ?? 0,
      likedByMe: !!review.likes?.length,
    };
  }
}
