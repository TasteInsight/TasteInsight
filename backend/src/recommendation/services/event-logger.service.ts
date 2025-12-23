import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  RecommendationEventType,
  RecommendationScene,
} from '../constants/recommendation.constants';
import { RecommendationEvent } from '../interfaces';
import { RecommendationCacheService } from './cache.service';

/**
 * 推荐事件日志服务
 * 记录推荐系统的曝光、点击、收藏、评价等事件
 */
@Injectable()
export class EventLoggerService {
  constructor(
    private prisma: PrismaService,
    private cacheService: RecommendationCacheService,
  ) {}

  /**
   * 记录曝光事件（批量）
   */
  async logImpressions(
    userId: string,
    dishIds: string[],
    context: {
      scene: RecommendationScene;
      requestId: string;
      experimentId?: string;
      groupItemId?: string;
      scores?: Map<string, number>;
      extras?: Map<string, Record<string, any>>;
    },
  ): Promise<void> {
    const events = dishIds.map(
      (dishId, index) =>
        ({
          userId,
          dishId,
          eventType: RecommendationEventType.IMPRESSION,
          scene: context.scene,
          requestId: context.requestId,
          position: index,
          score: context.scores?.get(dishId),
          experimentId: context.experimentId,
          groupItemId: context.groupItemId,
          extra: context.extras?.get(dishId),
        }) as Omit<RecommendationEvent, 'eventId' | 'timestamp'>,
    );

    // 批量插入数据库
    await this.prisma.recommendationEvent.createMany({
      data: events,
    });

    // 更新 Redis 计数器
    const today = new Date().toISOString().split('T')[0];
    await Promise.all(
      dishIds.map((dishId) =>
        this.cacheService.incrementEventCount(
          RecommendationEventType.IMPRESSION,
          dishId,
          today,
        ),
      ),
    );
  }

  /**
   * 记录单个事件
   */
  async logEvent(
    event: Omit<RecommendationEvent, 'eventId' | 'timestamp'>,
  ): Promise<string> {
    const created = await this.prisma.recommendationEvent.create({
      data: {
        eventType: event.eventType,
        userId: event.userId,
        dishId: event.dishId,
        scene: event.scene,
        requestId: event.requestId,
        position: event.position,
        score: event.score,
        experimentId: event.experimentId,
        groupItemId: event.groupItemId,
        extra: event.extra as any,
      },
    });

    // 更新 Redis 计数器
    const today = new Date().toISOString().split('T')[0];
    await this.cacheService.incrementEventCount(
      event.eventType,
      event.dishId,
      today,
    );

    return created.id;
  }

  /**
   * 记录点击事件
   */
  async logClick(
    userId: string,
    dishId: string,
    context: {
      scene: RecommendationScene;
      requestId?: string;
      position?: number;
      experimentId?: string;
      groupItemId?: string;
      extra?: Record<string, any>;
    },
  ): Promise<string> {
    return this.logEvent({
      eventType: RecommendationEventType.CLICK,
      userId,
      dishId,
      scene: context.scene,
      requestId: context.requestId,
      position: context.position,
      experimentId: context.experimentId,
      groupItemId: context.groupItemId,
      extra: context.extra,
    });
  }

  /**
   * 记录收藏事件
   */
  async logFavorite(
    userId: string,
    dishId: string,
    context: {
      scene: RecommendationScene;
      requestId?: string;
      position?: number;
      experimentId?: string;
      groupItemId?: string;
      extra?: Record<string, any>;
    },
  ): Promise<string> {
    // 收藏行为触发用户特征缓存失效
    await this.cacheService.invalidateUserFeatures(userId);
    await this.cacheService.invalidateUserRecommendations(userId);

    return this.logEvent({
      eventType: RecommendationEventType.FAVORITE,
      userId,
      dishId,
      scene: context.scene,
      requestId: context.requestId,
      position: context.position,
      experimentId: context.experimentId,
      groupItemId: context.groupItemId,
      extra: context.extra,
    });
  }

  /**
   * 记录评价事件
   */
  async logReview(
    userId: string,
    dishId: string,
    context: {
      scene: RecommendationScene;
      requestId?: string;
      position?: number;
      experimentId?: string;
      groupItemId?: string;
      extra?: Record<string, any>;
      rating: number;
    },
  ): Promise<string> {
    const _extra = { ...context.extra, rating: context.rating };
    return this.logEvent({
      eventType: RecommendationEventType.REVIEW,
      userId,
      dishId,
      scene: context.scene,
      requestId: context.requestId,
      position: context.position,
      experimentId: context.experimentId,
      groupItemId: context.groupItemId,
      extra: _extra,
    });
  }

