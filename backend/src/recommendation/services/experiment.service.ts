import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import cuid from 'cuid';
import { PrismaService } from '@/prisma.service';
import { RecommendationCacheService } from './cache.service';
import {
  ExperimentConfig,
  ExperimentAssignment,
  RecommendationWeights,
  RecommendationContext,
} from '../interfaces';
import { RECOMMENDATION_WEIGHTS } from '../constants/recommendation.constants';
import { normalizedHash } from '../utils/hash.util';

/**
 * A/B 测试实验服务
 * 管理实验配置、用户分组分配、实验数据收集
 */
@Injectable()
export class ExperimentService implements OnModuleInit {
  private readonly logger = new Logger(ExperimentService.name);
  // 最近一次读取的实验快照；分组决策从数据库刷新。
  private activeExperiments: Map<string, ExperimentConfig> = new Map();
  private refreshPromise: Promise<void> = Promise.resolve();

  constructor(
    private prisma: PrismaService,
    private cacheService: RecommendationCacheService,
  ) {}

  async onModuleInit() {
    // 启动时立即加载活跃实验
    await this.refreshActiveExperiments();
  }

  /**
   * 每次操作等待自己的串行刷新，避免覆盖尚未读取的提交。
   */
  async refreshActiveExperiments(): Promise<void> {
    const refresh = this.refreshPromise
      .catch(() => undefined)
      .then(() => this.doRefresh());
    this.refreshPromise = refresh;
    return refresh;
  }

  /**
   * 执行实际的刷新操作
   */
  private async doRefresh(): Promise<void> {
    const now = new Date();

    const experiments = await this.prisma.experiment.findMany({
      where: {
        status: 'running',
        startTime: { lte: now },
        OR: [{ endTime: null }, { endTime: { gte: now } }],
      },
      include: {
        groupItems: true,
      },
    });

    const activeExperiments = new Map<string, ExperimentConfig>();

    for (const exp of experiments) {
      const config: ExperimentConfig = {
        experimentId: exp.id,
        name: exp.name,
        trafficRatio: exp.trafficRatio,
        startTime: exp.startTime,
        endTime: exp.endTime || undefined,
        status: exp.status,
        groupItems: exp.groupItems.map((g) => {
          // 从 config 中提取 weights 和 recallQuota
          const dbConfig = g.config as any;
          return {
            groupItemId: g.id,
            name: g.name,
            ratio: g.ratio,
            weights:
              dbConfig && typeof dbConfig === 'object' && 'weights' in dbConfig
                ? (dbConfig.weights as
                    | Partial<RecommendationWeights>
                    | undefined)
                : undefined,
            recallQuota:
              dbConfig &&
              typeof dbConfig === 'object' &&
              'recallQuota' in dbConfig
                ? dbConfig.recallQuota
                : undefined,
          };
        }),
      };

      activeExperiments.set(exp.id, config);
    }

    this.activeExperiments = activeExperiments;
    this.logger.debug(`Loaded ${activeExperiments.size} active experiments`);
  }

  /**
   * 为用户分配实验组
   *
   * @param userId 用户ID
   * @param context 推荐上下文（保留可选）
   */
  async assignUserToExperiment(
    userId: string,
    _context?: RecommendationContext,
  ): Promise<ExperimentAssignment | null> {
    await this.refreshActiveExperiments();
    const activeExperiments = this.activeExperiments;
    // 如果没有活跃实验，返回空
    if (activeExperiments.size === 0) {
      return null;
    }

    // 遍历活跃实验，找到用户应该参与的实验
    for (const [experimentId, experiment] of activeExperiments) {
      // 检查用户是否应该参与这个实验（根据流量比例）
      const shouldParticipate = this.shouldUserParticipate(userId, experiment);

      if (!shouldParticipate || experiment.groupItems.length === 0) {
        continue;
      }

      // 检查用户是否已经被分配过
      let groupItemId = await this.cacheService.getUserExperimentGroup(
        userId,
        experimentId,
      );

      if (
        !experiment.groupItems.some(
          (group) => group.groupItemId === groupItemId,
        )
      ) {
        groupItemId = await this.assignUserToGroupItem(userId, experiment);
      }

      // 获取分组配置
      const groupItem = experiment.groupItems.find(
        (g) => g.groupItemId === groupItemId,
      );

      if (!groupItem) {
        continue;
      }

      const weights = groupItem.weights
        ? this.mergeWeights(groupItem.weights)
        : this.getDefaultWeights();

      return {
        groupItemId: groupItem.groupItemId,
        name: groupItem.name,
        ratio: groupItem.ratio,
        weights: groupItem.weights,
        recallQuota: groupItem.recallQuota, // 明确返回召回配额
        experimentId,
        resolvedWeights: weights,
      };
    }

    return null;
  }

