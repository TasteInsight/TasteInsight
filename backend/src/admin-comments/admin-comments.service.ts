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
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { RejectCommentDto } from './dto/reject-comment.dto';
import { NotificationService } from '@/notifications/notification.service';
import {
  PendingCommentListResponseDto,
  SuccessResponseDto,
  CommentItemData,
} from './dto/comment-response.dto';

@Injectable()
export class AdminCommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  async batchDeleteComments(ids: string[], admin: AdminInfo) {
    const deletedCount = await this.deleteComments(ids, admin);
    return { code: 200, message: '删除成功', data: { deletedCount } };
  }

  private async deleteComments(
    ids: string[],
    admin?: AdminCanteenScope,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const parents = await tx.comment.findMany({
        where: { id: { in: ids } },
        select: { reviewId: true },
      });
      const reviewIds = [...new Set(parents.map((row) => row.reviewId))].sort();
      const reviews = await tx.review.findMany({
        where: { id: { in: reviewIds } },
        select: { dishId: true },
      });
      const dishIds = [...new Set(reviews.map((row) => row.dishId))].sort();
      if (dishIds.length)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM dishes WHERE id IN (${Prisma.join(dishIds)}) ORDER BY id FOR UPDATE`,
        );
      if (reviewIds.length)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM reviews WHERE id IN (${Prisma.join(reviewIds)}) ORDER BY id FOR UPDATE`,
        );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM comments WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`,
      );
      const rows = await tx.comment.findMany({
        where: {
          id: { in: ids },
          deletedAt: null,
          review: { deletedAt: null },
        },
        select: {
          id: true,
          review: { select: { dish: { select: { canteenId: true } } } },
        },
      });
      if (rows.length !== ids.length)
        throw new NotFoundException('部分回复已不存在，请刷新列表');
      if (
        rows.some((row) => !canAccessCanteen(admin, row.review.dish.canteenId))
      )
        throw new ForbiddenException('无权删除所选回复');
      const result = await tx.comment.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await this.notifications.withdraw(tx, {
        targetType: 'comment',
        targetId: { in: ids },
      });
      return result.count;
    });
  }

  async getPendingComments(
    page: number = 1,
    pageSize: number = 20,
    adminInfo?: AdminCanteenScope,
  ): Promise<PendingCommentListResponseDto> {
    const skip = (page - 1) * pageSize;
    const where: any = {
      status: 'pending',
      deletedAt: null,
      review: { deletedAt: null },
    };

    if (!isGlobalScope(adminInfo)) {
      where.review.dish = { canteenId: canteenScopeFilter(adminInfo) };
    }

    const [total, comments] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { nickname: true, avatar: true } },
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
      userNickname: comment.user.nickname,
      userAvatar: comment.user.avatar,
      floor: comment.floor,
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

  async approveComment(
    id: string,
    adminInfo?: AdminCanteenScope,
  ): Promise<SuccessResponseDto> {
    return this.moderateComment(id, true, adminInfo);
  }

  private async moderateComment(
    id: string,
    approved: boolean,
    adminInfo?: AdminCanteenScope,
    reason?: string,
  ): Promise<SuccessResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const initial = await tx.comment.findUnique({
        where: { id, deletedAt: null },
        select: { reviewId: true, review: { select: { dishId: true } } },
      });
      if (!initial) throw new NotFoundException('评论不存在');
      await tx.$queryRaw`SELECT id FROM dishes WHERE id = ${initial.review.dishId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM reviews WHERE id = ${initial.reviewId} FOR UPDATE`;
      const comment = await tx.comment.findUnique({
        where: { id, deletedAt: null },
        include: {
          parentComment: { select: { userId: true } },
          review: {
            include: {
              dish: true,
            },
          },
        },
      });
      if (!comment) {
        throw new NotFoundException('评论不存在');
      }

      if (!canAccessCanteen(adminInfo, comment.review.dish.canteenId)) {
        throw new ForbiddenException('权限不足');
      }

      if (
        approved &&
        (comment.review.status !== 'approved' || comment.review.deletedAt)
      )
        throw new ConflictException('评价尚不可公开回复');
      if (approved) {
        const verified = await tx.studentVerification.findFirst({
          where: {
            userId: comment.userId,
            status: 'VERIFIED',
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (!verified) throw new ConflictException('作者的学生认证已失效');
      }
      const result = await tx.comment.updateMany({
        where: { id, deletedAt: null, status: 'pending' },
        data: {
          status: approved ? 'approved' : 'rejected',
          rejectReason: approved ? null : reason,
        },
      });
      if (!result.count)
        throw new ConflictException('评论审核状态已变更，请刷新');
      if (approved)
        await this.notifications.createReply(
          tx,
          comment.userId,
          'comment',
          id,
          comment.reviewId,
          [
            comment.review.userId,
            ...(comment.parentComment ? [comment.parentComment.userId] : []),
          ],
        );
      else
        await this.notifications.withdraw(tx, {
          targetType: 'comment',
          targetId: id,
        });
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
    adminInfo?: AdminCanteenScope,
  ): Promise<SuccessResponseDto> {
    return this.moderateComment(id, false, adminInfo, dto.reason);
  }

  async deleteComment(
    id: string,
    adminInfo?: AdminCanteenScope,
  ): Promise<SuccessResponseDto> {
    await this.deleteComments([id], adminInfo);

    return {
      code: 200,
      message: '删除成功',
      data: null,
    };
  }
}
