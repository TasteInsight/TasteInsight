import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { DISH_REVIEW_STATS_QUEUE } from './dish-review-stats.constants';
import { DishReviewStatsService } from './dish-review-stats.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: DISH_REVIEW_STATS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  providers: [DishReviewStatsService],
  exports: [DishReviewStatsService, BullModule],
})
export class DishReviewStatsQueueModule {}
