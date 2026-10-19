import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { JwtService } from '@nestjs/jwt';
import { AdminConfigModule } from '@/admin-config/admin-config.module';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { ContentInteractionsModule } from '@/social/content-interactions.module';

@Module({
  imports: [
    ModerationCoreModule,
    NotificationsModule,
    ContentInteractionsModule,
    AdminConfigModule,
    DishReviewStatsQueueModule,
    EmbeddingQueueModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, JwtService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
