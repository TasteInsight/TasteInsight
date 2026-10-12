import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationCampaign, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma.service';
import { NotificationService } from './notification.service';
import { campusWeekKey } from './weekly-recommendation';

@Injectable()
export class NotificationCampaignService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationCampaignService.name);
  private timer?: ReturnType<typeof setInterval>;
  private activeRun?: Promise<void>;
  private stopping = false;
  private readonly batchSize = 100;
  private readonly leaseMs = 60000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.error('Notification campaign tick failed'),
      );
    }, 10000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.activeRun?.catch(() => undefined);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.activeRun || this.stopping) return;
    this.activeRun = this.runTick(now);
    try {
      await this.activeRun;
    } finally {
      this.activeRun = undefined;
    }
  }

  private async runTick(now: Date): Promise<void> {
    await this.publishWeeklyCollection(now);
    if (this.stopping) return;
    const due = await this.prisma.notificationCampaign.findMany({
      where: this.dueWhere(now),
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      take: 3,
    });
    for (const campaign of due) {
      if (this.stopping) break;
      await this.processBatch(campaign);
    }
  }

  private dueWhere(now: Date): Prisma.NotificationCampaignWhereInput {
    return {
      OR: [
        { status: 'pending', nextAttemptAt: { lte: now } },
        { status: 'processing', lockedUntil: { lte: now } },
      ],
    };
  }

  private async publishWeeklyCollection(now: Date): Promise<void> {
    const weekKey = campusWeekKey(now);
    if (
      await this.prisma.weeklyRecommendationCollection.findUnique({
        where: { weekKey },
        select: { weekKey: true },
      })
    )
      return;
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      const popular = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT d."id"
        FROM "dishes" d
        LEFT JOIN "reviews" r ON r."dishId" = d."id"
          AND r."status" = 'approved' AND r."deletedAt" IS NULL
        WHERE d."status" = 'online'
        GROUP BY d."id"
        ORDER BY COUNT(r."id") FILTER (WHERE r."createdAt" >= ${since} AND r."createdAt" <= ${now}) DESC,
          COUNT(r."id") DESC, COALESCE(AVG(r."rating"), 0) DESC, d."id" ASC
        LIMIT 8
      `;
      if (!popular.length) return;
      const inserted = await tx.weeklyRecommendationCollection.createMany({
        data: [
          { weekKey, dishIds: popular.map(({ id }) => id), publishedAt: now },
        ],
        skipDuplicates: true,
      });
      if (!inserted.count) return;
      await tx.notificationCampaign.create({
        data: {
          type: 'weekly_recommendation',
          targetId: weekKey,
          dedupeKey: `weekly_recommendation:${weekKey}`,
          recipientCutoff: now,
        },
      });
    });
  }

  private async processBatch(campaign: NotificationCampaign): Promise<void> {
    const now = new Date();
    const leaseToken = randomUUID();
    const claimed = await this.prisma.notificationCampaign.updateMany({
      where: {
        id: campaign.id,
        updatedAt: campaign.updatedAt,
        ...this.dueWhere(now),
      },
      data: {
        status: 'processing',
        lockedUntil: new Date(now.getTime() + this.leaseMs),
        leaseToken,
      },
    });
    if (!claimed.count) return;
    const owned = { id: campaign.id, status: 'processing', leaseToken };
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // The update holds the campaign row through inbox insertion and cursor commit.
          const held = await tx.notificationCampaign.updateMany({
            where: { ...owned, lockedUntil: { gt: new Date() } },
            data: { lockedUntil: new Date(Date.now() + this.leaseMs) },
          });
          if (!held.count) return;
          const result = await this.notifications.createServiceBatch(
            tx,
            campaign,
            this.batchSize,
          );
          await tx.notificationCampaign.updateMany({
            where: owned,
            data: {
              status: result.unavailable
                ? 'cancelled'
                : result.complete
                  ? 'completed'
                  : 'pending',
              cursorUserId: result.cursorUserId,
              nextAttemptAt: new Date(),
              attempts: 0,
              lockedUntil: null,
              leaseToken: null,
              lastError: null,
            },
          });
        },
        { timeout: 15000 },
      );
    } catch {
      const delay = Math.min(
        3600000,
        5000 * 2 ** Math.min(campaign.attempts, 10),
      );
      await this.prisma.notificationCampaign.updateMany({
        where: owned,
        data: {
          status: 'pending',
          attempts: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + delay),
          lockedUntil: null,
          leaseToken: null,
          lastError: 'batch_failed',
        },
      });
      this.logger.warn(`Notification campaign ${campaign.id} will retry`);
    }
  }
}
