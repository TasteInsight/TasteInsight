import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { JwtService } from '@nestjs/jwt';
import { AdminConfigModule } from '@/admin-config/admin-config.module';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';

@Module({
  imports: [
    AdminConfigModule,
    DishReviewStatsQueueModule,
    EmbeddingQueueModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, JwtService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
