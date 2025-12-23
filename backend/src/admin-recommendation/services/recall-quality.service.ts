import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { RecommendationScene } from '@/recommendation/constants/recommendation.constants';
import { RecallMetricsCalculator } from './recall-metrics.service';
import {
  RecallQualityQueryDto,
  RecallQualityResponseDto,
} from '../dto/recall-quality/recall-quality.dto';

/**
 * 召回质量评估服务
 *
 * 负责编排召回质量评估流程：
 * 1. 获取活跃用户样本
 * 2. 为每个用户生成推荐召回结果
 * 3. 调用 RecallMetricsCalculator 计算各项指标
 * 4. 返回综合评估报告
 */
@Injectable()
export class RecallQualityService {
  private readonly logger = new Logger(RecallQualityService.name);

  constructor(
    private prisma: PrismaService,
    private recallMetricsCalculator: RecallMetricsCalculator,
    private recommendationService: RecommendationService,
  ) {}

  /**
   * 评估召回质量
   *
   */
  async evaluateRecallQuality(
    query: RecallQualityQueryDto,
  ): Promise<RecallQualityResponseDto> {
    // 确保参数有默认值
    const k = query.k ?? 50;
    const days = query.days ?? 7;
    const sampleSize = query.sampleSize ?? 100;

    this.logger.log(
      `Evaluating recall quality with k=${k}, days=${days}, sampleSize=${sampleSize}`,
    );

    try {
      // 1. 获取活跃用户样本（最近有交互的用户）
      const since = new Date();
      since.setDate(since.getDate() - days);

      const activeUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            {
              favoriteDishes: {
                some: {
                  addedAt: { gte: since },
                },
              },
            },
            {
              reviews: {
                some: {
                  createdAt: { gte: since },
                },
              },
            },
          ],
        },
        select: { id: true },
        take: sampleSize,
      });

      if (activeUsers.length === 0) {
        return {
          code: 200,
          message: 'No active users found in the specified time range',
          data: {
            timestamp: new Date(),
            recallAtK: {
              recallAtK: 0,
              totalUsers: 0,
              hitUsers: 0,
            },
            coverage: {
              coverage: 0,
              totalDishes: 0,
              recalledDishes: 0,
            },
            diversity: {
              diversity: 0,
              dominantTags: [],
            },
            summary: '无活跃用户数据',
          },
        };
      }

      this.logger.log(
        `Found ${activeUsers.length} active users for evaluation`,
      );

      // 2. 为每个用户生成召回结果
      const recallResults = new Map<string, string[]>();

      for (const user of activeUsers) {
        try {
          // 使用推荐服务获取召回结果
          const recommendations =
            await this.recommendationService.getRecommendations(user.id, {
              scene: RecommendationScene.HOME,
              pagination: { page: 1, pageSize: k },
              filter: {},
            });

          const dishIds = recommendations.data.items.map((item) => item.id);
          recallResults.set(user.id, dishIds);
        } catch (error) {
          this.logger.warn(
            `Failed to get recommendations for user ${user.id}: ${error.message}`,
          );
          // 继续处理其他用户
        }
      }

      if (recallResults.size === 0) {
        throw new Error('Failed to generate recall results for any user');
      }

      this.logger.log(
        `Generated recall results for ${recallResults.size} users`,
      );

      // 3. 使用 RecallMetricsCalculator 计算指标
      const report =
        await this.recallMetricsCalculator.generateRecallQualityReport(
          recallResults,
          { days, k },
        );

      return {
        code: 200,
        message: 'Recall quality evaluation completed successfully',
        data: report,
      };
    } catch (error) {
      this.logger.error(
        `Failed to evaluate recall quality: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
