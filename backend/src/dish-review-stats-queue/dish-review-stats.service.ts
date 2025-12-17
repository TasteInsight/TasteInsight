import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma.service';
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
    const agg = await this.prisma.review.aggregate({
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

    await this.prisma.dish.update({
      where: { id: dishId },
      data: {
        reviewCount,
        averageRating,
      },
    });
  }
}
