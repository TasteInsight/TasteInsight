import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CACHE_CONFIG } from '../constants/recommendation.constants';
import { UserFeatures, RecommendationWeights } from '../interfaces';
import { hashToShortString } from '../utils/hash.util';

/**
 * Redis 缓存服务
 * 用于缓存用户特征、菜品特征和推荐结果
 */
@Injectable()
export class RecommendationCacheService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RecommendationCacheService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = this.configService.get<number>('REDIS_REC_DB', 1); // 使用独立的 DB

    this.redis = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.log('Recommendation cache service connected to Redis');
    });
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  // ==================== 用户特征缓存 ====================

  /**
   * 缓存用户特征
   */
  async setUserFeatures(userId: string, features: UserFeatures): Promise<void> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.USER_FEATURE}${userId}`;
    const serialized = this.serializeUserFeatures(features);
    await this.redis.setex(key, CACHE_CONFIG.USER_FEATURE_TTL, serialized);
  }

  /**
   * 获取缓存的用户特征
   */
  async getUserFeatures(userId: string): Promise<UserFeatures | null> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.USER_FEATURE}${userId}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    return this.deserializeUserFeatures(data);
  }

  /**
   * 删除用户特征缓存
   */
  async invalidateUserFeatures(userId: string): Promise<void> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.USER_FEATURE}${userId}`;
    await this.redis.del(key);
  }

  // ==================== 推荐结果缓存 ====================

  /**
   * 缓存推荐结果
   */
  async setRecommendationResult(
    userId: string,
    scene: string,
    filters: string,
    result: any,
  ): Promise<void> {
    const key = this.buildRecommendationKey(userId, scene, filters);
    await this.redis.setex(
      key,
      CACHE_CONFIG.RECOMMENDATION_RESULT_TTL,
      JSON.stringify(result),
    );
  }

  /**
   * 获取缓存的推荐结果
   */
  async getRecommendationResult(
    userId: string,
    scene: string,
    filters: string,
  ): Promise<any | null> {
    const key = this.buildRecommendationKey(userId, scene, filters);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * 删除用户的所有推荐缓存
   */
  async invalidateUserRecommendations(userId: string): Promise<void> {
    const pattern = `${CACHE_CONFIG.KEY_PREFIX.RECOMMENDATION}${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ==================== 实验分组缓存 ====================

  /**
   * 缓存用户实验分组
   */
  async setUserExperimentGroup(
    userId: string,
    experimentId: string,
    groupId: string,
    ttl: number = 86400, // 默认24小时
  ): Promise<void> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.EXPERIMENT_USER_GROUP}${experimentId}:${userId}`;
    await this.redis.setex(key, ttl, groupId);
  }

  /**
   * 获取用户实验分组
   */
  async getUserExperimentGroup(
    userId: string,
    experimentId: string,
  ): Promise<string | null> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.EXPERIMENT_USER_GROUP}${experimentId}:${userId}`;
    return this.redis.get(key);
  }

  // ==================== 实验权重缓存 ====================

  /**
   * 缓存实验分组权重
   */
  async setExperimentGroupItemWeights(
    groupItemId: string,
    weights: RecommendationWeights,
    ttl: number = 3600,
  ): Promise<void> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.EXPERIMENT_WEIGHTS}${groupItemId}`;
    await this.redis.setex(key, ttl, JSON.stringify(weights));
  }

  /**
   * 获取实验分组权重
   */
  async getExperimentGroupItemWeights(
    groupItemId: string,
  ): Promise<RecommendationWeights | null> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.EXPERIMENT_WEIGHTS}${groupItemId}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  // ==================== 菜品向量缓存 ====================

  /**
   * 缓存菜品向量
   */
  async setDishEmbedding(
    dishId: string,
    embedding: number[],
    ttl: number = CACHE_CONFIG.DISH_FEATURE_TTL,
  ): Promise<void> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.DISH_FEATURE}embedding:${dishId}`;
    await this.redis.setex(key, ttl, JSON.stringify(embedding));
  }

  /**
   * 获取菜品向量
   */
  async getDishEmbedding(dishId: string): Promise<number[] | null> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.DISH_FEATURE}embedding:${dishId}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * 批量获取菜品向量
   */
  async getDishEmbeddings(dishIds: string[]): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    if (dishIds.length === 0) return result;

    const keys = dishIds.map(
      (id) => `${CACHE_CONFIG.KEY_PREFIX.DISH_FEATURE}embedding:${id}`,
    );
    const values = await this.redis.mget(...keys);

    values.forEach((value, index) => {
      if (value) {
        result.set(dishIds[index], JSON.parse(value));
      }
    });

    return result;
  }

  // ==================== 统计计数器 ====================

  /**
   * 增加事件计数
   */
  async incrementEventCount(
    eventType: string,
    dishId: string,
    date: string = new Date().toISOString().split('T')[0],
  ): Promise<void> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.STATS_EVENT}${eventType}:${date}:${dishId}`;
    await this.redis.incr(key);
    // 设置 7 天过期
    await this.redis.expire(key, 7 * 24 * 3600);
  }

  /**
   * 获取事件计数
   */
  async getEventCount(
    eventType: string,
    dishId: string,
    date: string = new Date().toISOString().split('T')[0],
  ): Promise<number> {
    const key = `${CACHE_CONFIG.KEY_PREFIX.STATS_EVENT}${eventType}:${date}:${dishId}`;
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * 批量获取多天事件计数
   */
  async getEventCountsForDays(
    eventType: string,
    dishId: string,
    days: number = 7,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = await this.getEventCount(eventType, dishId, dateStr);
      result.set(dateStr, count);
    }

    return result;
  }

  // ==================== 辅助方法 ====================

  private buildRecommendationKey(
    userId: string,
    scene: string,
    filters: string,
  ): string {
    // 对 filters 进行哈希以避免 key 过长
    const hash = hashToShortString(filters);
    return `${CACHE_CONFIG.KEY_PREFIX.RECOMMENDATION}${userId}:${scene}:${hash}`;
  }

  /**
   * 序列化用户特征（处理 Map 和 Set）
   */
  private serializeUserFeatures(features: UserFeatures): string {
    const serialized = {
      ...features,
      favoriteFeatures: {
        ...features.favoriteFeatures,
        tagWeights: Array.from(features.favoriteFeatures.tagWeights.entries()),
        canteenIds: Array.from(features.favoriteFeatures.canteenIds),
        ingredients: Array.from(features.favoriteFeatures.ingredients),
        dishIds: Array.from(features.favoriteFeatures.dishIds),
      },
      browseFeatures: {
        ...features.browseFeatures,
        tagWeights: Array.from(features.browseFeatures.tagWeights.entries()),
        canteenWeights: Array.from(
          features.browseFeatures.canteenWeights.entries(),
        ),
        recentDishIds: Array.from(features.browseFeatures.recentDishIds),
      },
    };
    return JSON.stringify(serialized);
  }

  /**
   * 反序列化用户特征（恢复 Map 和 Set）
   */
  private deserializeUserFeatures(data: string): UserFeatures {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      favoriteFeatures: {
        ...parsed.favoriteFeatures,
        tagWeights: new Map(parsed.favoriteFeatures.tagWeights),
        canteenIds: new Set(parsed.favoriteFeatures.canteenIds),
        ingredients: new Set(parsed.favoriteFeatures.ingredients),
        dishIds: new Set(parsed.favoriteFeatures.dishIds),
      },
      browseFeatures: {
        ...parsed.browseFeatures,
        tagWeights: new Map(parsed.browseFeatures.tagWeights),
        canteenWeights: new Map(parsed.browseFeatures.canteenWeights),
        recentDishIds: new Set(parsed.browseFeatures.recentDishIds),
      },
    };
  }

  /**
   * 检查 Redis 连接状态
   */
  isConnected(): boolean {
    return this.redis?.status === 'ready';
  }

  /**
   * 清空所有推荐相关缓存（谨慎使用）
   */
  async flushRecommendationCache(): Promise<void> {
    const patterns = [
      `${CACHE_CONFIG.KEY_PREFIX.USER_FEATURE}*`,
      `${CACHE_CONFIG.KEY_PREFIX.DISH_FEATURE}*`,
      `${CACHE_CONFIG.KEY_PREFIX.RECOMMENDATION}*`,
      `${CACHE_CONFIG.KEY_PREFIX.EXPERIMENT_USER_GROUP}*`,
      `${CACHE_CONFIG.KEY_PREFIX.EXPERIMENT_WEIGHTS}*`,
      `${CACHE_CONFIG.KEY_PREFIX.STATS_EVENT}*`,
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
