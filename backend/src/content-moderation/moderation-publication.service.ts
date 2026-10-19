import { rejectContribution } from '@/dishes/reject-contribution';
import { NotificationService } from '@/notifications/notification.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { ContentModerationTask } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { AdminReviewsService } from '@/admin-reviews/admin-reviews.service';
import { AdminCommentsService } from '@/admin-comments/admin-comments.service';
import { SocialService } from '@/social/social.service';
import { ModerationAssetsService } from './moderation-assets.service';

const systemScope = { scope: 'GLOBAL', canteenIds: [] } as const;

@Injectable()
export class ModerationPublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: AdminReviewsService,
    private readonly comments: AdminCommentsService,
    private readonly social: SocialService,
    private readonly assets: ModerationAssetsService,
    private readonly notifications: NotificationService,
  ) {}

  async current(task: ContentModerationTask): Promise<boolean> {
    if (task.targetType === 'profile') {
      const latest = await this.prisma.contentModerationTask.findFirst({
        where: { targetType: 'profile', targetId: task.targetId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return (
        latest?.id === task.id &&
        !!(await this.prisma.user.findUnique({
          where: { id: task.userId },
          select: { id: true },
        }))
      );
    }
    const record =
      task.targetType === 'post'
        ? await this.prisma.post.findUnique({ where: { id: task.targetId } })
        : task.targetType === 'postComment'
          ? await this.prisma.postComment.findUnique({
              where: { id: task.targetId },
            })
          : task.targetType === 'review'
            ? await this.prisma.review.findUnique({
                where: { id: task.targetId },
              })
            : task.targetType === 'comment'
              ? await this.prisma.comment.findUnique({
                  where: { id: task.targetId },
                })
              : await this.prisma.dishUpload.findUnique({
                  where: { id: task.targetId },
                });
    if (
      !record ||
      record.status !== 'pending' ||
      ('deletedAt' in record && record.deletedAt)
    )
      return false;
    if (task.targetType === 'comment') {
      const root = await this.prisma.review.findUnique({
        where: { id: (record as { reviewId: string }).reviewId },
      });
      if (!root || root.deletedAt) return false;
    }
    if (task.targetType === 'postComment') {
      const root = await this.prisma.post.findUnique({
        where: { id: (record as { postId: string }).postId },
      });
      if (!root || root.deletedAt) return false;
    }
    return (
      task.version ===
      ('revision' in record
        ? String(record.revision)
        : record.updatedAt.toISOString())
    );
  }

  async apply(
    task: ContentModerationTask,
    approved: boolean,
    reason = '内容审核未通过',
  ): Promise<void> {
    if (!(await this.current(task)))
      throw new ConflictException('内容已变更，请刷新');
    if (task.targetType === 'profile') {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${task.userId} FOR UPDATE`;
        const current = await tx.contentModerationTask.findUnique({
          where: { id: task.id },
        });
        if (!current || !['ready', 'manual', 'failed'].includes(current.status))
          throw new ConflictException('资料审核状态已变化');
        if (approved) {
          const patch = (task.profilePatch ?? {}) as Record<
            string,
            string | null
          >;
          // Profile tasks contain only public fields; preferences remain synchronous.
          await tx.user.update({
            where: { id: task.userId },
            data: {
              ...(typeof patch.nickname === 'string'
                ? { nickname: patch.nickname }
                : {}),
              ...('avatar' in patch ? { avatar: patch.avatar } : {}),
              ...('bio' in patch ? { bio: patch.bio } : {}),
            },
          });
          await this.assets.approve(tx, task.images);
        }
        await tx.contentModerationTask.update({
          where: { id: task.id },
          data: {
            status: approved ? 'approved' : 'rejected',
            reason: approved ? null : reason,
            lockedUntil: null,
          },
        });
      });
      return;
    }
    if (task.targetType === 'dishUpload') {
      // Content clearance leaves catalog merging and field confirmation to the dish reviewer.
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM dish_uploads WHERE id = ${task.targetId} FOR UPDATE`;
        const upload = await tx.dishUpload.findUnique({
          where: { id: task.targetId },
        });
        const current = await tx.contentModerationTask.findUnique({
          where: { id: task.id },
        });
        if (!current || !['ready', 'manual', 'failed'].includes(current.status))
          throw new ConflictException('内容审核任务已处理');

        if (
          !upload ||
          upload.status !== 'pending' ||
          String(upload.revision) !== task.version
        )
          throw new ConflictException('资料已变更');
        if (!approved)
          await rejectContribution(tx, upload, reason, this.notifications);
        if (approved) await this.assets.approve(tx, task.images);
        await tx.contentModerationTask.update({
          where: { id: task.id },
          data: {
            status: approved ? 'approved' : 'rejected',
            reason: approved ? null : reason,
            lockedUntil: null,
          },
        });
      });
      return;
    }
    const scope = { ...systemScope, canteenIds: [] };
    if (task.targetType === 'review') {
      if (approved)
        await this.reviews.approveReview(
          task.targetId,
          { expectedUpdatedAt: task.version },
          scope,
        );
      else
        await this.reviews.rejectReview(
          task.targetId,
          { expectedUpdatedAt: task.version, reason },
          scope,
        );
    } else if (task.targetType === 'comment') {
      if (approved) await this.comments.approveComment(task.targetId, scope);
      else await this.comments.rejectComment(task.targetId, { reason }, scope);
    } else {
      await this.social.moderate(
        task.targetType as 'post' | 'postComment',
        task.targetId,
        { expectedUpdatedAt: task.version },
        approved,
        scope,
        reason,
      );
    }
    // Domain publication approves assets within its own transaction.
    await this.prisma.contentModerationTask.updateMany({
      where: { id: task.id, status: { in: ['ready', 'manual', 'failed'] } },
      data: {
        status: approved ? 'approved' : 'rejected',
        reason: approved ? null : reason,
        lockedUntil: null,
      },
    });
  }
}
