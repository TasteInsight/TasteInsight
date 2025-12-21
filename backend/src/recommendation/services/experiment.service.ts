import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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
  // 内存中缓存的活跃实验列表
  private activeExperiments: Map<string, ExperimentConfig> = new Map();
  // 防抖动定时器
  private refreshTimer: NodeJS.Timeout | null = null;
  // 是否正在刷新
  private isRefreshing = false;
  // 是否有待处理的刷新请求
  private pendingRefresh = false;

  constructor(
    private prisma: PrismaService,
    private cacheService: RecommendationCacheService,
  ) {}

  async onModuleInit() {
    // 启动时立即加载活跃实验
    await this.performRefresh();
  }

  /**
   * 刷新活跃实验列表（防抖）
   * 短时间内多次调用只会执行一次刷新
   */
  async refreshActiveExperiments(): Promise<void> {
    // 清除之前的定时器
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // 设置防抖动，500ms 内多次调用只执行一次
    return new Promise((resolve) => {
      this.refreshTimer = setTimeout(() => {
        void (async () => {
          await this.performRefresh();
          resolve();
        })();
      }, 500);
    });
  }

  /**
   * 立即刷新活跃实验列表
   * 仅在启动时或需要立即刷新时使用
   */
  private async performRefresh(): Promise<void> {
    if (this.isRefreshing) {
      // 如果正在刷新，标记有待处理的刷新请求
      this.logger.debug('Refresh already in progress, marking pending refresh');
      this.pendingRefresh = true;
      return;
    }

    // 开始刷新循环，直到没有待处理的请求
    do {
      this.pendingRefresh = false;
      this.isRefreshing = true;

      try {
        await this.doRefresh();
      } catch (error) {
        this.logger.error('Failed to refresh active experiments', error);
      } finally {
        this.isRefreshing = false;
      }

      // 如果刷新期间又有新的请求，继续刷新
      if (this.pendingRefresh) {
        this.logger.debug('Pending refresh detected, refreshing again');
      }
    } while (this.pendingRefresh);
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

    this.activeExperiments.clear();

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
            weights: dbConfig?.weights as
              | Partial<RecommendationWeights>
              | undefined,
            recallQuota: dbConfig?.recallQuota,
          };
        }),
      };

      this.activeExperiments.set(exp.id, config);
    }

    this.logger.log(`Loaded ${this.activeExperiments.size} active experiments`);
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
    // 如果没有活跃实验，返回空
    if (this.activeExperiments.size === 0) {
      return null;
    }

    // 遍历活跃实验，找到用户应该参与的实验
    for (const [experimentId, experiment] of this.activeExperiments) {
      // 检查用户是否应该参与这个实验（根据流量比例）
      const shouldParticipate = this.shouldUserParticipate(userId, experiment);

      if (!shouldParticipate) {
        continue;
      }

      // 检查用户是否已经被分配过
      let groupItemId = await this.cacheService.getUserExperimentGroup(
        userId,
        experimentId,
      );

      if (!groupItemId) {
        // 从数据库检查
        const assignment =
          await this.prisma.userExperimentAssignment.findUnique({
            where: {
              userId_experimentId: {
                userId,
                experimentId,
              },
            },
          });

        if (assignment) {
          groupItemId = assignment.groupItemId;
          // 缓存到 Redis
          await this.cacheService.setUserExperimentGroup(
            userId,
            experimentId,
            groupItemId,
          );
        } else {
          // 新用户，需要分配组
          groupItemId = await this.assignUserToGroupItem(userId, experiment);
        }
      }

      // 获取分组配置
      const groupItem = experiment.groupItems.find(
        (g) => g.groupItemId === groupItemId,
      );

      if (!groupItem) {
        continue;
      }

      // 获取权重配置
      let weights =
        await this.cacheService.getExperimentGroupItemWeights(groupItemId);

      if (!weights && groupItem.weights) {
        // 合并默认权重和实验权重
        weights = this.mergeWeights(groupItem.weights);
        await this.cacheService.setExperimentGroupItemWeights(
          groupItemId,
          weights,
        );
      }

      return {
        groupItemId: groupItem.groupItemId,
        name: groupItem.name,
        ratio: groupItem.ratio,
        weights: groupItem.weights,
        recallQuota: groupItem.recallQuota, // 明确返回召回配额
        experimentId,
        resolvedWeights: weights || this.getDefaultWeights(),
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
  ): Promise<string> {
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

    // 持久化分配结果
    await this.prisma.userExperimentAssignment.create({
      data: {
        userId,
        experimentId: experiment.experimentId,
        groupItemId: selectedGroupItemId,
      },
    });

    // 缓存到 Redis
    await this.cacheService.setUserExperimentGroup(
      userId,
      experiment.experimentId,
      selectedGroupItemId,
    );

    return selectedGroupItemId;
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
      const experiment = this.activeExperiments.get(assignment.experimentId);
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
