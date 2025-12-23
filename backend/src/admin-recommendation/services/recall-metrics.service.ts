import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';

/**
 * 召回指标计算器
 *
 * 提供召回系统的各项指标计算方法：
 * - Recall@K: 召回率计算
 * - Coverage: 召回覆盖率计算
 * - Diversity: 召回多样性计算（基于 Shannon 熵）
 *
 * 注意：这是一个纯计算工具类，不负责数据获取和业务编排
 */
@Injectable()
export class RecallMetricsCalculator {
  private readonly logger = new Logger(RecallMetricsCalculator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 计算 Recall@K 指标
   *
   * 评估方法：对于每个用户，检查他们实际点击/收藏的菜品是否出现在召回结果的前K个中
   *
   * @param recallResults Map<userId, dishIds[]> - 召回结果
   * @param k 召回数量
   * @param days 评估最近N天的数据
   * @returns Recall@K值（0-1之间）
   */
  async calculateRecallAtK(
    recallResults: Map<string, string[]>,
    k: number = 50,
    days: number = 7,
  ): Promise<{
    recallAtK: number;
    totalUsers: number;
    hitUsers: number;
    details: Array<{
      userId: string;
      actualInteractions: number;
      recalledInteractions: number;
    }>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    let totalUsers = 0;
    let hitUsers = 0;
    const details: Array<{
      userId: string;
      actualInteractions: number;
      recalledInteractions: number;
    }> = [];

    for (const [userId, recalledDishIds] of recallResults) {
      // 获取用户实际的正向交互（收藏、高评分）
      const actualInteractions = await this.getUserPositiveInteractions(
        userId,
        since,
      );

      if (actualInteractions.length === 0) {
        continue; // 跳过没有交互的用户
      }

      totalUsers++;

      // 检查召回的前K个中有多少是用户实际交互过的
      const topK = recalledDishIds.slice(0, k);
      const hit = actualInteractions.filter((dishId) => topK.includes(dishId));

      if (hit.length > 0) {
        hitUsers++;
      }

      details.push({
        userId,
        actualInteractions: actualInteractions.length,
        recalledInteractions: hit.length,
      });
    }

    const recallAtK = totalUsers > 0 ? hitUsers / totalUsers : 0;

    return {
      recallAtK,
      totalUsers,
      hitUsers,
      details,
    };
  }

  /**
   * 获取用户的正向交互菜品
   * （收藏 + 4星及以上评价）
   */
  private async getUserPositiveInteractions(
    userId: string,
    since: Date,
  ): Promise<string[]> {
    const [favorites, highRatedReviews] = await Promise.all([
      this.prisma.favoriteDish.findMany({
        where: {
          userId,
          addedAt: { gte: since },
        },
        select: { dishId: true },
      }),
      this.prisma.review.findMany({
        where: {
          userId,
          rating: { gte: 4 },
          createdAt: { gte: since },
        },
        select: { dishId: true },
      }),
    ]);

    const dishIds = new Set<string>();
    favorites.forEach((f) => dishIds.add(f.dishId));
    highRatedReviews.forEach((r) => dishIds.add(r.dishId));

    return Array.from(dishIds);
  }

  /**
   * 计算召回覆盖率
   *
   * 覆盖率 = 被召回过的菜品数 / 总在线菜品数
   * 覆盖率越高，说明召回系统能够推荐更多的长尾菜品
   */
  async calculateCoverage(recallResults: Map<string, string[]>): Promise<{
    coverage: number;
    totalDishes: number;
    recalledDishes: number;
    unrecalledDishes: string[];
  }> {
    // 统计所有被召回过的菜品
    const recalledDishIds = new Set<string>();
    for (const dishIds of recallResults.values()) {
      dishIds.forEach((id) => recalledDishIds.add(id));
    }

    // 获取所有在线菜品
    const allOnlineDishes = await this.prisma.dish.findMany({
      where: { status: 'online' },
      select: { id: true },
    });

    const totalDishes = allOnlineDishes.length;
    const recalledDishes = recalledDishIds.size;
    const coverage = totalDishes > 0 ? recalledDishes / totalDishes : 0;

    // 找出从未被召回的菜品
    const allDishIds = new Set(allOnlineDishes.map((d) => d.id));
    const unrecalledDishes = Array.from(allDishIds).filter(
      (id) => !recalledDishIds.has(id),
    );

    return {
      coverage,
      totalDishes,
      recalledDishes,
      unrecalledDishes: unrecalledDishes.slice(0, 100), // 只返回前100个示例
    };
  }

  /**
   * 计算召回多样性（基于标签分布）
   *
   * 使用 Shannon 熵来衡量召回结果的多样性
   * 熵越高，说明召回的菜品标签分布越均匀
   */
  async calculateDiversity(recalledDishIds: string[]): Promise<{
    diversity: number; // Shannon熵
    tagDistribution: Record<string, number>;
    dominantTags: Array<{ tag: string; count: number }>;
  }> {
    if (recalledDishIds.length === 0) {
      return {
        diversity: 0,
        tagDistribution: {},
        dominantTags: [],
      };
    }

    // 获取所有召回菜品的标签
    const dishes = await this.prisma.dish.findMany({
      where: { id: { in: recalledDishIds } },
      select: { tags: true },
    });

    // 统计标签频率
    const tagCounts: Record<string, number> = {};
    let totalTags = 0;

    dishes.forEach((dish) => {
      if (dish.tags && dish.tags.length > 0) {
        dish.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          totalTags++;
        });
      }
    });

