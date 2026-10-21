import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Notification, NotificationCampaign } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma.service';
import { DishDto } from '@/dishes/dto/dish.dto';
import { campusWeekKey } from './weekly-recommendation';

export type NotificationTarget =
  | 'review'
  | 'comment'
  | 'post'
  | 'postComment'
  | 'dining_invite'
  | 'dish'
  | 'report'
  | 'dish_upload'
  | 'week_collection';
export type NotificationType =
  | 'like'
  | 'reply'
  | 'dining_application'
  | 'dining_accepted'
  | 'dining_rejected'
  | 'dining_cancelled'
  | 'new_dish'
  | 'price_change'
  | 'weekly_recommendation'
  | 'report_handled';
// Review results are transactional service messages for the contributor.
export type UploadResultNotificationType =
  | 'upload_approved'
  | 'upload_rejected'
  | 'upload_revoked';
export interface NotificationEvent {
  userId: string;
  actorId: string | null;
  type: NotificationType | UploadResultNotificationType;
  targetType: NotificationTarget;
  targetId: string;
  rootId?: string;
  dedupeKey: string;
}

const publicContent = { status: 'approved', deletedAt: null };
const actorSelect = { id: true, nickname: true, avatar: true } as const;
export type NotificationScope = 'all' | 'service';
const scopeWhere = (scope: NotificationScope) =>
  scope === 'service'
    ? {
        targetType: {
          in: [
            'review',
            'comment',
            'dish',
            'week_collection',
            'dish_upload',
            'report',
          ],
        },
      }
    : {};

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  webhookUrl(): string | undefined {
    return (
      this.config.get<string>('NOTIFICATION_WEBHOOK_URL')?.trim() || undefined
    );
  }

  async create(
    tx: Prisma.TransactionClient,
    event: NotificationEvent,
  ): Promise<void> {
    if (event.userId === event.actorId || !(await this.canDeliver(tx, event)))
      return;
    const id = randomUUID();
    const result = await tx.notification.createMany({
      data: [{ id, ...event }],
      skipDuplicates: true,
    });
    if (result.count && this.webhookUrl()) {
      await tx.notificationOutbox.create({ data: { notificationId: id } });
    }
  }

  async canDeliver(
    tx: Prisma.TransactionClient,
    event: Pick<Notification, 'userId' | 'type' | 'targetType' | 'targetId'>,
  ): Promise<boolean> {
    if (event.targetType === 'report') {
      return !!(await tx.report.findFirst({
        where: {
          id: event.targetId,
          reporterId: event.userId,
          status: { in: ['approved', 'rejected'] },
        },
        select: { id: true },
      }));
    }
    if (event.targetType === 'dish_upload') {
      return !!(await tx.dishUpload.findFirst({
        where: { id: event.targetId, userId: event.userId },
        select: { id: true },
      }));
    }
    const settings = await tx.userSetting.findUnique({
      where: { userId: event.userId },
    });
    const enabled =
      event.type === 'new_dish'
        ? settings?.newDishAlert
        : event.type === 'price_change'
          ? (settings?.priceChangeAlert ?? false)
          : event.type === 'weekly_recommendation'
            ? settings?.weeklyRecommendation
            : event.type === 'like'
              ? settings?.likeAlert
              : event.targetType === 'dining_invite'
                ? settings?.diningAlert
                : event.targetType === 'post' ||
                    event.targetType === 'postComment'
                  ? settings?.postReplyAlert
                  : settings?.reviewReplyAlert;
    if (enabled === false) return false;
    switch (event.targetType) {
      case 'dish':
        return !!(await tx.dish.findFirst({
          where: {
            id: event.targetId,
            status: 'online',
            ...(event.type === 'price_change'
              ? { favoritedBy: { some: { userId: event.userId } } }
              : {}),
          },
          select: { id: true },
        }));
      case 'week_collection':
        return this.serviceTargetAvailable(
          tx,
          'week_collection',
          event.targetId,
        );
      case 'review':
        return !!(await tx.review.findFirst({
          where: { id: event.targetId, ...publicContent },
          select: { id: true },
        }));
      case 'comment':
        return !!(await tx.comment.findFirst({
          where: {
            id: event.targetId,
            ...publicContent,
            review: publicContent,
          },
          select: { id: true },
        }));
      case 'post':
        return !!(await tx.post.findFirst({
          where: { id: event.targetId, ...publicContent },
          select: { id: true },
        }));
      case 'postComment':
        return !!(await tx.postComment.findFirst({
          where: { id: event.targetId, ...publicContent, post: publicContent },
          select: { id: true },
        }));
      case 'dining_invite':
        return !!(await tx.diningInvite.findFirst({
          where: {
            id: event.targetId,
            OR: [
              { mealPlan: { userId: event.userId } },
              { applications: { some: { userId: event.userId } } },
            ],
          },
          select: { id: true },
        }));
      default:
        return false;
    }
  }

  private async serviceTargetAvailable(
    tx: Prisma.TransactionClient,
    targetType: 'dish' | 'week_collection',
    targetId: string,
  ): Promise<boolean> {
    if (targetType === 'dish') {
      return !!(await tx.dish.findFirst({
        where: { id: targetId, status: 'online' },
        select: { id: true },
      }));
    }
    const collection = await tx.weeklyRecommendationCollection.findUnique({
      where: { weekKey: targetId },
      select: { dishIds: true },
    });
    return !!(
      collection &&
      (await tx.dish.findFirst({
        where: { id: { in: collection.dishIds }, status: 'online' },
        select: { id: true },
      }))
    );
  }

  async createServiceBatch(
    tx: Prisma.TransactionClient,
    campaign: NotificationCampaign,
    batchSize: number,
  ): Promise<{
    unavailable: boolean;
    complete: boolean;
    cursorUserId: string | null;
  }> {
    const targetType =
      campaign.type === 'weekly_recommendation' ? 'week_collection' : 'dish';
    if (
      !(await this.serviceTargetAvailable(tx, targetType, campaign.targetId))
    ) {
      return {
        unavailable: true,
        complete: true,
        cursorUserId: campaign.cursorUserId,
      };
    }
    const recipients = await tx.user.findMany({
      where: {
        createdAt: { lte: campaign.recipientCutoff },
        ...(campaign.cursorUserId ? { id: { gt: campaign.cursorUserId } } : {}),
        ...(campaign.type === 'price_change'
          ? {
              settings: { is: { priceChangeAlert: true } },
              favoriteDishes: {
                some: {
                  dishId: campaign.targetId,
                  addedAt: { lte: campaign.recipientCutoff },
                },
              },
            }
          : {
              OR: [
                { settings: { is: null } },
                {
                  settings: {
                    is:
                      campaign.type === 'new_dish'
                        ? { newDishAlert: true }
                        : { weeklyRecommendation: true },
                  },
                },
              ],
            }),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: batchSize,
    });
    if (recipients.length) {
      const inserted = await tx.notification.createManyAndReturn({
        data: recipients.map(({ id: userId }) => ({
          id: randomUUID(),
          userId,
          actorId: null,
          type: campaign.type,
          targetType,
          targetId: campaign.targetId,
          dedupeKey: `${campaign.dedupeKey}:${userId}`,
          createdAt: campaign.recipientCutoff,
        })),
        select: { id: true },
        skipDuplicates: true,
      });
      if (inserted.length && this.webhookUrl()) {
        await tx.notificationOutbox.createMany({
          data: inserted.map(({ id }) => ({ notificationId: id })),
        });
      }
    }
    return {
      unavailable: false,
      complete: recipients.length < batchSize,
      cursorUserId: recipients.at(-1)?.id ?? campaign.cursorUserId,
    };
  }

  async getWeeklyCollection(weekKey: string) {
    const weekStart = new Date(`${weekKey}T00:00:00+08:00`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(weekKey) ||
      Number.isNaN(weekStart.getTime()) ||
      campusWeekKey(weekStart) !== weekKey
    ) {
      throw new BadRequestException('推荐周标识无效');
    }
    const collection =
      await this.prisma.weeklyRecommendationCollection.findUnique({
        where: { weekKey },
      });
    if (!collection) throw new NotFoundException('本周推荐不存在');
    const dishes = await this.prisma.dish.findMany({
      where: { id: { in: collection.dishIds }, status: 'online' },
      include: {
        canteen: true,
        window: true,
        floor: true,
        parentDish: { select: { status: true } },
        subDishes: { where: { status: 'online' }, select: { id: true } },
      },
    });
    const byId = new Map(dishes.map((dish) => [dish.id, dish]));
    return {
      code: 200,
      message: 'success',
      data: {
        weekKey: collection.weekKey,
        publishedAt: collection.publishedAt.toISOString(),
        items: collection.dishIds.flatMap((id) => {
          const dish = byId.get(id);
          return dish
            ? [
                DishDto.fromEntity({
                  ...dish,
                  canteenName: dish.canteen.name,
                  windowName: dish.window?.name ?? dish.windowName,
                  windowNumber: dish.window?.number ?? dish.windowNumber,
                  floorName: dish.floor?.name ?? dish.floorName,
                  floorLevel: dish.floor?.level ?? dish.floorLevel,
                  parentDishId:
                    dish.parentDish?.status === 'online'
                      ? dish.parentDishId
                      : null,
                }),
              ]
            : [];
        }),
      },
    };
  }

  async createReply(
    tx: Prisma.TransactionClient,
    actorId: string,
    targetType: 'comment' | 'postComment',
    targetId: string,
    rootId: string,
    recipients: string[],
  ): Promise<void> {
    for (const userId of new Set(recipients)) {
      await this.create(tx, {
        userId,
        actorId,
        type: 'reply',
        targetType,
        targetId,
        rootId,
        dedupeKey: `reply:${targetType}:${targetId}:${userId}`,
      });
    }
  }

  async withdraw(
    tx: Prisma.TransactionClient,
    where: Prisma.NotificationWhereInput,
  ): Promise<void> {
    await tx.notification.updateMany({
      where: { ...where, withdrawnAt: null },
      data: { withdrawnAt: new Date() },
    });
    await tx.notificationOutbox.updateMany({
      where: { notification: where, status: { in: ['pending', 'processing'] } },
      data: { status: 'cancelled', lockedUntil: null },
    });
  }

  async withdrawThread(
    tx: Prisma.TransactionClient,
    type: 'review' | 'post',
    id: string,
  ): Promise<void> {
    await this.withdraw(tx, {
      OR: [
        { targetType: type, targetId: id },
        {
          targetType: type === 'review' ? 'comment' : 'postComment',
          rootId: id,
        },
      ],
    });
  }

  async getInbox(
    userId: string,
    page = 1,
    pageSize = 20,
    scope: NotificationScope = 'all',
  ) {
    const where = { userId, withdrawnAt: null, ...scopeWhere(scope) };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: { actor: { select: actorSelect } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    const reviewIds = [
      ...new Set(
        items.flatMap((item) =>
          item.targetType === 'review'
            ? [item.targetId]
            : item.targetType === 'comment' && item.rootId
              ? [item.rootId]
              : [],
        ),
      ),
    ];
    const uploadIds = [
      ...new Set(
        items
          .filter((item) => item.targetType === 'dish_upload')
          .map((item) => item.targetId),
      ),
    ];
    const publicDishIds = [
      ...new Set(
        items
          .filter((item) => item.targetType === 'dish')
          .map((item) => item.targetId),
      ),
    ];
    const [reviews, uploads, dishes] = await Promise.all([
      reviewIds.length
        ? this.prisma.review.findMany({
            where: { id: { in: reviewIds }, ...publicContent },
            select: { id: true, dishId: true },
          })
        : [],
      uploadIds.length
        ? this.prisma.dishUpload.findMany({
            where: { userId, id: { in: uploadIds } },
            select: { id: true, name: true },
          })
        : [],
      publicDishIds.length
        ? this.prisma.dish.findMany({
            where: { id: { in: publicDishIds }, status: 'online' },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const uploadNames = new Map(
      uploads.map((upload) => [upload.id, upload.name] as const),
    );
    const dishNames = new Map(
      dishes.map((dish) => [dish.id, dish.name] as const),
    );
    const dishIds = new Map(
      reviews.map((review) => [review.id, review.dishId] as const),
    );
    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((item) => ({
          id: item.id,
          type: item.type,
          actor: item.actor,
          targetType: item.targetType,
          targetId: item.targetId,
          subject:
            item.targetType === 'dish_upload'
              ? (uploadNames.get(item.targetId) ?? null)
              : item.targetType === 'dish'
                ? (dishNames.get(item.targetId) ?? null)
                : null,
          rootId: item.rootId,
          dishId:
            dishIds.get(
              item.targetType === 'review'
                ? item.targetId
                : (item.rootId ?? ''),
            ) ?? null,
          readAt: item.readAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString(),
        })),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async unreadCount(userId: string, scope: NotificationScope = 'all') {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, withdrawnAt: null, readAt: null, ...scopeWhere(scope) },
    });
    return { code: 200, message: 'success', data: { unreadCount } };
  }

  async read(userId: string, id?: string, scope: NotificationScope = 'all') {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        ...(id ? { id } : {}),
        withdrawnAt: null,
        readAt: null,
        ...scopeWhere(scope),
      },
      data: { readAt: new Date() },
    });
    return { code: 200, message: 'success', data: null };
  }
}
