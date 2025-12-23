import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminRecommendationController } from './admin-recommendation.controller';
import { ExperimentsService } from './services/experiments.service';
import { RecallQualityService } from './services/recall-quality.service';
import { RecallMetricsCalculator } from './services/recall-metrics.service';
import { PrismaService } from '@/prisma.service';
import { RecommendationModule } from '@/recommendation/recommendation.module';

/**
 * 管理员推荐系统管理模块
 *
 * 提供：
 * - A/B 测试实验管理
 * - 召回质量评估
 * - 推荐系统监控和分析
 */
@Module({
  imports: [JwtModule.register({}), ConfigModule, RecommendationModule],
  controllers: [AdminRecommendationController],
  providers: [
    PrismaService,
    ExperimentsService,
    RecallQualityService,
    RecallMetricsCalculator,
  ],
  exports: [ExperimentsService, RecallQualityService, RecallMetricsCalculator],
})
export class AdminRecommendationModule {}
