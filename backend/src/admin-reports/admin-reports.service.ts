import { ModerationSubmissionService } from '@/content-moderation/moderation-submission.service';
import {
  canAccessCanteen,
  canteenScopeFilter,
  isGlobalScope,
} from '@/auth/admin-scope';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { DishReviewStatsService } from '@/dish-review-stats-queue';
import { HandleReportDto } from './dto/handle-report.dto';
import {
  ReportListResponseDto,
  SuccessResponseDto,
  ReportItemData,
} from './dto/report-response.dto';
import { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { NotificationService } from '@/notifications/notification.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';

@Injectable()
export class AdminReportsService {
  constructor(
    private prisma: PrismaService,
    private dishReviewStatsService: DishReviewStatsService,
    private notifications: NotificationService,
    @Optional() private embeddingQueueService?: EmbeddingQueueService,
    @Optional() private readonly moderation?: ModerationSubmissionService,
  ) {}

  async getReports(
    page: number = 1,
    pageSize: number = 20,
    status?: 'pending' | 'approved' | 'rejected',
    targetType?: string,
    adminInfo?: AdminInfo,
  ): Promise<ReportListResponseDto> {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (!isGlobalScope(adminInfo)) {
      where.OR = [
        {
          review: {
            dish: {
              canteenId: canteenScopeFilter(adminInfo),
            },
          },
        },
        {
          comment: {
            review: {
              dish: {
                canteenId: canteenScopeFilter(adminInfo),
              },
            },
          },
        },
      ];
    }

    const [total, reports] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            select: {
              content: true,
              userId: true,
              deletedAt: true,
              images: true,
              user: { select: { id: true, nickname: true, avatar: true } },
            },
          },
          postComment: {
            select: {
              content: true,
              userId: true,
              deletedAt: true,
              user: { select: { id: true, nickname: true, avatar: true } },
            },
          },
          reporter: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          review: {
            select: {
              content: true,
              userId: true,
              deletedAt: true,
              images: true,
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatar: true,
                },
              },
            },
          },
          comment: {
            select: {
              content: true,
              userId: true,
              deletedAt: true,
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items: ReportItemData[] = reports.map((report) => {
      // 根据 targetType 获取被举报内容的信息
      let targetContent: ReportItemData['targetContent'] | undefined;

      if (report.targetType === 'review' && report.review) {
        targetContent = {
          content: report.review.content,
          userId: report.review.userId,
          userNickname: report.review.user.nickname,
          userAvatar: report.review.user.avatar,
          isDeleted: report.review.deletedAt !== null,
          images: report.review.images || [],
        };
      } else if (report.targetType === 'comment' && report.comment) {
        targetContent = {
          content: report.comment.content,
          userId: report.comment.userId,
          userNickname: report.comment.user.nickname,
          userAvatar: report.comment.user.avatar,
          isDeleted: report.comment.deletedAt !== null,
        };
      } else if (report.targetType === 'post' && report.post) {
        targetContent = {
          content: report.post.content,
          userId: report.post.userId,
          userNickname: report.post.user.nickname,
          userAvatar: report.post.user.avatar,
          isDeleted: report.post.deletedAt !== null,
          images: report.post.images,
        };
      } else if (report.targetType === 'postComment' && report.postComment) {
        targetContent = {
          content: report.postComment.content,
          userId: report.postComment.userId,
          userNickname: report.postComment.user.nickname,
          userAvatar: report.postComment.user.avatar,
          isDeleted: report.postComment.deletedAt !== null,
        };
      }

      return {
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        type: report.type,
        reason: report.reason,
        status: report.status,
        handleResult: report.handleResult,
        handledBy: report.handledBy,
        handledAt: report.handledAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        reporter: {
          id: report.reporter.id,
          nickname: report.reporter.nickname,
          avatar: report.reporter.avatar,
        },
        targetContent,
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

  async handleReport(
    id: string,
    dto: HandleReportDto,
    adminInfo: AdminInfo,
  ): Promise<SuccessResponseDto> {
    let reviewAuthorId: string | undefined;
    await this.prisma.$transaction(async (tx) => {
      const query = {
        where: { id },
        include: {
          post: true,
          postComment: true,
          review: {
            include: {
              dish: true,
            },
          },
          comment: {
            include: {
              review: {
                include: {
                  dish: true,
                },
              },
            },
          },
        },
      } as const;
      let report = await tx.report.findUnique(query);

      if (!report) {
        throw new NotFoundException('举报不存在');
      }
      const targetReview = report.review ?? report.comment?.review;
      if (targetReview) {
        await tx.$queryRaw`SELECT id FROM dishes WHERE id = ${targetReview.dishId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM reviews WHERE id = ${targetReview.id} FOR UPDATE`;
        report = await tx.report.findUnique(query);
        if (!report) throw new NotFoundException('举报不存在');
      }

      if (!isGlobalScope(adminInfo)) {
        let canteenId: string | undefined;
        if (report.review) {
          canteenId = report.review.dish.canteenId;
        } else if (report.comment) {
          canteenId = report.comment.review.dish.canteenId;
        }

        if (!canAccessCanteen(adminInfo, canteenId)) {
          throw new ForbiddenException('权限不足');
        }
      }

      if (report.status !== 'pending') {
        throw new BadRequestException('该举报已被处理');
      }

      if (dto.action === 'delete_content' && adminInfo.role !== 'superadmin') {
        const deletePermissions: Record<string, string> = {
          review: 'review:delete',
          comment: 'comment:delete',
          post: 'post:delete',
          postComment: 'post:delete',
        };
        if (
          !adminInfo.permissions.includes(deletePermissions[report.targetType])
        ) {
          throw new ForbiddenException('权限不足');
        }
      }

      const result = await tx.report.updateMany({
        where: { id, status: 'pending' },
        data: {
          status: dto.action === 'reject_report' ? 'rejected' : 'approved',
          handleResult:
            dto.result ||
            (dto.action === 'delete_content'
              ? '内容已删除'
              : dto.action === 'warn_user'
                ? '已警告用户'
                : '举报被拒绝'),
          handledBy: adminInfo.id,
          handledAt: new Date(),
        },
      });
      if (!result.count) throw new BadRequestException('该举报已被处理');
      if (dto.action === 'delete_content') {
        await this.moderation?.cancel(
          tx,
          report.targetType as 'review' | 'comment' | 'post' | 'postComment',
          report.targetId,
        );
        if (report.targetType === 'review' && report.reviewId) {
          const deleted = await tx.review.updateMany({
            where: { id: report.reviewId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          await this.notifications.withdrawThread(
            tx,
            'review',
            report.reviewId,
          );
          if (report.review)
            await this.dishReviewStatsService.recomputeBatch(tx, [
              report.review.dishId,
            ]);
          if (deleted.count) reviewAuthorId = report.review?.userId;
        } else if (
          report.targetType === 'comment' &&
          report.commentId &&
          report.comment
        ) {
          await tx.comment.updateMany({
            where: { id: report.commentId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          await this.notifications.withdraw(tx, {
            targetType: 'comment',
            targetId: report.commentId,
          });
        } else if (report.targetType === 'post' && report.postId) {
          await tx.post.updateMany({
            where: { id: report.postId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          await this.notifications.withdrawThread(tx, 'post', report.postId);
        } else if (
          report.targetType === 'postComment' &&
          report.postCommentId &&
          report.postComment
        ) {
          await tx.$queryRaw`SELECT id FROM posts WHERE id = ${report.postComment.postId} FOR UPDATE`;
          await tx.postComment.updateMany({
            where: { id: report.postCommentId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          await this.notifications.withdraw(tx, {
            targetType: 'postComment',
            targetId: report.postCommentId,
          });
        }
      }
      await this.notifications.create(tx, {
        userId: report.reporterId,
        actorId: null,
        type: 'report_handled',
        targetType: 'report',
        targetId: report.id,
        dedupeKey: `report_handled:${report.id}`,
      });
    });
    if (reviewAuthorId)
      this.embeddingQueueService?.scheduleRefreshUser(reviewAuthorId);

    return {
      code: 200,
      message: '处理成功',
      data: null,
    };
  }
}
