import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminReviewsService } from './admin-reviews.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue';
import { NotificationsModule } from '@/notifications/notifications.module';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';

@Module({
  imports: [
    JwtModule.register({}),
    ConfigModule,
    DishReviewStatsQueueModule,
    NotificationsModule,
    EmbeddingQueueModule,
  ],
  controllers: [AdminReviewsController],
  providers: [AdminReviewsService, PermissionsGuard],
})
export class AdminReviewsModule {}
