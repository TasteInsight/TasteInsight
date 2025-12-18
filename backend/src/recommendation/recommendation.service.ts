import { Injectable, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  RECOMMENDATION_WEIGHTS,
  SEARCH_SCENE_WEIGHTS,
  RECOMMENDATION_LIMITS,
  RecommendationScene,
  RecommendationEventType,
} from './constants/recommendation.constants';
import {
  UserFeatures,
  UserPreferenceFeatures,
  FavoriteFeatureSummary,
  BrowseFeatureSummary,
  ScoredDish,
  ScoreBreakdown,
  RecommendationContext,
  RecommendationWeights,
  RecommendationEvent,
  SearchContext,
  ExperimentAssignment,
} from './interfaces';
import {
  RecommendationFilterDto,
  RecommendationSearchDto,
  RecommendationRequestDto,
} from './dto/recommendation-request.dto';
import {
  RecommendationResultDto,
  RecommendedDishItemDto,
} from './dto/recommendation-result.dto';
import { RecommendationCacheService } from './services/cache.service';
import { EventLoggerService } from './services/event-logger.service';
import { ExperimentService } from './services/experiment.service';
import { EmbeddingService } from './services/embedding.service';
import { TokenizerService } from './services/tokenizer.service';

/**
 * 推荐系统核心服务
 *
 * 📋 目录：
 * 1. 主推荐入口 - 核心公共 API
 * 2. 推荐流程子方法 - 推荐流程核心逻辑
 * 3. 用户特征管理 - 用户特征获取与缓存
 * 4. 特征提取方法 - 收藏、浏览特征提取
 * 5. 筛选条件构建 - 过滤条件构建
 * 6. 评分计算方法 - 多维度评分算法
 * 7. 事件追踪 API - 点击、收藏、评价事件
 * 8. 相似菜品推荐 - 相似推荐算法
 * 9. 嵌入向量推荐 - 基于向量的推荐
 * 10. A/B 测试相关 - 实验分组管理
 * 11. 菜品缓存管理 - 缓存失效与刷新
 * 12. 系统健康状态 - 健康检查接口
 * 13. 辅助方法 - 工具函数
 *
 * 推荐流程：
 * 请求接收 -> 实验分组 -> 缓存检查 -> 用户特征获取 -> 候选召回 -> 排序打分 -> 缓存结果 -> 事件记录 -> 返回
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private cacheService?: RecommendationCacheService,
    @Optional() private eventLogger?: EventLoggerService,
    @Optional() private experimentService?: ExperimentService,
    @Optional() private embeddingService?: EmbeddingService,
    @Optional() private tokenizerService?: TokenizerService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // 📍 主推荐入口 - 核心公共 API
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 统一推荐菜品方法 - 主入口
   *
   * 支持多种场景：首页推荐、搜索推荐、相似推荐、猜你喜欢、今日推荐
   */
  async getRecommendations(
    userId: string,
    dto: RecommendationRequestDto,
  ): Promise<RecommendationResultDto> {
    const requestId = uuidv4();
    const startTime = Date.now();
    const hasSearchKeyword = !!dto.search?.keyword?.trim();

    // 1. 确定推荐场景
    const scene = this.determineScene(dto, hasSearchKeyword);

    // 2. 构建推荐上下文
    const context: RecommendationContext = {
      userId,
      scene,
      requestId,
      triggerDishId: dto.triggerDishId,
    };

    this.logger.debug(
      `[${requestId}] Starting recommendation for user ${userId}, scene: ${scene}`,
    );

    try {
      // 3. A/B 测试分组
      const experimentAssignment = await this.resolveExperimentAssignment(
        userId,
        dto.experimentId,
        context,
      );
      context.groupItemId = experimentAssignment?.groupItemId;

      // 4. 尝试从缓存获取结果
      const cachedResult = await this.tryGetCachedResult(
        userId,
        scene,
        dto,
        experimentAssignment,
        requestId,
      );
      if (cachedResult) {
        this.logger.debug(`[${requestId}] Cache hit, returning cached result`);
        return cachedResult;
      }

      // 5. 获取用户特征
      const userFeatures = await this.getUserFeaturesWithCache(userId);

      // 6. 确保用户嵌入向量存在（异步，不阻塞）
      this.ensureUserEmbeddingAsync(userId, userFeatures);

      // 7. 获取推荐权重
      const weights = this.resolveWeights(
        scene,
        hasSearchKeyword,
        experimentAssignment,
      );

      // 8. 构建搜索上下文
      const searchContext = this.buildSearchContext(dto.search);

      // 9. 执行推荐核心逻辑
      const result = await this.executeRecommendation(
        userId,
        dto,
        context,
        userFeatures,
        weights,
        searchContext,
        experimentAssignment,
        startTime,
      );

      // 10. 缓存推荐结果
      await this.cacheRecommendationResult(
        userId,
        scene,
        dto,
        experimentAssignment,
        result,
      );

      // 11. 记录曝光事件
      await this.logImpressionEvents(userId, result, context, dto.experimentId);

      return result;
    } catch (error) {
      this.logger.error(
        `[${requestId}] Recommendation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 推荐流程子方法 - 推荐流程核心逻辑
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 确定推荐场景
   */
  private determineScene(
    dto: RecommendationRequestDto,
    hasSearchKeyword: boolean,
  ): RecommendationScene {
    if (hasSearchKeyword) {
      return RecommendationScene.SEARCH;
    }
    if (dto.triggerDishId) {
      return RecommendationScene.SIMILAR;
    }
    return dto.scene || RecommendationScene.HOME;
  }

  /**
   * 解析 A/B 实验分组
   */
  private async resolveExperimentAssignment(
    userId: string,
    experimentId: string | undefined,
    context: RecommendationContext,
  ): Promise<ExperimentAssignment | null> {
    if (!experimentId || !this.experimentService) {
      return null;
    }

    try {
      return await this.experimentService.assignUserToExperiment(
        userId,
        context,
      );
    } catch (error) {
      this.logger.warn(`Failed to assign experiment: ${error.message}`);
      return null;
    }
  }

  /**
   * 尝试从缓存获取推荐结果
   *
   * 缓存策略：
   * - 如果有用户上下文信息（如实时位置、时间偏好等），需要将其纳入缓存键
   * - 实验分组也会影响缓存键
   */
  private async tryGetCachedResult(
    userId: string,
    scene: RecommendationScene,
    dto: RecommendationRequestDto,
    experimentAssignment: ExperimentAssignment | null,
    requestId: string,
  ): Promise<RecommendationResultDto | null> {
    if (!this.cacheService) {
      return null;
    }

    // 如果有动态用户上下文（如实时位置等），跳过缓存
    // 因为这些上下文可能会影响推荐结果
    if (dto.userContext && this.hasVolatileContext(dto.userContext)) {
      return null;
    }

    const cached = await this.cacheService.getRecommendationResult(
      userId,
      scene,
      dto,
      experimentAssignment?.groupItemId,
    );

    if (cached) {
      // 记录缓存命中的曝光事件
      if (this.eventLogger) {
        await this.eventLogger.logImpressions(
          userId,
          cached.data.items.map((item: RecommendedDishItemDto) => item.id),
          {
            scene,
            requestId,
            experimentId: dto.experimentId,
            groupItemId: experimentAssignment?.groupItemId,
          },
        );
      }
      return cached;
    }

    return null;
  }

  /**
   * 判断用户上下文是否包含易变信息（不应缓存）
   */
  private hasVolatileContext(userContext: Record<string, any>): boolean {
    const volatileKeys = ['realTimeLocation', 'currentTime', 'weatherInfo'];
    return volatileKeys.some((key) => userContext[key] !== undefined);
  }

  /**
   * 根据用户上下文调整推荐权重
   *
   * 支持的上下文字段：
   * - mealTimePreference: 用餐时间偏好，影响时间相关权重
   * - exploratory: 探索模式，增加多样性权重
   * - urgency: 紧急程度，减少多样性，增加质量权重
   */
  private applyUserContextToWeights(
    baseWeights: RecommendationWeights,
    userContext?: Record<string, any>,
  ): RecommendationWeights {
    if (!userContext) {
      return baseWeights;
    }

    const weights = { ...baseWeights };

    // 探索模式：增加多样性权重
    if (userContext.exploratory === true) {
      weights.diversity = Math.min(weights.diversity * 1.5, 30);
      weights.favoriteSimilarity = Math.max(
        weights.favoriteSimilarity * 0.7,
        5,
      );
    }

    // 紧急模式：减少多样性，增加质量权重
    if (userContext.urgency === 'high') {
      weights.diversity = Math.max(weights.diversity * 0.5, 2);
      weights.dishQuality = Math.min(weights.dishQuality * 1.3, 30);
    }

    // 用餐时间偏好：可以在这里添加时间相关的权重调整
    // 例如：早餐时段可能更偏好清淡口味等

    return weights;
  }

  /**
   * 解析推荐权重
   */
  private resolveWeights(
    scene: RecommendationScene,
    hasSearch: boolean,
    experimentAssignment: ExperimentAssignment | null,
  ): RecommendationWeights {
    // 优先使用实验分组的权重配置
    if (experimentAssignment?.resolvedWeights) {
      return experimentAssignment.resolvedWeights;
    }

    // 搜索场景使用特殊权重
    if (hasSearch || scene === RecommendationScene.SEARCH) {
      return {
        preferenceMatch: SEARCH_SCENE_WEIGHTS.PREFERENCE_MATCH,
        favoriteSimilarity: SEARCH_SCENE_WEIGHTS.FAVORITE_SIMILARITY,
        browseRelevance: SEARCH_SCENE_WEIGHTS.BROWSE_RELEVANCE,
        dishQuality: SEARCH_SCENE_WEIGHTS.DISH_QUALITY,
        diversity: SEARCH_SCENE_WEIGHTS.DIVERSITY,
        searchRelevance: SEARCH_SCENE_WEIGHTS.SEARCH_RELEVANCE,
      };
    }

    // 默认权重
    return {
      preferenceMatch: RECOMMENDATION_WEIGHTS.PREFERENCE_MATCH,
      favoriteSimilarity: RECOMMENDATION_WEIGHTS.FAVORITE_SIMILARITY,
      browseRelevance: RECOMMENDATION_WEIGHTS.BROWSE_RELEVANCE,
      dishQuality: RECOMMENDATION_WEIGHTS.DISH_QUALITY,
      diversity: RECOMMENDATION_WEIGHTS.DIVERSITY,
      searchRelevance: RECOMMENDATION_WEIGHTS.SEARCH_RELEVANCE,
    };
  }

  /**
   * 构建搜索上下文
   */
  private buildSearchContext(
    search?: RecommendationSearchDto,
  ): SearchContext | null {
    if (!search?.keyword?.trim()) {
      return null;
    }

    const keyword = search.keyword.trim();
    const fields = search.fields || ['name', 'description', 'tags'];
    const normalizedKeywords = this.tokenizerService?.tokenize(keyword) || [];

    return {
      keyword,
      fields,
      normalizedKeywords,
    };
  }

  /**
   * 执行推荐核心逻辑
   */
  private async executeRecommendation(
    userId: string,
    dto: RecommendationRequestDto,
    context: RecommendationContext,
    userFeatures: UserFeatures,
    weights: RecommendationWeights,
    searchContext: SearchContext | null,
    experimentAssignment: ExperimentAssignment | null,
    startTime: number,
  ): Promise<RecommendationResultDto> {
    // 0. 根据用户上下文调整权重或筛选条件
    const adjustedWeights = this.applyUserContextToWeights(
      weights,
      dto.userContext,
    );

    // 1. 构建筛选条件
    const filterConditions = this.buildFilterConditions(
      dto.filter,
      userFeatures.allergens,
      dto.search,
      dto.userContext,
    );

    // 2. 召回候选菜品
    const candidateDishes = await this.recallCandidates(
      dto.pagination.pageSize,
      filterConditions,
      context,
    );

    // 3. 计算推荐分数
    const scoredDishes = await this.scoreCandidates(
      candidateDishes,
      userFeatures,
      adjustedWeights,
      searchContext,
      context,
      dto.includeScoreBreakdown,
    );

    // 4. 排序
    scoredDishes.sort((a, b) => b.score - a.score);

    // 5. 分页
    const { page, pageSize } = dto.pagination;
    const skip = (page - 1) * pageSize;
    const paginatedDishes = scoredDishes.slice(skip, skip + pageSize);
    const total = scoredDishes.length;
    const totalPages = Math.ceil(total / pageSize);

    const processingTime = Date.now() - startTime;

    // 6. 构建响应
    return this.buildRecommendationResult(
      paginatedDishes,
      page,
      pageSize,
      total,
      totalPages,
      context.requestId!,
      experimentAssignment,
      dto.includeScoreBreakdown,
      {
        processingTimeMs: processingTime,
        candidateCount: candidateDishes.length,
        scene: context.scene,
        hasSearch: !!searchContext,
        weightsUsed: adjustedWeights,
      },
    );
  }

  /**
   * 召回候选菜品
   */
  private async recallCandidates(
    pageSize: number,
    filterConditions: Prisma.DishWhereInput[],
    context: RecommendationContext,
  ): Promise<any[]> {
    const candidateLimit = Math.max(
      pageSize * RECOMMENDATION_LIMITS.CANDIDATE_MULTIPLIER,
      RECOMMENDATION_LIMITS.MIN_CANDIDATES,
    );

    // 相似推荐场景：优先获取与触发菜品相似的候选
    if (
      context.scene === RecommendationScene.SIMILAR &&
      context.triggerDishId
    ) {
      return this.recallSimilarCandidates(
        context.triggerDishId,
        candidateLimit,
        filterConditions,
      );
    }

    // 通用召回
    return this.prisma.dish.findMany({
      where:
        filterConditions.length > 0
          ? { AND: filterConditions }
          : { status: 'online' },
      include: {
        canteen: true,
        window: true,
      },
      take: candidateLimit,
    });
  }

  /**
   * 召回相似菜品候选
   */
  private async recallSimilarCandidates(
    triggerDishId: string,
    limit: number,
    filterConditions: Prisma.DishWhereInput[],
  ): Promise<any[]> {
    const triggerDish = await this.prisma.dish.findUnique({
      where: { id: triggerDishId },
      include: { canteen: true, window: true },
    });

    if (!triggerDish) {
      // 回退到通用召回
      return this.prisma.dish.findMany({
        where:
          filterConditions.length > 0
            ? { AND: filterConditions }
            : { status: 'online' },
        include: { canteen: true, window: true },
        take: limit,
      });
    }

    // 基于标签和食堂的相似召回
    const conditions: Prisma.DishWhereInput[] = [
      { id: { not: triggerDishId } },
      { status: 'online' },
      ...filterConditions,
    ];

    // 优先同食堂或相同标签的菜品
    if (triggerDish.tags && triggerDish.tags.length > 0) {
      conditions.push({
        OR: [
          { canteenId: triggerDish.canteenId },
          { tags: { hasSome: triggerDish.tags } },
        ],
      });
    }

    return this.prisma.dish.findMany({
      where: { AND: conditions },
      include: { canteen: true, window: true },
      take: limit,
    });
  }

  /**
   * 计算候选菜品的推荐分数
   */
  private async scoreCandidates(
    candidateDishes: any[],
    userFeatures: UserFeatures,
    weights: RecommendationWeights,
    searchContext: SearchContext | null,
    context: RecommendationContext,
    includeBreakdown: boolean = false,
  ): Promise<ScoredDish[]> {
    // 如果启用了嵌入服务且有用户嵌入，使用向量相似度增强
    let embeddingSimilarities: Map<string, number> | null = null;

    if (this.embeddingService && this.embeddingService.isEnabled()) {
      const dishIds = candidateDishes.map((d) => d.id);
      try {
        embeddingSimilarities =
          await this.embeddingService.calculateUserDishSimilarities(
            context.userId,
            dishIds,
          );
      } catch (error) {
        this.logger.warn(`Failed to calculate embeddings: ${error.message}`);
      }
    }

    // 计算每个菜品的分数
    return candidateDishes.map((dish) => {
      const breakdown = this.calculateScoreBreakdown(
        dish,
        userFeatures,
        searchContext,
        embeddingSimilarities?.get(dish.id),
      );

      // 归一化权重
      const totalWeight =
        weights.preferenceMatch +
        weights.favoriteSimilarity +
        weights.browseRelevance +
        weights.dishQuality +
        weights.diversity +
        weights.searchRelevance;

      // 计算加权总分
      const score =
        (breakdown.preferenceScore * weights.preferenceMatch +
          breakdown.favoriteScore * weights.favoriteSimilarity +
          breakdown.browseScore * weights.browseRelevance +
          breakdown.qualityScore * weights.dishQuality +
          breakdown.diversityScore * weights.diversity +
          breakdown.searchScore * weights.searchRelevance) /
        totalWeight;

      return {
        dish,
        score,
        scoreBreakdown: includeBreakdown ? breakdown : undefined,
      };
    });
  }

  /**
   * 计算分数明细
   */
  private calculateScoreBreakdown(
    dish: any,
    userFeatures: UserFeatures,
    searchContext: SearchContext | null,
    embeddingSimilarity?: number,
  ): ScoreBreakdown {
    // 基础偏好分数
    let preferenceScore = this.calculatePreferenceScore(
      dish,
      userFeatures.preferences,
    );

    // 如果有嵌入相似度，将其融入偏好分数（30%权重）
    if (embeddingSimilarity !== undefined && embeddingSimilarity > 0) {
      preferenceScore = preferenceScore * 0.7 + embeddingSimilarity * 0.3;
    }

    return {
      preferenceScore,
      favoriteScore: this.calculateFavoriteScore(
        dish,
        userFeatures.favoriteFeatures,
      ),
      browseScore: this.calculateBrowseScore(dish, userFeatures.browseFeatures),
      qualityScore: this.calculateQualityScore(dish),
      diversityScore: this.calculateDiversityScore(
        dish,
        userFeatures.favoriteFeatures,
        userFeatures.browseFeatures,
      ),
      searchScore: this.calculateSearchScore(dish, searchContext),
    };
  }

  /**
   * 构建推荐结果响应
   */
  private buildRecommendationResult(
    paginatedDishes: ScoredDish[],
    page: number,
    pageSize: number,
    total: number,
    totalPages: number,
    requestId: string,
    experimentAssignment: ExperimentAssignment | null,
    includeScoreBreakdown: boolean = false,
    debugInfo?: {
      processingTimeMs: number;
      candidateCount: number;
      scene: string;
      hasSearch: boolean;
      weightsUsed: RecommendationWeights;
    },
  ): RecommendationResultDto {
    return {
      code: 200,
      message: 'success',
      data: {
        items: paginatedDishes.map((item) =>
          this.mapToRecommendedDishItem(item, includeScoreBreakdown),
        ),
        meta: {
          page,
          pageSize,
          total,
          totalPages,
        },
        requestId,
        groupItemId: experimentAssignment?.groupItemId,
        debug: includeScoreBreakdown ? debugInfo : undefined,
      },
    };
  }

  /**
   * 缓存推荐结果
   */
  private async cacheRecommendationResult(
    userId: string,
    scene: RecommendationScene,
    dto: RecommendationRequestDto,
    experimentAssignment: ExperimentAssignment | null,
    result: RecommendationResultDto,
  ): Promise<void> {
    if (!this.cacheService) {
      return;
    }

    // 如果有动态用户上下文，不缓存
    if (dto.userContext && this.hasVolatileContext(dto.userContext)) {
      return;
    }

    await this.cacheService.setRecommendationResult(
      userId,
      scene,
      dto,
      experimentAssignment?.groupItemId,
      result,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 用户特征管理 - 用户特征获取与缓存
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 获取用户特征（优先从缓存获取）
   */
  async getUserFeaturesWithCache(userId: string): Promise<UserFeatures> {
    // 尝试从缓存获取
    if (this.cacheService) {
      const cachedFeatures = await this.cacheService.getUserFeatures(userId);
      if (cachedFeatures) {
        this.logger.debug(`User features cache hit for ${userId}`);
        return cachedFeatures;
      }
    }

    // 从数据库获取
    const features = await this.getUserFeatures(userId);

    // 缓存用户特征
    if (this.cacheService) {
      await this.cacheService.setUserFeatures(userId, features);
    }

    return features;
  }

  /**
   * 从数据库获取用户特征
   */
  async getUserFeatures(userId: string): Promise<UserFeatures> {
    // 并行获取用户数据
    const [userPreferences, favoriteDishRecords, browseHistoryRecords, user] =
      await Promise.all([
        this.prisma.userPreference.findUnique({
          where: { userId },
        }),
        this.prisma.favoriteDish.findMany({
          where: { userId },
          orderBy: { addedAt: 'desc' },
          take: RECOMMENDATION_LIMITS.MAX_FAVORITES,
        }),
        this.prisma.browseHistory.findMany({
          where: { userId },
          orderBy: { viewedAt: 'desc' },
          take: RECOMMENDATION_LIMITS.MAX_BROWSE_HISTORY,
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { allergens: true },
        }),
      ]);

    // 获取收藏和浏览历史关联的菜品
    const favoriteDishIds = favoriteDishRecords.map((f) => f.dishId);
    const browseHistoryDishIds = browseHistoryRecords.map((b) => b.dishId);
    const allRelatedDishIds = [
      ...new Set([...favoriteDishIds, ...browseHistoryDishIds]),
    ];

    const relatedDishes =
      allRelatedDishIds.length > 0
        ? await this.prisma.dish.findMany({
            where: { id: { in: allRelatedDishIds } },
          })
        : [];

    const dishMap = new Map(relatedDishes.map((d) => [d.id, d]));

    // 提取收藏特征
    const favoriteFeatures = this.extractFavoriteFeatures(
      favoriteDishRecords,
      dishMap,
    );

    // 提取浏览特征
    const browseFeatures = this.extractBrowseFeatures(
      browseHistoryRecords,
      dishMap,
    );

    // 映射用户偏好
    const preferences: UserPreferenceFeatures | null = userPreferences
      ? {
          tagPreferences: userPreferences.tagPreferences || [],
          priceMin: userPreferences.priceMin || 0,
          priceMax: userPreferences.priceMax || 50,
          meatPreference: userPreferences.meatPreference || [],
          avoidIngredients: userPreferences.avoidIngredients || [],
          favoriteIngredients: userPreferences.favoriteIngredients || [],
          spicyLevel: userPreferences.spicyLevel || 0,
          sweetness: userPreferences.sweetness || 0,
          saltiness: userPreferences.saltiness || 0,
          oiliness: userPreferences.oiliness || 0,
          canteenPreferences: userPreferences.canteenPreferences || [],
          portionSize:
            (userPreferences.portionSize as 'small' | 'medium' | 'large') ||
            'medium',
        }
      : null;

    return {
      userId,
      preferences,
      favoriteFeatures,
      browseFeatures,
      allergens: user?.allergens || [],
    };
  }

  /**
   * 更新用户特征缓存（当用户行为发生变化时调用）
   */
  async refreshUserFeatureCache(userId: string): Promise<void> {
    if (!this.cacheService) {
      return;
    }

    // 使缓存失效
    await Promise.all([
      this.cacheService.invalidateUserFeatures(userId),
      this.cacheService.invalidateUserRecommendations(userId),
    ]);

    // 使用户嵌入失效（如果有）
    if (this.embeddingService) {
      await this.embeddingService.invalidateUserEmbedding(userId);
    }

    // 预热新缓存
    const features = await this.getUserFeatures(userId);
    await this.cacheService.setUserFeatures(userId, features);

    // 异步更新用户嵌入
    this.ensureUserEmbeddingAsync(userId, features);

    this.logger.debug(`User feature cache refreshed for ${userId}`);
  }

  /**
   * 异步确保用户嵌入存在
   */
  private ensureUserEmbeddingAsync(
    userId: string,
    userFeatures: UserFeatures,
  ): void {
    if (!this.embeddingService) {
      return;
    }

    this.embeddingService
      .getUserEmbedding(userId)
      .then((existing) => {
        if (!existing) {
          return this.embeddingService!.generateUserEmbedding(
            userId,
            userFeatures,
          );
        }
        return existing;
      })
      .catch((err) =>
        this.logger.warn(`Failed to ensure user embedding: ${err.message}`),
      );
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 特征提取方法 - 收藏、浏览特征提取
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 提取收藏菜品特征
   */
  private extractFavoriteFeatures(
    favoriteDishRecords: any[],
    dishMap: Map<string, any>,
  ): FavoriteFeatureSummary {
    const tagWeights = new Map<string, number>();
    const canteenIds = new Set<string>();
    const ingredients = new Set<string>();
    const dishIds = new Set<string>();
    let totalSpicy = 0;
    let totalSweet = 0;
    let totalSalty = 0;
    let totalOily = 0;
    let totalPrice = 0;
    let validCount = 0;

    favoriteDishRecords.forEach((fav) => {
      const dish = dishMap.get(fav.dishId);
      if (dish) {
        dishIds.add(dish.id);
        dish.tags?.forEach((tag: string) => {
          tagWeights.set(tag, (tagWeights.get(tag) || 0) + 1);
        });
        canteenIds.add(dish.canteenId);
        dish.ingredients?.forEach((ing: string) => ingredients.add(ing));
        totalSpicy += dish.spicyLevel || 0;
        totalSweet += dish.sweetness || 0;
        totalSalty += dish.saltiness || 0;
        totalOily += dish.oiliness || 0;
        totalPrice += dish.price || 0;
        validCount++;
      }
    });

    return {
      tagWeights,
      canteenIds,
      ingredients,
      avgSpicyLevel: validCount > 0 ? totalSpicy / validCount : 0,
      avgSweetness: validCount > 0 ? totalSweet / validCount : 0,
      avgSaltiness: validCount > 0 ? totalSalty / validCount : 0,
      avgOiliness: validCount > 0 ? totalOily / validCount : 0,
      avgPrice: validCount > 0 ? totalPrice / validCount : 0,
      dishIds,
    };
  }

  /**
   * 提取浏览历史特征
   */
  private extractBrowseFeatures(
    browseHistoryRecords: any[],
    dishMap: Map<string, any>,
  ): BrowseFeatureSummary {
    const tagWeights = new Map<string, number>();
    const canteenWeights = new Map<string, number>();
    const recentDishIds = new Set<string>();

    browseHistoryRecords.forEach((history, index) => {
      const dish = dishMap.get(history.dishId);
      // 时间衰减权重：最近的浏览权重更高
      const timeWeight = 1 / (1 + index * 0.1);

      if (dish) {
        if (index < RECOMMENDATION_LIMITS.RECENT_BROWSE_COUNT) {
          recentDishIds.add(dish.id);
        }
        dish.tags?.forEach((tag: string) => {
          tagWeights.set(tag, (tagWeights.get(tag) || 0) + timeWeight);
        });
        canteenWeights.set(
          dish.canteenId,
          (canteenWeights.get(dish.canteenId) || 0) + timeWeight,
        );
      }
    });

    return {
      tagWeights,
      canteenWeights,
      recentDishIds,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 筛选条件构建 - 过滤条件构建
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 构建筛选条件
   *
   * @param filter 显式筛选条件
   * @param allergens 用户过敏原（自动排除）
   * @param search 搜索条件
   * @param userContext 用户上下文（可能包含位置、时间等动态条件）
   */
  private buildFilterConditions(
    filter: RecommendationFilterDto,
    allergens?: string[],
    search?: RecommendationSearchDto,
    userContext?: Record<string, any>,
  ): Prisma.DishWhereInput[] {
    const conditions: Prisma.DishWhereInput[] = [];

    // 状态筛选：默认只显示 online 的菜品
    if (!filter.includeOffline) {
      conditions.push({ status: 'online' });
    }

    // 过敏原排除（安全优先）
    if (allergens && allergens.length > 0) {
      conditions.push({
        NOT: {
          allergens: {
            hasSome: allergens,
          },
        },
      });
    }

    // 评分筛选
    if (filter.rating) {
      conditions.push({
        averageRating: {
          gte: filter.rating.min,
          lte: filter.rating.max,
        },
      });
    }

    // 供应时间筛选
    if (filter.mealTime && filter.mealTime.length > 0) {
      conditions.push({
        availableMealTime: {
          hasSome: filter.mealTime,
        },
      });
    }

    // 价格筛选
    if (filter.price) {
      conditions.push({
        price: {
          gte: filter.price.min,
          lte: filter.price.max,
        },
      });
    }

    // 标签筛选
    if (filter.tag && filter.tag.length > 0) {
      conditions.push({
        tags: {
          hasSome: filter.tag,
        },
      });
    }

    // 食堂筛选
    if (filter.canteenId && filter.canteenId.length > 0) {
      conditions.push({
        canteenId: {
          in: filter.canteenId,
        },
      });
    }

    // 辣度筛选
    if (filter.spicyLevel) {
      conditions.push({
        OR: [
          { spicyLevel: 0 },
          {
            spicyLevel: {
              gte: filter.spicyLevel.min,
              lte: filter.spicyLevel.max,
            },
          },
        ],
      });
    }

    // 肉类偏好筛选
    if (filter.meatPreference && filter.meatPreference.length > 0) {
      conditions.push({
        ingredients: {
          hasSome: filter.meatPreference,
        },
      });
    }

    // 避免食材筛选
    if (filter.avoidIngredients && filter.avoidIngredients.length > 0) {
      conditions.push({
        NOT: {
          ingredients: {
            hasSome: filter.avoidIngredients,
          },
        },
      });
    }

    // 喜欢食材筛选
    if (filter.favoriteIngredients && filter.favoriteIngredients.length > 0) {
      conditions.push({
        ingredients: {
          hasSome: filter.favoriteIngredients,
        },
      });
    }

    // 甜度筛选
    if (filter.sweetness) {
      conditions.push({
        OR: [
          { sweetness: 0 },
          {
            sweetness: {
              gte: filter.sweetness.min,
              lte: filter.sweetness.max,
            },
          },
        ],
      });
    }

    // 咸度筛选
    if (filter.saltiness) {
      conditions.push({
        OR: [
          { saltiness: 0 },
          {
            saltiness: {
              gte: filter.saltiness.min,
              lte: filter.saltiness.max,
            },
          },
        ],
      });
    }

    // 油度筛选
    if (filter.oiliness) {
      conditions.push({
        OR: [
          { oiliness: 0 },
          {
            oiliness: {
              gte: filter.oiliness.min,
              lte: filter.oiliness.max,
            },
          },
        ],
      });
    }

    // 搜索条件
    if (search?.keyword) {
      const searchFields = search.fields || ['name', 'description', 'tags'];
      const orConditions: Prisma.DishWhereInput[] = [];

      if (searchFields.includes('name')) {
        orConditions.push({
          name: { contains: search.keyword, mode: 'insensitive' },
        });
      }
      if (searchFields.includes('description')) {
        orConditions.push({
          description: { contains: search.keyword, mode: 'insensitive' },
        });
      }
      if (searchFields.includes('tags')) {
        orConditions.push({ tags: { has: search.keyword } });
      }

      if (orConditions.length > 0) {
        conditions.push({ OR: orConditions });
      }
    }

    // 用户上下文动态筛选
    if (userContext) {
      // 基于当前用餐时间自动筛选
      if (userContext.currentMealTime) {
        conditions.push({
          availableMealTime: { has: userContext.currentMealTime },
        });
      }

      // 基于指定食堂筛选
      if (userContext.preferredCanteenId) {
        conditions.push({
          canteenId: userContext.preferredCanteenId,
        });
      }

      // 基于最高价格限制
      if (userContext.maxPrice !== undefined) {
        conditions.push({
          price: { lte: userContext.maxPrice },
        });
      }
    }

    return conditions;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 评分计算方法 - 多维度评分算法
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 计算口味差异总分
   * 用于比较两组口味参数的相似度
   * @returns 0-20 之间的值，越小表示越相似
   */
  private calculateFlavorDifference(
    dish: {
      spicyLevel?: number;
      sweetness?: number;
      saltiness?: number;
      oiliness?: number;
    },
    target: {
      spicyLevel: number;
      sweetness: number;
      saltiness: number;
      oiliness: number;
    },
  ): number {
    const spicyDiff = Math.abs((dish.spicyLevel || 0) - target.spicyLevel);
    const sweetDiff = Math.abs((dish.sweetness || 0) - target.sweetness);
    const saltyDiff = Math.abs((dish.saltiness || 0) - target.saltiness);
    const oilyDiff = Math.abs((dish.oiliness || 0) - target.oiliness);
    return spicyDiff + sweetDiff + saltyDiff + oilyDiff;
  }

  /**
   * 将口味差异转换为相似度分数 (0-1)
   * 差异越小，相似度越高
   */
  private flavorDifferenceToSimilarity(diff: number): number {
    // 最大差异为 20 (4个维度 * 5级)
    return Math.max(0, 1 - diff / 20);
  }

  /**
   * 计算标签集合的 Jaccard 相似度
   */
  private calculateTagSimilarity(tags1: string[], tags2: string[]): number {
    if (!tags1?.length || !tags2?.length) {
      return 0;
    }

    const set1 = new Set(tags1);
    const set2 = new Set(tags2);
    const intersection = [...set1].filter((tag) => set2.has(tag));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.length / union.size : 0;
  }

  /**
   * 计算用户偏好匹配分数 (0-1)
   */
  private calculatePreferenceScore(
    dish: any,
    preferences: UserPreferenceFeatures | null,
  ): number {
    if (!preferences) {
      return 0.5; // 无偏好数据时返回中等分数
    }

    let matchScore = 0;
    let maxScore = 0;

    // 标签偏好匹配
    if (preferences.tagPreferences && preferences.tagPreferences.length > 0) {
      maxScore += 1;
      const matchedTags =
        dish.tags?.filter((tag: string) =>
          preferences.tagPreferences.includes(tag),
        ) || [];
      if (matchedTags.length > 0) {
        matchScore += matchedTags.length / preferences.tagPreferences.length;
      }
    }

    // 价格偏好匹配
    if (
      preferences.priceMin !== undefined &&
      preferences.priceMax !== undefined
    ) {
      maxScore += 1;
      if (
        dish.price >= preferences.priceMin &&
        dish.price <= preferences.priceMax
      ) {
        matchScore += 1;
      } else if (dish.price < preferences.priceMin) {
        matchScore += 0.5;
      }
    }

    // 口味偏好匹配（辣度）
    if (preferences.spicyLevel > 0 && dish.spicyLevel > 0) {
      maxScore += 1;
      const diff = Math.abs(dish.spicyLevel - preferences.spicyLevel);
      matchScore += Math.max(0, 1 - diff / 5);
    }

    // 口味偏好匹配（甜度）
    if (preferences.sweetness > 0 && dish.sweetness > 0) {
      maxScore += 1;
      const diff = Math.abs(dish.sweetness - preferences.sweetness);
      matchScore += Math.max(0, 1 - diff / 5);
    }

    // 口味偏好匹配（咸度）
    if (preferences.saltiness > 0 && dish.saltiness > 0) {
      maxScore += 1;
      const diff = Math.abs(dish.saltiness - preferences.saltiness);
      matchScore += Math.max(0, 1 - diff / 5);
    }

    // 口味偏好匹配（油度）
    if (preferences.oiliness > 0 && dish.oiliness > 0) {
      maxScore += 1;
      const diff = Math.abs(dish.oiliness - preferences.oiliness);
      matchScore += Math.max(0, 1 - diff / 5);
    }

    // 食堂偏好匹配
    if (
      preferences.canteenPreferences &&
      preferences.canteenPreferences.length > 0
    ) {
      maxScore += 1;
      if (preferences.canteenPreferences.includes(dish.canteenId)) {
        matchScore += 1;
      }
    }

    // 肉类偏好匹配
    if (preferences.meatPreference && preferences.meatPreference.length > 0) {
      maxScore += 1;
      const matchedMeat =
        dish.ingredients?.filter((ing: string) =>
          preferences.meatPreference.includes(ing),
        ) || [];
      if (matchedMeat.length > 0) {
        matchScore +=
          0.5 + 0.5 * (matchedMeat.length / preferences.meatPreference.length);
      }
    }

    // 喜欢的食材匹配
    if (
      preferences.favoriteIngredients &&
      preferences.favoriteIngredients.length > 0
    ) {
      maxScore += 1;
      const matchedIngredients =
        dish.ingredients?.filter((ing: string) =>
          preferences.favoriteIngredients.includes(ing),
        ) || [];
      if (matchedIngredients.length > 0) {
        matchScore +=
          matchedIngredients.length / preferences.favoriteIngredients.length;
      }
    }

    // 避免的食材检查（惩罚分）
    if (
      preferences.avoidIngredients &&
      preferences.avoidIngredients.length > 0
    ) {
      const avoidedIngredients =
        dish.ingredients?.filter((ing: string) =>
          preferences.avoidIngredients.includes(ing),
        ) || [];
      if (avoidedIngredients.length > 0) {
        matchScore -= 0.5;
      }
    }

    return maxScore > 0 ? Math.max(0, matchScore / maxScore) : 0.5;
  }

  /**
   * 基于收藏计算相似度分数 (0-1)
   */
  private calculateFavoriteScore(
    dish: any,
    favoriteFeatures: FavoriteFeatureSummary,
  ): number {
    if (favoriteFeatures.dishIds.size === 0) {
      return 0.5;
    }

    let similarityScore = 0;

    // 标签相似度
    if (favoriteFeatures.tagWeights.size > 0) {
      let maxTagWeight = 0;
      favoriteFeatures.tagWeights.forEach((weight) => {
        maxTagWeight = Math.max(maxTagWeight, weight);
      });
      const matchedTags =
        dish.tags?.filter((tag: string) =>
          favoriteFeatures.tagWeights.has(tag),
        ) || [];
      if (matchedTags.length > 0) {
        let tagScore = 0;
        matchedTags.forEach((tag: string) => {
          tagScore +=
            (favoriteFeatures.tagWeights.get(tag) || 0) / maxTagWeight;
        });
        similarityScore += (tagScore / matchedTags.length) * 0.25;
      }
    }

    // 食堂相似度
    if (favoriteFeatures.canteenIds.has(dish.canteenId)) {
      similarityScore += 0.15;
    }

    // 食材相似度
    if (favoriteFeatures.ingredients.size > 0) {
      const matchedIngredients =
        dish.ingredients?.filter((ing: string) =>
          favoriteFeatures.ingredients.has(ing),
        ) || [];
      similarityScore +=
        (matchedIngredients.length / favoriteFeatures.ingredients.size) * 0.2;
    }

    // 口味相似度
    if (favoriteFeatures.avgPrice > 0) {
      const flavorDiff = this.calculateFlavorDifference(dish, {
        spicyLevel: favoriteFeatures.avgSpicyLevel,
        sweetness: favoriteFeatures.avgSweetness,
        saltiness: favoriteFeatures.avgSaltiness,
        oiliness: favoriteFeatures.avgOiliness,
      });
      similarityScore += this.flavorDifferenceToSimilarity(flavorDiff) * 0.2;
    }

    // 价格相似度
    if (favoriteFeatures.avgPrice > 0) {
      const priceDiff = Math.abs(dish.price - favoriteFeatures.avgPrice);
      similarityScore +=
        Math.max(0, 1 - priceDiff / favoriteFeatures.avgPrice) * 0.2;
    }

    return Math.min(1, similarityScore);
  }

  /**
   * 基于浏览历史计算相关性分数 (0-1)
   */
  private calculateBrowseScore(
    dish: any,
    browseFeatures: BrowseFeatureSummary,
  ): number {
    if (browseFeatures.tagWeights.size === 0) {
      return 0.5;
    }

    let relevanceScore = 0;

    // 计算标签相关性
    let maxTagWeight = 0;
    browseFeatures.tagWeights.forEach((weight) => {
      maxTagWeight = Math.max(maxTagWeight, weight);
    });

    if (maxTagWeight > 0) {
      let tagScore = 0;
      dish.tags?.forEach((tag: string) => {
        if (browseFeatures.tagWeights.has(tag)) {
          tagScore += browseFeatures.tagWeights.get(tag)! / maxTagWeight;
        }
      });
      relevanceScore += Math.min(1, tagScore / (dish.tags?.length || 1)) * 0.6;
    }

    // 计算食堂相关性
    if (browseFeatures.canteenWeights.has(dish.canteenId)) {
      let maxCanteenWeight = 0;
      browseFeatures.canteenWeights.forEach((weight) => {
        maxCanteenWeight = Math.max(maxCanteenWeight, weight);
      });
      relevanceScore +=
        (browseFeatures.canteenWeights.get(dish.canteenId)! /
          maxCanteenWeight) *
        0.4;
    }

    return Math.min(1, relevanceScore);
  }

  /**
   * 计算菜品质量分数 (0-1)
   */
  private calculateQualityScore(dish: any): number {
    const ratingScore = (dish.averageRating || 0) / 5;
    // 评论数使用对数 scale，避免评论数过大主导分数
    const reviewCountScore = Math.min(
      1,
      Math.log10((dish.reviewCount || 0) + 1) / 2,
    );
    return ratingScore * 0.7 + reviewCountScore * 0.3;
  }

  /**
   * 计算多样性分数 (0-1)
   */
  private calculateDiversityScore(
    dish: any,
    favoriteFeatures: FavoriteFeatureSummary,
    browseFeatures: BrowseFeatureSummary,
  ): number {
    // 已收藏的菜品多样性分数为0（避免重复推荐）
    if (favoriteFeatures.dishIds.has(dish.id)) {
      return 0;
    }

    // 检查最近浏览历史中的出现频率
    if (browseFeatures.recentDishIds.has(dish.id)) {
      return 0.3; // 最近浏览过，降低多样性分数
    }

    return 1; // 完全新的菜品
  }

  /**
   * 计算搜索关键词匹配分数 (0-1)
   */
  private calculateSearchScore(
    dish: any,
    searchContext?: SearchContext | null,
  ): number {
    if (!searchContext) {
      return 0.5; // 无搜索上下文时返回中等分数
    }

    const { keyword, fields, normalizedKeywords } = searchContext;
    let totalScore = 0;
    let maxPossibleScore = 0;

    // 1. 精确匹配（权重最高）
    const exactMatchWeight = 0.4;
    maxPossibleScore += exactMatchWeight;

    const dishNameLower = (dish.name || '').toLowerCase();
    if (fields.includes('name')) {
      if (dishNameLower === keyword.toLowerCase()) {
        totalScore += exactMatchWeight; // 完全精确匹配
      } else if (dishNameLower.includes(keyword.toLowerCase())) {
        const matchRatio = keyword.length / dish.name.length;
        const positionBonus = dishNameLower.startsWith(keyword.toLowerCase())
          ? 0.2
          : 0;
        totalScore +=
          exactMatchWeight * (0.5 + matchRatio * 0.3 + positionBonus);
      }
    }

    // 2. 标签匹配（权重中等）
    const tagMatchWeight = 0.25;
    maxPossibleScore += tagMatchWeight;

    if (fields.includes('tags') && dish.tags?.length > 0) {
      const tagsLower = dish.tags.map((t: string) => t.toLowerCase());
      let tagMatchCount = 0;

      normalizedKeywords.forEach((kw) => {
        if (
          tagsLower.some((tag: string) => tag.includes(kw) || kw.includes(tag))
        ) {
          tagMatchCount++;
        }
      });

      if (tagMatchCount > 0) {
        const tagMatchRatio = Math.min(
          1,
          tagMatchCount / Math.max(1, normalizedKeywords.length),
        );
        totalScore += tagMatchWeight * tagMatchRatio;
      }
    }

    // 3. 描述匹配（权重较低）
    const descMatchWeight = 0.2;
    maxPossibleScore += descMatchWeight;

    if (fields.includes('description') && dish.description) {
      const descLower = dish.description.toLowerCase();
      let descMatchCount = 0;

      normalizedKeywords.forEach((kw) => {
        if (descLower.includes(kw)) {
          descMatchCount++;
        }
      });

      if (descMatchCount > 0) {
        const descMatchRatio = Math.min(
          1,
          descMatchCount / normalizedKeywords.length,
        );
        totalScore += descMatchWeight * descMatchRatio;
      }
    }

    // 4. 食材匹配（额外加分）
    const ingredientMatchWeight = 0.15;
    maxPossibleScore += ingredientMatchWeight;

    if (dish.ingredients?.length > 0) {
      const ingredientsLower = dish.ingredients.map((i: string) =>
        i.toLowerCase(),
      );
      let ingredientMatchCount = 0;

      normalizedKeywords.forEach((kw) => {
        if (
          ingredientsLower.some(
            (ing: string) => ing.includes(kw) || kw.includes(ing),
          )
        ) {
          ingredientMatchCount++;
        }
      });

      if (ingredientMatchCount > 0) {
        const ingredientMatchRatio = Math.min(
          1,
          ingredientMatchCount / normalizedKeywords.length,
        );
        totalScore += ingredientMatchWeight * ingredientMatchRatio;
      }
    }

    return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0.5;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 事件追踪 API - 点击、收藏、评价事件
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 记录曝光事件
   */
  private async logImpressionEvents(
    userId: string,
    result: RecommendationResultDto,
    context: RecommendationContext,
    experimentId?: string,
  ): Promise<void> {
    if (!this.eventLogger) {
      return;
    }

    await this.eventLogger.logImpressions(
      userId,
      result.data.items.map((item) => item.id),
      {
        scene: context.scene,
        requestId: context.requestId!,
        experimentId,
        groupItemId: context.groupItemId,
      },
    );
  }

  /**
   * 记录推荐事件日志（通用）
   */
  async logRecommendationEvent(
    event: Omit<RecommendationEvent, 'eventId' | 'timestamp'>,
  ): Promise<string | null> {
    if (!this.eventLogger) {
      this.logger.warn('Event logger not available, skipping event logging');
      return null;
    }

    const eventId = await this.eventLogger.logEvent(event);

    // 如果是影响用户特征的事件，触发缓存刷新
    if (
      event.eventType === RecommendationEventType.FAVORITE ||
      event.eventType === RecommendationEventType.REVIEW
    ) {
      // 异步刷新，不阻塞当前请求
      this.refreshUserFeatureCache(event.userId).catch((err) =>
        this.logger.warn(`Failed to refresh user cache: ${err.message}`),
      );
    }

    return eventId;
  }

  /**
   * 记录用户点击事件
   */
  async logClickEvent(
    userId: string,
    dishId: string,
    context: {
      scene: RecommendationScene;
      requestId?: string;
      position?: number;
      experimentId?: string;
      groupItemId?: string;
    },
  ): Promise<string | null> {
    if (!this.eventLogger) {
      return null;
    }

    return this.eventLogger.logClick(userId, dishId, context);
  }

  /**
   * 记录用户收藏事件
   */
  async logFavoriteEvent(
    userId: string,
    dishId: string,
    context: {
      scene: RecommendationScene;
      requestId?: string;
      position?: number;
      experimentId?: string;
      groupItemId?: string;
    },
  ): Promise<string | null> {
    if (!this.eventLogger) {
      return null;
    }

    const eventId = await this.eventLogger.logFavorite(userId, dishId, context);

    // 收藏行为触发用户特征缓存刷新
    this.refreshUserFeatureCache(userId).catch((err) =>
      this.logger.warn(
        `Failed to refresh user cache on favorite: ${err.message}`,
      ),
    );

    return eventId;
  }

  /**
   * 记录用户评价事件
   */
  async logReviewEvent(
    userId: string,
    dishId: string,
    rating: number,
    context: {
      scene: RecommendationScene;
      requestId?: string;
      position?: number;
      experimentId?: string;
      groupItemId?: string;
    },
  ): Promise<string | null> {
    if (!this.eventLogger) {
      return null;
    }

    const eventId = await this.eventLogger.logReview(userId, dishId, {
      ...context,
      rating,
    });

    // 评价行为触发用户特征缓存刷新
    this.refreshUserFeatureCache(userId).catch((err) =>
      this.logger.warn(
        `Failed to refresh user cache on review: ${err.message}`,
      ),
    );

    return eventId;
  }

  /**
   * 记录负反馈事件
   */
  async logDislikeEvent(
    userId: string,
    dishId: string,
    reason: string,
    context: {
      scene: RecommendationScene;
      requestId?: string;
      position?: number;
      experimentId?: string;
      groupItemId?: string;
    },
  ): Promise<string | null> {
    if (!this.eventLogger) {
      return null;
    }

    return this.eventLogger.logDislike(userId, dishId, {
      ...context,
      reason,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 相似菜品推荐 - 相似推荐算法
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 获取相似菜品推荐
   */
  async getSimilarDishes(
    dishId: string,
    pagination: { page: number; pageSize: number },
    userId?: string,
  ): Promise<{ items: ScoredDish[]; total: number; totalPages: number }> {
    const targetDish = await this.prisma.dish.findUnique({
      where: { id: dishId },
      include: { canteen: true, window: true },
    });

    if (!targetDish) {
      return { items: [], total: 0, totalPages: 0 };
    }

    // 获取候选菜品（排除自身）
    const candidateDishes = await this.prisma.dish.findMany({
      where: {
        id: { not: dishId },
        status: 'online',
      },
      include: { canteen: true, window: true },
      take: RECOMMENDATION_LIMITS.MIN_CANDIDATES,
    });

    let allScoredDishes: ScoredDish[];

    // 如果有嵌入服务，优先使用向量相似度
    if (this.embeddingService && this.embeddingService.isEnabled()) {
      allScoredDishes = await this.getSimilarDishesByEmbedding(
        targetDish,
        candidateDishes,
        RECOMMENDATION_LIMITS.MIN_CANDIDATES, // 获取所有候选
      );
    } else {
      // 否则使用特征相似度
      allScoredDishes = await this.getSimilarDishesByFeatures(
        targetDish,
        candidateDishes,
        RECOMMENDATION_LIMITS.MIN_CANDIDATES, // 获取所有候选
        userId,
      );
    }

    // 应用分页
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;
    const paginatedItems = allScoredDishes.slice(skip, skip + pageSize);
    const total = allScoredDishes.length;
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: paginatedItems,
      total,
      totalPages,
    };
  }

  /**
   * 基于向量嵌入获取相似菜品
   */
  private async getSimilarDishesByEmbedding(
    targetDish: any,
    candidateDishes: any[],
    limit: number,
  ): Promise<ScoredDish[]> {
    if (!this.embeddingService) {
      return [];
    }

    // 使用封装好的方法，已内置版本兼容处理
    const similarDishes = await this.embeddingService.getSimilarDishes(
      targetDish.id,
      candidateDishes.map((d) => d.id),
      limit,
    );

    if (similarDishes.length === 0) {
      return this.getSimilarDishesByLocalEmbedding(
        targetDish,
        candidateDishes,
        limit,
      );
    }

    // 构建 ScoredDish 结果
    const dishMap = new Map(candidateDishes.map((d) => [d.id, d]));
    const scoredDishes: ScoredDish[] = [];

    for (const { dishId, similarity } of similarDishes) {
      const dish = dishMap.get(dishId);
      if (!dish) continue;
      scoredDishes.push({
        dish,
        score: similarity,
        scoreBreakdown: {
          preferenceScore: 0,
          favoriteScore: 0,
          browseScore: 0,
          qualityScore: this.calculateQualityScore(dish),
          diversityScore: 1,
          searchScore: 0,
        },
      });
    }

    return scoredDishes;
  }

  /**
   * 基于本地嵌入获取相似菜品（备用方法）
   */
  private async getSimilarDishesByLocalEmbedding(
    targetDish: any,
    candidateDishes: any[],
    limit: number,
  ): Promise<ScoredDish[]> {
    if (!this.embeddingService) {
      return [];
    }

    const targetEmbedding =
      this.embeddingService.generateDishEmbeddingLocal(targetDish);

    const scoredDishes = candidateDishes.map((dish) => {
      const dishEmbedding =
        this.embeddingService!.generateDishEmbeddingLocal(dish);
      const similarity = this.cosineSimilarity(targetEmbedding, dishEmbedding);

      return {
        dish,
        score: similarity,
        scoreBreakdown: {
          preferenceScore: 0,
          favoriteScore: 0,
          browseScore: 0,
          qualityScore: this.calculateQualityScore(dish),
          diversityScore: 1,
          searchScore: 0,
        },
      };
    });

    scoredDishes.sort((a, b) => b.score - a.score);
    return scoredDishes.slice(0, limit);
  }

  /**
   * 基于特征匹配获取相似菜品
   */
  private async getSimilarDishesByFeatures(
    targetDish: any,
    candidateDishes: any[],
    limit: number,
    userId?: string,
  ): Promise<ScoredDish[]> {
    let userFeatures: UserFeatures | null = null;
    if (userId) {
      userFeatures = await this.getUserFeaturesWithCache(userId);
    }

    const scoredDishes = candidateDishes.map((dish) => {
      let score = 0;

      // 标签相似度 (权重 35%)
      const tagSimilarity = this.calculateTagSimilarity(
        targetDish.tags || [],
        dish.tags || [],
      );
      score += tagSimilarity * 0.35;

      // 食堂相同加分 (权重 15%)
      if (dish.canteenId === targetDish.canteenId) {
        score += 0.15;
      }

      // 价格相似度 (权重 15%)
      const priceDiff = Math.abs((dish.price || 0) - (targetDish.price || 0));
      const priceSimilarity = Math.max(
        0,
        1 - priceDiff / Math.max(targetDish.price || 1, 20),
      );
      score += priceSimilarity * 0.15;

      // 口味相似度 (权重 20%)
      const flavorDiff = this.calculateFlavorDifference(dish, {
        spicyLevel: targetDish.spicyLevel || 0,
        sweetness: targetDish.sweetness || 0,
        saltiness: targetDish.saltiness || 0,
        oiliness: targetDish.oiliness || 0,
      });
      const flavorSimilarity = this.flavorDifferenceToSimilarity(flavorDiff);
      score += flavorSimilarity * 0.2;

      // 食材相似度 (权重 15%)
      const ingredientSimilarity = this.calculateTagSimilarity(
        targetDish.ingredients || [],
        dish.ingredients || [],
      );
      score += ingredientSimilarity * 0.15;

      // 如果有用户特征，额外考虑用户偏好
      let preferenceBonus = 0;
      if (userFeatures?.preferences) {
        preferenceBonus =
          this.calculatePreferenceScore(dish, userFeatures.preferences) * 0.1;
      }

      return {
        dish,
        score: Math.min(1, score + preferenceBonus),
        scoreBreakdown: {
          preferenceScore: preferenceBonus,
          favoriteScore: 0,
          browseScore: 0,
          qualityScore: this.calculateQualityScore(dish),
          diversityScore: 1,
          searchScore: 0,
        },
      };
    });

    scoredDishes.sort((a, b) => b.score - a.score);
    return scoredDishes.slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 嵌入向量推荐 - 基于向量的推荐
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 获取基于嵌入相似度的个性化推荐
   */
  async getEmbeddingBasedRecommendations(
    userId: string,
    limit: number = 20,
    canteenId?: string,
  ): Promise<ScoredDish[]> {
    if (!this.embeddingService) {
      this.logger.warn('Embedding service not available');
      return [];
    }

    // 获取用户特征和嵌入
    const userFeatures = await this.getUserFeaturesWithCache(userId);
    let userEmbedding = await this.embeddingService.getUserEmbedding(userId);

    if (!userEmbedding) {
      userEmbedding = await this.embeddingService.generateUserEmbedding(
        userId,
        userFeatures,
      );
    }

    if (!userEmbedding) {
      this.logger.warn(`Failed to get/generate user embedding for ${userId}`);
      return [];
    }

    // 获取候选菜品
    const whereCondition: any = { status: 'online' };
    if (canteenId) {
      whereCondition.canteenId = canteenId;
    }

    // 排除用户过敏原
    if (userFeatures.allergens && userFeatures.allergens.length > 0) {
      whereCondition.NOT = {
        allergens: { hasSome: userFeatures.allergens },
      };
    }

    const candidateDishes = await this.prisma.dish.findMany({
      where: whereCondition,
      include: { canteen: true, window: true },
      take: RECOMMENDATION_LIMITS.MIN_CANDIDATES,
    });

    if (candidateDishes.length === 0) {
      return [];
    }

    // 获取菜品嵌入并计算相似度
    const dishIds = candidateDishes.map((d) => d.id);
    const similarities =
      await this.embeddingService.calculateUserDishSimilarities(
        userId,
        dishIds,
      );

    // 构建评分结果
    const scoredDishes: ScoredDish[] = candidateDishes.map((dish) => {
      const embeddingSimilarity = similarities.get(dish.id) || 0;
      const qualityScore = this.calculateQualityScore(dish);
      const diversityScore = userFeatures.favoriteFeatures.dishIds.has(dish.id)
        ? 0
        : 1;

      // 综合分数：嵌入相似度 * 0.6 + 质量分数 * 0.3 + 多样性 * 0.1
      const score =
        embeddingSimilarity * 0.6 + qualityScore * 0.3 + diversityScore * 0.1;

      return {
        dish,
        score,
        scoreBreakdown: {
          preferenceScore: embeddingSimilarity,
          favoriteScore: 0,
          browseScore: 0,
          qualityScore,
          diversityScore,
          searchScore: 0,
        },
      };
    });

    scoredDishes.sort((a, b) => b.score - a.score);
    return scoredDishes.slice(0, limit);
  }

  /**
   * 获取与用户口味最匹配的菜品（基于嵌入）
   */
  async getPersonalizedDishes(
    userId: string,
    options: {
      canteenId?: string;
      mealTime?: string;
      pagination: { page: number; pageSize: number };
    },
  ): Promise<{ items: ScoredDish[]; total: number; totalPages: number }> {
    const { canteenId, mealTime, pagination } = options;

    let allScoredDishes: ScoredDish[];

    // 如果有嵌入服务，使用嵌入推荐
    if (this.embeddingService && this.embeddingService.isEnabled()) {
      allScoredDishes = await this.getEmbeddingBasedRecommendations(
        userId,
        RECOMMENDATION_LIMITS.MIN_CANDIDATES, // 获取所有候选
        canteenId,
      );
    } else {
      // 否则使用传统的特征匹配
      const userFeatures = await this.getUserFeaturesWithCache(userId);

      const whereCondition: any = { status: 'online' };
      if (canteenId) {
        whereCondition.canteenId = canteenId;
      }
      if (mealTime) {
        whereCondition.availableMealTime = { has: mealTime };
      }
      if (userFeatures.allergens && userFeatures.allergens.length > 0) {
        whereCondition.NOT = {
          allergens: { hasSome: userFeatures.allergens },
        };
      }

      const dishes = await this.prisma.dish.findMany({
        where: whereCondition,
        include: { canteen: true, window: true },
        take: RECOMMENDATION_LIMITS.MIN_CANDIDATES,
      });

      const weights = this.resolveWeights(
        RecommendationScene.HOME,
        false,
        null,
      );
      allScoredDishes = await this.scoreCandidates(
        dishes,
        userFeatures,
        weights,
        null,
        { userId, scene: RecommendationScene.HOME },
        false,
      );

      allScoredDishes.sort((a, b) => b.score - a.score);
    }

    // 应用分页
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;
    const paginatedItems = allScoredDishes.slice(skip, skip + pageSize);
    const total = allScoredDishes.length;
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: paginatedItems,
      total,
      totalPages,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 A/B 测试相关 - 实验分组管理
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 获取 A/B 测试分组项
   */
  async getExperimentGroup(
    userId: string,
    experimentId: string,
  ): Promise<{ groupItemId: string; groupItemName: string } | null> {
    if (!this.experimentService) {
      return null;
    }

    const context: RecommendationContext = {
      userId,
      scene: RecommendationScene.HOME,
    };

    const assignment = await this.experimentService.assignUserToExperiment(
      userId,
      context,
    );

    if (assignment && 'groupItemId' in assignment) {
      return {
        groupItemId: assignment.groupItemId,
        groupItemName: assignment.name || assignment.groupItemId,
      };
    }

    return null;
  }

  /**
   * 清理所有推荐相关缓存（谨慎使用）
   */
  async flushAllRecommendationCaches(): Promise<void> {
    if (!this.cacheService) {
      return;
    }

    await this.cacheService.flushRecommendationCache();
    this.logger.log('All recommendation caches flushed');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 系统健康状态 - 健康检查接口
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 获取推荐系统健康状态
   */
  async getHealthStatus(): Promise<{
    status: string;
    services: Record<string, boolean>;
    metrics?: Record<string, number>;
  }> {
    const services: Record<string, boolean> = {
      prisma: true,
      cache: !!this.cacheService,
      eventLogger: !!this.eventLogger,
      experiment: !!this.experimentService,
      embedding: !!this.embeddingService,
    };

    // 检查 Prisma 连接
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      services.prisma = false;
    }

    // 检查缓存服务状态
    if (this.cacheService) {
      services.cacheConnected = this.cacheService.isConnected();
    }

    // 检查嵌入服务状态
    if (this.embeddingService) {
      services.embeddingEnabled = this.embeddingService.isEnabled();
      services.externalEmbeddingAvailable =
        this.embeddingService.isExternalServiceAvailable();
    }

    const allHealthy =
      services.prisma && (!this.cacheService || services.cacheConnected);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📍 辅助方法 - 工具函数
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 映射为推荐菜品 DTO
   */
  private mapToRecommendedDishItem(
    scoredDish: ScoredDish,
    includeScore = false,
  ): RecommendedDishItemDto {
    return {
      id: scoredDish.dish.id,
      score: includeScore ? scoredDish.score : undefined,
      scoreBreakdown: includeScore ? scoredDish.scoreBreakdown : undefined,
    };
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
}