  /**
   * 判断用户是否应该参与实验
   * 使用用户 ID 的哈希值确保同一用户的结果一致
   */
  private shouldUserParticipate(
    userId: string,
    experiment: ExperimentConfig,
  ): boolean {
    const normalized = normalizedHash(userId + experiment.experimentId);
    return normalized < experiment.trafficRatio;
  }

  /**
   * 为用户分配实验分组项
   */
  private async assignUserToGroupItem(
    userId: string,
    experiment: ExperimentConfig,
  ): Promise<string | null> {
    const normalized = normalizedHash(
      userId + experiment.experimentId + ':group',
    );

    let cumulative = 0;
    let selectedGroupItemId = experiment.groupItems[0].groupItemId;

    for (const groupItem of experiment.groupItems) {
      cumulative += groupItem.ratio;
      if (normalized < cumulative) {
        selectedGroupItemId = groupItem.groupItemId;
        break;
      }
    }

    // 唯一键串行化同一用户的分配；保留有效分组，修复已删除的分组。
    const [assignment] = await this.prisma.$queryRaw<
      Array<{ groupItemId: string }>
    >`
      INSERT INTO "user_experiment_assignments" AS assignment
        ("id", "userId", "experimentId", "groupItemId", "assignedAt")
      SELECT ${cuid()}, ${userId}, ${experiment.experimentId}, ${selectedGroupItemId}, NOW()
      WHERE EXISTS (
        SELECT 1 FROM "experiment_group_items"
        WHERE "id" = ${selectedGroupItemId}
          AND "experimentId" = ${experiment.experimentId}
      )
      ON CONFLICT ("userId", "experimentId") DO UPDATE
      SET "groupItemId" = CASE WHEN EXISTS (
        SELECT 1 FROM "experiment_group_items" AS current_group
        WHERE current_group."id" = assignment."groupItemId"
          AND current_group."experimentId" = assignment."experimentId"
      ) THEN assignment."groupItemId" ELSE EXCLUDED."groupItemId" END
      RETURNING "groupItemId"
    `;
    if (!assignment) return null;

    // 缓存到 Redis
    await this.cacheService.setUserExperimentGroup(
      userId,
      experiment.experimentId,
      assignment.groupItemId,
    );

    return assignment.groupItemId;
  }

  /**
   * 获取所有活跃实验
   */
  getActiveExperiments(): ExperimentConfig[] {
    return Array.from(this.activeExperiments.values());
  }

  /**
   * 获取用户当前参与的所有活动实验
   */
  async getUserExperiments(userId: string): Promise<
    {
      experimentId: string;
      experimentName: string;
      groupItemId: string;
      groupItemName: string;
    }[]
  > {
    await this.refreshActiveExperiments();
    const activeExperiments = this.activeExperiments;
    const assignments = await this.prisma.userExperimentAssignment.findMany({
      where: { userId },
    });

    const results: {
      experimentId: string;
      experimentName: string;
      groupItemId: string;
      groupItemName: string;
    }[] = [];

    for (const assignment of assignments) {
      const experiment = activeExperiments.get(assignment.experimentId);
      if (!experiment) continue;

      const groupItem = experiment.groupItems.find(
        (g) => g.groupItemId === assignment.groupItemId,
      );
      if (!groupItem) continue;

      results.push({
        experimentId: experiment.experimentId,
        experimentName: experiment.name,
        groupItemId: groupItem.groupItemId,
        groupItemName: groupItem.name,
      });
    }

    return results;
  }

  // ==================== 辅助方法 ====================

  /**
   * 合并权重配置
   */
  private mergeWeights(
    partialWeights: Partial<RecommendationWeights>,
    referenceWeights: RecommendationWeights = this.getDefaultWeights(),
  ): RecommendationWeights {
    return {
      preferenceMatch:
        partialWeights?.preferenceMatch ?? referenceWeights.preferenceMatch,
      favoriteSimilarity:
        partialWeights?.favoriteSimilarity ??
        referenceWeights.favoriteSimilarity,
      browseRelevance:
        partialWeights?.browseRelevance ?? referenceWeights.browseRelevance,
      dishQuality: partialWeights?.dishQuality ?? referenceWeights.dishQuality,
      diversity: partialWeights?.diversity ?? referenceWeights.diversity,
      searchRelevance:
        partialWeights?.searchRelevance ?? referenceWeights.searchRelevance,
    };
  }

  /**
   * 获取默认权重
   */
  getDefaultWeights(): RecommendationWeights {
    return {
      preferenceMatch: RECOMMENDATION_WEIGHTS.PREFERENCE_MATCH,
      favoriteSimilarity: RECOMMENDATION_WEIGHTS.FAVORITE_SIMILARITY,
      browseRelevance: RECOMMENDATION_WEIGHTS.BROWSE_RELEVANCE,
      dishQuality: RECOMMENDATION_WEIGHTS.DISH_QUALITY,
      diversity: RECOMMENDATION_WEIGHTS.DIVERSITY,
      searchRelevance: RECOMMENDATION_WEIGHTS.SEARCH_RELEVANCE,
    };
  }
}
