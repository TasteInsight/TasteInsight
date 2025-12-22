import { Injectable } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { PrismaService } from '@/prisma.service';
import { ComponentMealPlanDraft } from '../dto/chat.dto';

interface MealPlanParams {
  days?: number; // 规划天数，默认7天
  budget?: number; // 每天预算
  preferences?: string[]; // 饮食偏好
  excludeAllergens?: boolean; // 是否排除过敏原
}

@Injectable()
export class MealPlanningTool implements BaseTool {
  constructor(private readonly prisma: PrismaService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'generate_meal_plan',
      description:
        '为用户生成膳食计划。可以指定天数、预算、饮食偏好等。会考虑营养均衡、价格合理、多样化等因素。',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: '规划天数，默认7天（一周）',
            default: 7,
          },
          budget: {
            type: 'number',
            description: '每天预算（元），不指定则不限制',
          },
          preferences: {
            type: 'array',
            items: { type: 'string' },
            description: '饮食偏好标签，如["清淡", "高蛋白", "素食"]',
          },
          excludeAllergens: {
            type: 'boolean',
            description: '是否排除用户的过敏原，默认true',
            default: true,
          },
        },
      },
    };
  }

  async execute(
    params: MealPlanParams,
    context: ToolContext,
  ): Promise<ComponentMealPlanDraft[]> {
    const {
      days = 7,
      budget,
      preferences = [],
      excludeAllergens = true,
    } = params;

    // 获取用户信息和偏好
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      include: {
        preferences: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // 构建过滤条件
    const allergens = excludeAllergens ? user.allergens : [];
    const userPreferences = user.preferences?.tagPreferences || [];
    const allPreferences = [...userPreferences, ...preferences];

    // 为每一天生成餐次计划
    const mealTimes = ['breakfast', 'lunch', 'dinner'];
    const planSummary: string[] = [];
    let totalEstimatedCost = 0;

    for (let day = 1; day <= days; day++) {
      const dayPlan: string[] = [];
      let dayCost = 0;

      for (const mealTime of mealTimes) {
        // 查询适合的菜品
        const dishes = await this.prisma.dish.findMany({
          where: {
            status: 'online',
            availableMealTime: { has: mealTime },
            ...(allergens.length > 0 && {
              NOT: {
                allergens: { hasSome: allergens },
              },
            }),
            ...(budget && {
              price: { lte: budget / 3 }, // 每餐预算为总预算的1/3
            }),
          },
          take: 50,
          orderBy: { averageRating: 'desc' },
        });

        if (dishes.length === 0) continue;

        // 随机选择一道菜（考虑评分权重）
        const selectedDish = this.weightedRandomSelect(dishes);
        dayCost += selectedDish.price;

        const mealTimeNames = {
          breakfast: '早餐',
          lunch: '午餐',
          dinner: '晚餐',
        };

        dayPlan.push(
          `${mealTimeNames[mealTime]}：${selectedDish.name}（${selectedDish.canteenName} - ¥${selectedDish.price}）`,
        );
      }

      totalEstimatedCost += dayCost;
      planSummary.push(
        `**第${day}天** (预计 ¥${dayCost.toFixed(1)})\n${dayPlan.join('\n')}`,
      );
    }

    // 生成计划摘要
    const summary = `
📅 **${days}天膳食计划**

${planSummary.join('\n\n')}

---
💰 **总预算**: 约 ¥${totalEstimatedCost.toFixed(1)}
📊 **平均每天**: ¥${(totalEstimatedCost / days).toFixed(1)}
${budget ? `\n✅ 符合每天 ¥${budget} 的预算要求` : ''}
    `.trim();

    return [
      {
        summary,
        previewData: {
          days,
          totalCost: totalEstimatedCost,
          avgDailyCost: totalEstimatedCost / days,
        },
        confirmAction: {
          api: '/meal-plans',
          method: 'POST',
          body: {
            name: `AI生成的${days}天膳食计划`,
            days,
          },
        },
      },
    ];
  }

  /**
   * 根据评分权重随机选择菜品
   */
  private weightedRandomSelect(dishes: any[]): any {
    // 空数组检查
    if (!dishes || dishes.length === 0) {
      throw new Error('Cannot select from empty dishes array');
    }

    // 如果只有一个菜品，直接返回
    if (dishes.length === 1) {
      return dishes[0];
    }

    // 计算权重（评分越高权重越大）
    // 使用 Math.max 确保最小权重为 1，避免 totalWeight 为 0
    const weights = dishes.map((d) => {
      const rating =
        d.averageRating != null && typeof d.averageRating === 'number'
          ? d.averageRating
          : 3; // 默认评分 3
      return Math.max(Math.pow(rating, 2), 1); // 最小权重为 1
    });
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // 如果 totalWeight 为 0（理论上不应该发生，因为最小权重为 1），使用均匀随机
    if (totalWeight === 0) {
      return dishes[Math.floor(Math.random() * dishes.length)];
    }

    // 随机选择
    let random = Math.random() * totalWeight;
    for (let i = 0; i < dishes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return dishes[i];
      }
    }

    // 回退：返回最后一个菜品（理论上不应该到达这里）
    return dishes[dishes.length - 1];
  }
}
