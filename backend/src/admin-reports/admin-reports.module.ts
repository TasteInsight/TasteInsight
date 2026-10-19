import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue';
import { NotificationsModule } from '@/notifications/notifications.module';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';

@Module({
  imports: [
    ModerationCoreModule,
    JwtModule.register({}),
    ConfigModule,
    DishReviewStatsQueueModule,
    NotificationsModule,
    EmbeddingQueueModule,
  ],
  controllers: [AdminReportsController],
  providers: [AdminReportsService, PermissionsGuard],
})
export class AdminReportsModule {}
