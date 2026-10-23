import { AllergensModule } from '@/allergens/allergens.module';

import { RecommendationStoreService } from '@/recommendation-store/recommendation-store.service';
import { RecommendationIndexSyncService } from '@/recommendation-store/recommendation-index-sync.service';
import { ModelRuntimeService } from '@/recommendation-platform/model-runtime.service';
import { RecommendationCatalogService } from '@/recommendation-platform/catalog.service';
import { RecommendationPolicyService } from '@/recommendation-platform/policy.service';
import { RecommendationTrackingService } from '@/recommendation-platform/tracking.service';
import { RecommendationSessionService } from '@/recommendation-platform/session.service';
import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationCacheService } from './services/cache.service';
import { EventLoggerService } from './services/event-logger.service';
import { ExperimentService } from './services/experiment.service';
import { EmbeddingService } from './services/embedding.service';
import { FeatureEncoderService } from './services/feature-encoder.service';
import { TokenizerService } from './services/tokenizer.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, AllergensModule],
  providers: [
    RecommendationStoreService,
    RecommendationIndexSyncService,
    ModelRuntimeService,
    RecommendationCatalogService,
    RecommendationPolicyService,
    RecommendationTrackingService,
    RecommendationSessionService,

    RecommendationCacheService,
    EventLoggerService,
    ExperimentService,
    FeatureEncoderService,
    TokenizerService,
    EmbeddingService,
    RecommendationService, // 主推荐服务
  ],
  exports: [
    RecommendationStoreService,
    RecommendationIndexSyncService,
    ModelRuntimeService,
    RecommendationCatalogService,
    RecommendationPolicyService,
    RecommendationTrackingService,
    RecommendationSessionService,

    RecommendationService,
    RecommendationCacheService,
    EventLoggerService,
    ExperimentService,
    EmbeddingService,
    TokenizerService,
  ],
})
export class RecommendationModule {}
