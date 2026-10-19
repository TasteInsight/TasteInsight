import { ModerationDispatcher } from '@/content-moderation/moderation-dispatcher.service';
import { ModerationProcessingModule } from '@/content-moderation/moderation-processing.module';
import { NewsSourcesModule } from '@/news-sources/news-sources.module';
import { NewsSourcesProcessor } from '@/news-sources/news-sources.processor';
import { Module, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue/dish-review-stats-queue.module';
import { DishReviewStatsProcessor } from '@/dish-review-stats-queue/dish-review-stats.processor';
import { DishSyncQueueModule } from '@/dish-sync-queue/dish-sync-queue.module';
import { DishSyncProcessor } from '@/dish-sync-queue/dish-sync.processor';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';
import { EmbeddingQueueProcessor } from '@/embedding-queue/embedding-queue.processor';
import { NotificationCampaignService } from '@/notifications/notification-campaign.service';
import { NotificationDispatcher } from '@/notifications/notification-dispatcher.service';
import { NotificationsModule } from '@/notifications/notifications.module';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { UploadModule } from '@/upload/upload.module';
import { ContributionImageCleanup } from '@/upload/contribution-image-cleanup.service';
import { ContributionPublicationService } from '@/admin-uploads/contribution-publication.service';

@Module({
  imports: [
    ModerationProcessingModule,
    NewsSourcesModule,
    RecommendationModule,
    UploadModule,
    NotificationsModule,
    EmbeddingQueueModule,
    DishSyncQueueModule,
    DishReviewStatsQueueModule,
  ],
  providers: [
    ModerationDispatcher,
    NewsSourcesProcessor,
    EmbeddingQueueProcessor,
    DishSyncProcessor,
    DishReviewStatsProcessor,
    NotificationCampaignService,
    NotificationDispatcher,
    ContributionImageCleanup,
    ContributionPublicationService,
  ],
  exports: [
    NewsSourcesProcessor,
    EmbeddingQueueProcessor,
    DishSyncProcessor,
    DishReviewStatsProcessor,
    RecommendationModule,
  ],
})
export class BackgroundWorkersModule implements OnModuleDestroy {
  constructor(
    private readonly embedding: EmbeddingQueueProcessor,
    private readonly dishSync: DishSyncProcessor,
    private readonly reviewStats: DishReviewStatsProcessor,
    private readonly newsSources: NewsSourcesProcessor,
  ) {}

  async onModuleDestroy(): Promise<void> {
    // Drain consumers before shared DB and cache application-shutdown hooks.
    await Promise.all(
      [this.embedding, this.dishSync, this.reviewStats, this.newsSources].map(
        async (processor) => {
          let worker: Worker;
          try {
            worker = processor.worker;
          } catch {
            // A failed startup may stop before Bull registers the consumer.
            return;
          }
          await worker.close();
        },
      ),
    );
  }
}
