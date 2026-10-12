import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { NotificationService } from '@/notifications/notification.service';

export type LikeTarget = 'review' | 'comment' | 'post' | 'postComment';

@Injectable()
export class ContentLikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async setLike(userId: string, type: LikeTarget, id: string, liked: boolean) {
    return this.prisma.$transaction(async (tx) => {
      let ownerId: string;
      let rootId: string | undefined;
      let changed: number;
      let likeCount: number;
      const visible = { status: 'approved', deletedAt: null };
      switch (type) {
        case 'review': {
          await tx.$queryRaw`SELECT id FROM reviews WHERE id = ${id} FOR UPDATE`;
          const target = await tx.review.findFirst({
            where: { id, ...visible },
            select: { userId: true },
          });
          if (!target) throw new NotFoundException('评价不存在或暂不可互动');
          ownerId = target.userId;
          const edge = { userId, reviewId: id };
          changed = liked
            ? (
                await tx.reviewLike.createMany({
                  data: [edge],
                  skipDuplicates: true,
                })
              ).count
            : (await tx.reviewLike.deleteMany({ where: edge })).count;
          likeCount = await tx.reviewLike.count({ where: { reviewId: id } });
          break;
        }
        case 'comment': {
          const parent = await tx.comment.findUnique({
            where: { id },
            select: { reviewId: true },
          });
          if (!parent) throw new NotFoundException('回复不存在或暂不可互动');
          await tx.$queryRaw`SELECT id FROM reviews WHERE id = ${parent.reviewId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM comments WHERE id = ${id} FOR UPDATE`;
          const target = await tx.comment.findFirst({
            where: { id, ...visible, review: visible },
            select: { userId: true },
          });
          if (!target) throw new NotFoundException('回复不存在或暂不可互动');
          ownerId = target.userId;
          rootId = parent.reviewId;
          const edge = { userId, commentId: id };
          changed = liked
            ? (
                await tx.commentLike.createMany({
                  data: [edge],
                  skipDuplicates: true,
                })
              ).count
            : (await tx.commentLike.deleteMany({ where: edge })).count;
          likeCount = await tx.commentLike.count({ where: { commentId: id } });
          break;
        }
        case 'post': {
          await tx.$queryRaw`SELECT id FROM posts WHERE id = ${id} FOR UPDATE`;
          const target = await tx.post.findFirst({
            where: { id, ...visible },
            select: { userId: true },
          });
          if (!target) throw new NotFoundException('动态不存在或暂不可互动');
          ownerId = target.userId;
          const edge = { userId, postId: id };
          changed = liked
            ? (
                await tx.postLike.createMany({
                  data: [edge],
                  skipDuplicates: true,
                })
              ).count
            : (await tx.postLike.deleteMany({ where: edge })).count;
          likeCount = await tx.postLike.count({ where: { postId: id } });
          break;
        }
        case 'postComment': {
          const parent = await tx.postComment.findUnique({
            where: { id },
            select: { postId: true },
          });
          if (!parent) throw new NotFoundException('回复不存在或暂不可互动');
          await tx.$queryRaw`SELECT id FROM posts WHERE id = ${parent.postId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM post_comments WHERE id = ${id} FOR UPDATE`;
          const target = await tx.postComment.findFirst({
            where: { id, ...visible, post: visible },
            select: { userId: true },
          });
          if (!target) throw new NotFoundException('回复不存在或暂不可互动');
          ownerId = target.userId;
          rootId = parent.postId;
          const edge = { userId, postCommentId: id };
          changed = liked
            ? (
                await tx.postCommentLike.createMany({
                  data: [edge],
                  skipDuplicates: true,
                })
              ).count
            : (await tx.postCommentLike.deleteMany({ where: edge })).count;
          likeCount = await tx.postCommentLike.count({
            where: { postCommentId: id },
          });
        }
      }
      if (liked && changed)
        await this.notifications.create(tx, {
          userId: ownerId!,
          actorId: userId,
          type: 'like',
          targetType: type,
          targetId: id,
          rootId,
          dedupeKey: `like:${type}:${id}:${userId}:${ownerId!}`,
        });
      if (!liked)
        await this.notifications.withdraw(tx, {
          type: 'like',
          actorId: userId,
          targetType: type,
          targetId: id,
        });
      return {
        code: 200,
        message: 'success',
        data: { liked, likeCount: likeCount! },
      };
    });
  }
}
