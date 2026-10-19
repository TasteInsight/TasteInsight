import { Module } from '@nestjs/common';
import { AdminConfigModule } from '@/admin-config/admin-config.module';
import { AdminReviewsService } from '@/admin-reviews/admin-reviews.service';
import { AdminCommentsService } from '@/admin-comments/admin-comments.service';
import { SocialService } from '@/social/social.service';
import { ContentInteractionsModule } from '@/social/content-interactions.module';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { ModerationCoreModule } from './moderation-core.module';
import { ModerationPublicationService } from './moderation-publication.service';
import { ModerationWorkerService } from './moderation-worker.service';
import { WechatModerationCallbackService } from './wechat-callback.service';

@Module({
  imports: [
    ModerationCoreModule,
    AdminConfigModule,
    NotificationsModule,
    ContentInteractionsModule,
    DishReviewStatsQueueModule,
    EmbeddingQueueModule,
  ],
  providers: [
    AdminReviewsService,
    AdminCommentsService,
    SocialService,
    ModerationPublicationService,
    ModerationWorkerService,
    WechatModerationCallbackService,
  ],
  exports: [
    ModerationCoreModule,
    ModerationWorkerService,
    ModerationPublicationService,
    WechatModerationCallbackService,
  ],
})
export class ModerationProcessingModule {}
