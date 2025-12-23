import { Module } from '@nestjs/common';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '@/prisma.service';
import { RecommendationCacheService } from './services/cache.service';
import { EventLoggerService } from './services/event-logger.service';
import { ExperimentService } from './services/experiment.service';
import { EmbeddingService } from './services/embedding.service';
import { FeatureEncoderService } from './services/feature-encoder.service';
import { TokenizerService } from './services/tokenizer.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [RecommendationController],
  providers: [
    PrismaService,
    RecommendationCacheService,
    EventLoggerService,
    ExperimentService,
    FeatureEncoderService,
    TokenizerService,
    EmbeddingService,
    RecommendationService, // 主推荐服务
  ],
  exports: [
    RecommendationService,
    RecommendationCacheService,
    EventLoggerService,
    ExperimentService,
    EmbeddingService,
    TokenizerService,
  ],
})
export class RecommendationModule {}
