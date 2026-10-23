import { Injectable, BadRequestException } from '@nestjs/common';
import {
  RecommendationIndex,
  RecommendationModel,
  RecommendationStrategy,
} from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { RecommendationScene } from '@/recommendation/constants/recommendation.constants';
import type { ExperimentAssignment } from '@/recommendation/interfaces';
import { StrategyConfig } from './contracts';
import { resolveRecommendationConfig } from '@/recommendation/config/recommendation-config';
import {
  builtInBaseline,
  digest,
  isRuleBaseline,
  parseStrategy,
} from './strategy-config';

export interface ResolvedPolicy {
  strategyRevisionId?: string;
  config: StrategyConfig;
  digest: string;
  index?: RecommendationIndex & { model: RecommendationModel };
  ranker?: RecommendationModel;
}

@Injectable()
export class RecommendationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    scene: RecommendationScene,
    assignment: ExperimentAssignment | null,
    previewId?: string,
  ): Promise<ResolvedPolicy | null> {
    let id = previewId ?? assignment?.strategyRevisionId;
    if (!id)
      id = (
        await this.prisma.recommendationSceneDefault.findUnique({
          where: { scene },
        })
      )?.strategyRevisionId;
    if (!id) return null;
    const strategy = await this.prisma.recommendationStrategy.findUnique({
      where: { id },
    });
    if (
      !strategy ||
      strategy.scene !== String(scene) ||
      (!previewId && strategy.status !== 'published') ||
      strategy.status === 'retired'
    )
      throw new BadRequestException('策略版本不可用或场景不匹配');
    if (assignment && !assignment.strategyRevisionId && !previewId) {
      const base = parseStrategy(strategy.config, scene);
      const override = resolveRecommendationConfig(
        { weights: assignment.weights, recallQuota: assignment.recallQuota },
        scene,
      );
      const config: StrategyConfig = {
        ...base,
        recall: {
          ...base.recall,
          sources: assignment.recallQuota ?? base.recall.sources,
        },
        ranking: assignment.weights
          ? { type: 'weighted_rules', weights: override.weights }
          : base.ranking,
      };
      if (config.recall.sources.vectorQuota === 0) delete config.recall.indexId;
      // A missing vector index becomes an explicit runtime fallback, never a legacy-store lookup.
      return this.materialize(
        {
          ...strategy,
          config: config as any,
          digest: digest({ scene, config }),
        },
        config,
      );
    }
    return this.materialize(strategy);
  }

  private async materialize(
    strategy: RecommendationStrategy,
    resolvedConfig?: StrategyConfig,
  ): Promise<ResolvedPolicy> {
    const config =
      resolvedConfig ?? parseStrategy(strategy.config, strategy.scene);
    const index = config.recall.indexId
      ? await this.prisma.recommendationIndex.findUnique({
          where: { id: config.recall.indexId },
          include: { model: true },
        })
      : null;
    const ranker =
      config.ranking.type === 'model_endpoint'
        ? await this.prisma.recommendationModel.findUnique({
            where: { id: config.ranking.modelVersionId },
          })
        : null;
    return {
      strategyRevisionId: strategy.id,
      config,
      digest: strategy.digest ?? digest({ scene: strategy.scene, config }),
      index: index ?? undefined,
      ranker: ranker ?? undefined,
    };
  }

  async fallback(
    scene: RecommendationScene,
    original: ResolvedPolicy | null,
  ): Promise<ResolvedPolicy> {
    const id = original?.config.fallbackStrategyRevisionId;
    if (id) {
      const strategy = await this.prisma.recommendationStrategy.findUnique({
        where: { id },
      });
      if (
        strategy?.status === 'published' &&
        strategy.scene === String(scene) &&
        isRuleBaseline(parseStrategy(strategy.config, scene))
      )
        return this.materialize(strategy);
    }
    const config = builtInBaseline(scene);
    return { config, digest: digest({ scene, config }) };
  }
}
