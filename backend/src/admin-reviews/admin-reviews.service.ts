import { ModerationSubmissionService } from '@/content-moderation/moderation-submission.service';
import { ModerationAssetsService } from '@/content-moderation/moderation-assets.service';
import {
  AdminCanteenScope,
  canAccessCanteen,
  canteenScopeFilter,
  isGlobalScope,
} from '@/auth/admin-scope';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { RejectReviewDto } from './dto/reject-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { NotificationService } from '@/notifications/notification.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import {
  PendingReviewListResponseDto,
  SuccessResponseDto,
  ReviewItemData,
  ReviewCommentListResponseDto,
  ReviewCommentItemData,
} from './dto/review-response.dto';

@Injectable()
export class AdminReviewsService {
  constructor(
    private prisma: PrismaService,
    private dishReviewStatsService: DishReviewStatsService,
    private notifications: NotificationService,
    @Optional() private embeddingQueueService?: EmbeddingQueueService,
    @Optional() private readonly moderation?: ModerationSubmissionService,
    @Optional() private readonly moderationAssets?: ModerationAssetsService,
  ) {}

  async batchDeleteReviews(ids: string[], admin: AdminInfo) {
    const deletedCount = await this.deleteReviews(ids, admin);
    return { code: 200, message: '删除成功', data: { deletedCount } };
  }

  private async deleteReviews(
    ids: string[],
    admin?: AdminCanteenScope,
  ): Promise<number> {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const targets = await tx.review.findMany({
        where: { id: { in: ids } },
        select: { dishId: true },
      });
      const dishIds = [...new Set(targets.map((row) => row.dishId))].sort();
      if (dishIds.length)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM dishes WHERE id IN (${Prisma.join(dishIds)}) ORDER BY id FOR UPDATE`,
        );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM reviews WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`,
      );
      const rows = await tx.review.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: {
          id: true,
          dishId: true,
          userId: true,
          dish: { select: { canteenId: true } },
        },
      });
      if (rows.length !== ids.length)
        throw new NotFoundException('部分评价已不存在，请刷新列表');
      if (rows.some((row) => !canAccessCanteen(admin, row.dish.canteenId)))
        throw new ForbiddenException('无权删除所选评价');
      const result = await tx.review.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      for (const id of ids) await this.moderation?.cancel(tx, 'review', id);
      await this.notifications.withdraw(tx, {
        OR: [
          { targetType: 'review', targetId: { in: ids } },
          { targetType: 'comment', rootId: { in: ids } },
        ],
      });
      await this.dishReviewStatsService.recomputeBatch(
        tx,
        rows.map((row) => row.dishId),
      );
      return {
        count: result.count,
        userIds: [...new Set(rows.map((row) => row.userId))],
      };
    });
    for (const userId of deleted.userIds)
      this.embeddingQueueService?.scheduleRefreshUser(userId);
    return deleted.count;
  }

  async getPendingReviews(
    page: number = 1,
    pageSize: number = 20,
    adminInfo?: AdminCanteenScope,
  ): Promise<PendingReviewListResponseDto> {
    const skip = (page - 1) * pageSize;
    const where: any = { status: 'pending', deletedAt: null };

    if (!isGlobalScope(adminInfo)) {
      where.dish = { canteenId: canteenScopeFilter(adminInfo) };
    }

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

    const items: ReviewItemData[] = reviews.map((review) => {
      const hasDetails =
        review.spicyLevel !== null ||
        review.sweetness !== null ||
        review.saltiness !== null ||
        review.oiliness !== null;

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
        images:
          this.moderationAssets?.previewImages(review.images) ?? review.images,
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

  async approveReview(
    id: string,
    dto: ModerateReviewDto,
    adminInfo?: AdminCanteenScope,
  ): Promise<SuccessResponseDto> {
    await this.moderateReview(id, dto, 'approved', adminInfo);
    return {
      code: 200,
      message: '审核通过',
      data: null,
    };
  }

  async rejectReview(
    id: string,
    dto: RejectReviewDto,
    adminInfo?: AdminCanteenScope,
  ): Promise<SuccessResponseDto> {
    await this.moderateReview(id, dto, 'rejected', adminInfo, dto.reason);
    return {
      code: 200,
      message: '已拒绝',
      data: null,
    };
  }

  private async moderateReview(
    id: string,
    dto: ModerateReviewDto,
    status: 'approved' | 'rejected',
    adminInfo?: AdminCanteenScope,
    reason?: string,
  ): Promise<void> {
    const initial = await this.prisma.review.findUnique({
      where: { id, deletedAt: null },
      select: { dishId: true },
    });
    if (!initial) throw new NotFoundException('评价不存在');

    const userId = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM dishes WHERE id = ${initial.dishId} FOR UPDATE`;
      const review = await tx.review.findUnique({
        where: { id, deletedAt: null },
        include: { dish: true },
      });
      if (!review) throw new NotFoundException('评价不存在');
      if (!canAccessCanteen(adminInfo, review.dish.canteenId))
        throw new ForbiddenException('权限不足');
      if (status === 'approved') {
        await this.moderation?.assertApprovable(
          tx,
          'review',
          id,
          review.updatedAt.toISOString(),
        );
        const verified = await tx.studentVerification.findFirst({
          where: {
            userId: review.userId,
            status: 'VERIFIED',
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (!verified) throw new ConflictException('作者的学生认证已失效');
      }
      const result = await tx.review.updateMany({
        where: {
          id,
          deletedAt: null,
          status: 'pending',
          updatedAt: new Date(dto.expectedUpdatedAt),
          ...(!isGlobalScope(adminInfo)
            ? { dish: { canteenId: canteenScopeFilter(adminInfo) } }
            : {}),
        },
        data: {
          status,
          rejectReason: status === 'rejected' ? reason : null,
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          '评价内容或审核状态已变更，请刷新后重新审核',
        );
      }
      await this.moderation?.complete(
        tx,
        'review',
        id,
        review.updatedAt.toISOString(),
        status === 'approved',
        review.images,
      );
      if (status === 'rejected')
        await this.notifications.withdrawThread(tx, 'review', id);
      await this.dishReviewStatsService.recomputeBatch(tx, [review.dishId]);
      return review.userId;
    });
    if (status === 'approved')
      this.embeddingQueueService?.scheduleRefreshUser(userId);
  }

  async deleteReview(
    id: string,
    adminInfo?: AdminCanteenScope,
  ): Promise<SuccessResponseDto> {
    await this.deleteReviews([id], adminInfo);

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
    adminInfo?: AdminCanteenScope,
  ): Promise<ReviewCommentListResponseDto> {
    // 检查评价是否存在
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { dish: true },
    });

    if (!review) {
      throw new NotFoundException('评价不存在');
    }

    if (!canAccessCanteen(adminInfo, review.dish.canteenId)) {
      throw new ForbiddenException('权限不足');
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
          parentComment: {
            select: {
              id: true,
              userId: true,
              deletedAt: true,
              user: { select: { nickname: true } },
            },
          },
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
      userNickname: comment.user.nickname,
      userAvatar: comment.user.avatar,
      parentComment: comment.parentComment
        ? {
            id: comment.parentComment.id,
            userId: comment.parentComment.userId,
            userNickname: comment.parentComment.user.nickname,
            deleted: comment.parentComment.deletedAt !== null,
          }
        : null,
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