    if (totalTags === 0) {
      return {
        diversity: 0,
        tagDistribution: {},
        dominantTags: [],
      };
    }

    // 计算 Shannon 熵
    let entropy = 0;
    const tagDistribution: Record<string, number> = {};

    Object.entries(tagCounts).forEach(([tag, count]) => {
      const probability = count / totalTags;
      tagDistribution[tag] = probability;
      entropy -= probability * Math.log2(probability);
    });

    // 找出最频繁的标签
    const dominantTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      diversity: entropy,
      tagDistribution,
      dominantTags,
    };
  }

  /**
   * 生成召回质量综合报告
   */
  async generateRecallQualityReport(
    recallResults: Map<string, string[]>,
    options: {
      days?: number;
      k?: number;
    } = {},
  ): Promise<{
    timestamp: Date;
    recallAtK: {
      recallAtK: number;
      totalUsers: number;
      hitUsers: number;
    };
    coverage: {
      coverage: number;
      totalDishes: number;
      recalledDishes: number;
    };
    diversity: {
      diversity: number;
      dominantTags: Array<{ tag: string; count: number }>;
    };
    summary: string;
  }> {
    const { days = 7, k = 50 } = options;

    this.logger.log('Generating recall quality report...');

    // 计算各项指标
    const [recallAtK, coverage] = await Promise.all([
      this.calculateRecallAtK(recallResults, k, days),
      this.calculateCoverage(recallResults),
    ]);

    // 计算多样性（使用所有召回的菜品）
    const allRecalledDishIds = new Set<string>();
    for (const dishIds of recallResults.values()) {
      dishIds.forEach((id) => allRecalledDishIds.add(id));
    }
    const diversity = await this.calculateDiversity(
      Array.from(allRecalledDishIds),
    );

    // 生成摘要
    const summary = this.generateSummary({
      recallAtK: recallAtK.recallAtK,
      coverage: coverage.coverage,
      diversity: diversity.diversity,
    });

    return {
      timestamp: new Date(),
      recallAtK: {
        recallAtK: recallAtK.recallAtK,
        totalUsers: recallAtK.totalUsers,
        hitUsers: recallAtK.hitUsers,
      },
      coverage: {
        coverage: coverage.coverage,
        totalDishes: coverage.totalDishes,
        recalledDishes: coverage.recalledDishes,
      },
      diversity: {
        diversity: diversity.diversity,
        dominantTags: diversity.dominantTags,
      },
      summary,
    };
  }

  /**
   * 生成召回质量摘要
   */
  private generateSummary(metrics: {
    recallAtK: number;
    coverage: number;
    diversity: number;
  }): string {
    const { recallAtK, coverage, diversity } = metrics;

    const lines: string[] = [];

    // Recall@K 评价
    if (recallAtK >= 0.7) {
      lines.push(
        `✅ Recall@K (${(recallAtK * 100).toFixed(1)}%): 优秀 - 召回质量很高`,
      );
    } else if (recallAtK >= 0.5) {
      lines.push(
        `⚠️ Recall@K (${(recallAtK * 100).toFixed(1)}%): 良好 - 有提升空间`,
      );
    } else {
      lines.push(
        `❌ Recall@K (${(recallAtK * 100).toFixed(1)}%): 偏低 - 需要优化召回策略`,
      );
    }

    // Coverage 评价
    if (coverage >= 0.8) {
      lines.push(
        `✅ Coverage (${(coverage * 100).toFixed(1)}%): 优秀 - 能有效推荐长尾菜品`,
      );
    } else if (coverage >= 0.5) {
      lines.push(
        `⚠️ Coverage (${(coverage * 100).toFixed(1)}%): 中等 - 部分菜品曝光不足`,
      );
    } else {
      lines.push(
        `❌ Coverage (${(coverage * 100).toFixed(1)}%): 偏低 - 存在严重的长尾失效`,
      );
    }

    // Diversity 评价
    if (diversity >= 3.0) {
      lines.push(
        `✅ Diversity (${diversity.toFixed(2)}): 优秀 - 推荐结果多样性高`,
      );
    } else if (diversity >= 2.0) {
      lines.push(`⚠️ Diversity (${diversity.toFixed(2)}): 中等 - 推荐略显单一`);
    } else {
      lines.push(
        `❌ Diversity (${diversity.toFixed(2)}): 偏低 - 推荐过于集中于少数标签`,
      );
    }

    return lines.join('\n');
  }
}