  /**
   * 记录负反馈事件
   */
  async logDislike(
    userId: string,
    dishId: string,
    context: {
      scene: RecommendationScene;
      requestId?: string;
      position?: number;
      experimentId?: string;
      groupItemId?: string;
      extra?: Record<string, any>;
      reason?: string;
    },
  ): Promise<string> {
    const _extra = { ...context.extra, reason: context.reason };
    return this.logEvent({
      eventType: RecommendationEventType.DISLIKE,
      userId,
      dishId,
      scene: context.scene,
      requestId: context.requestId,
      position: context.position,
      experimentId: context.experimentId,
      groupItemId: context.groupItemId,
      extra: _extra,
    });
  }

  // ==================== 统计查询 ====================

  /**
   * 获取菜品点击率 (CTR)
   */
  async getDishCTR(
    dishId: string,
    days: number = 7,
  ): Promise<{ ctr: number; impressions: number; clicks: number }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [impressions, clicks] = await Promise.all([
      this.prisma.recommendationEvent.count({
        where: {
          dishId,
          eventType: RecommendationEventType.IMPRESSION,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.recommendationEvent.count({
        where: {
          dishId,
          eventType: RecommendationEventType.CLICK,
          createdAt: { gte: startDate },
        },
      }),
    ]);

    return {
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
    };
  }

  /**
   * 获取用户行为漏斗数据
   */
  async getUserFunnel(
    userId: string,
    days: number = 7,
  ): Promise<{
    impressions: number;
    clicks: number;
    favorites: number;
    reviews: number;
    dislikes: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.prisma.recommendationEvent.groupBy({
      by: ['eventType'],
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const eventCounts = events.reduce(
      (acc, event) => {
        acc[event.eventType] = event._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      impressions: eventCounts[RecommendationEventType.IMPRESSION] || 0,
      clicks: eventCounts[RecommendationEventType.CLICK] || 0,
      favorites: eventCounts[RecommendationEventType.FAVORITE] || 0,
      reviews: eventCounts[RecommendationEventType.REVIEW] || 0,
      dislikes: eventCounts[RecommendationEventType.DISLIKE] || 0,
    };
  }

  /**
   * 获取特定实验组项指标
   */
  async getExperimentMetrics(
    experimentId: string,
    days: number = 7,
  ): Promise<
    Map<
      string,
      {
        groupItemId: string;
        impressions: number;
        clicks: number;
        favorites: number;
        ctr: number;
        favoriteRate: number;
      }
    >
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.prisma.recommendationEvent.groupBy({
      by: ['groupItemId', 'eventType'],
      where: {
        experimentId,
        createdAt: { gte: startDate },
        groupItemId: { not: null },
      },
      _count: true,
    });

    const metrics = new Map<string, any>();

    events.forEach((event) => {
      const groupItemId = event.groupItemId!;
      if (!metrics.has(groupItemId)) {
        metrics.set(groupItemId, {
          groupId: groupItemId,
          impressions: 0,
          clicks: 0,
          favorites: 0,
          ctr: 0,
          favoriteRate: 0,
        });
      }

      const groupMetrics = metrics.get(groupItemId);
      const eventType = event.eventType as RecommendationEventType;
      switch (eventType) {
        case RecommendationEventType.IMPRESSION:
          groupMetrics.impressions = event._count;
          break;
        case RecommendationEventType.CLICK:
          groupMetrics.clicks = event._count;
          break;
        case RecommendationEventType.FAVORITE:
          groupMetrics.favorites = event._count;
          break;
      }
    });

    // 计算转化率
    metrics.forEach((m) => {
      m.ctr = m.impressions > 0 ? m.clicks / m.impressions : 0;
      m.favoriteRate = m.clicks > 0 ? m.favorites / m.clicks : 0;
    });

    return metrics;
  }

  /**
   * 获取推荐请求的详细事件链
   */
  async getRequestEventChain(
    requestId: string,
  ): Promise<RecommendationEvent[]> {
    const events = await this.prisma.recommendationEvent.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
    });

    return events.map(
      (e): RecommendationEvent => ({
        eventId: e.id,
        userId: e.userId,
        dishId: e.dishId,
        eventType: e.eventType as RecommendationEventType,
        scene: e.scene as RecommendationScene,
        requestId: e.requestId || undefined,
        position: e.position || undefined,
        score: e.score || undefined,
        experimentId: e.experimentId || undefined,
        groupItemId: e.groupItemId || undefined,
        extra: e.extra as Record<string, any> | undefined,
        timestamp: e.createdAt,
      }),
    );
  }

  /**
   * 清理历史事件（保留最近N天）
   */
  async cleanupOldEvents(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.recommendationEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}
