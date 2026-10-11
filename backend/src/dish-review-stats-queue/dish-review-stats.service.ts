import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import {
  DISH_REVIEW_STATS_QUEUE,
  DishReviewStatsJobType,
  RecomputeDishReviewStatsJobData,
} from './dish-review-stats.constants';

@Injectable()
export class DishReviewStatsService {
  private readonly syncMode: 'async' | 'sync';

  constructor(
    @InjectQueue(DISH_REVIEW_STATS_QUEUE)
    private readonly dishReviewStatsQueue: Queue,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.syncMode =
      this.configService.get('NODE_ENV') === 'test' ? 'sync' : 'async';
  }

  async recomputeDishStats(dishId: string): Promise<void> {
    if (this.syncMode === 'sync') {
      await this.recomputeDishStatsNow(dishId);
      return;
    }

    const data: RecomputeDishReviewStatsJobData = { dishId };
    await this.dishReviewStatsQueue.add(
      DishReviewStatsJobType.RECOMPUTE_DISH_REVIEW_STATS,
      data,
      {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  async recomputeDishStatsNow(dishId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM dishes WHERE id = ${dishId} FOR UPDATE`;
      if (!locked.length) return;
      const agg = await tx.review.aggregate({
        where: {
          dishId,
          status: 'approved',
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
        _avg: {
          rating: true,
        },
      });

      const reviewCount = agg._count._all;
      const averageRating = agg._avg.rating ?? 0;

      await tx.dish.update({
        where: { id: dishId },
        data: {
          reviewCount,
          averageRating,
        },
      });
    });
  }

  async recomputeBatch(
    tx: Prisma.TransactionClient,
    dishIds: string[],
  ): Promise<void> {
    if (!dishIds.length) return;
    const ids = [...new Set(dishIds)].sort();
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM dishes WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
    );
    await tx.$executeRaw(Prisma.sql`
      WITH stats AS (
        SELECT d.id, COUNT(r.id)::integer AS total,
               COALESCE(AVG(r.rating), 0)::double precision AS average
        FROM dishes d LEFT JOIN reviews r ON r."dishId" = d.id
          AND r.status = 'approved' AND r."deletedAt" IS NULL
        WHERE d.id IN (${Prisma.join(ids)}) GROUP BY d.id
      )
      UPDATE dishes d SET "reviewCount" = stats.total, "averageRating" = stats.average
      FROM stats WHERE d.id = stats.id
    `);
  }
}
