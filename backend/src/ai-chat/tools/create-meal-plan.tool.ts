import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { DishesService } from '@/dishes/dishes.service';

/**
 * 创建用餐计划工具
 *
 * 此工具帮助AI创建符合前端要求的用餐计划数据结构
 * AI需要先使用其他工具（如 search_dishes、recommend_dishes）获取菜品列表，
 * 然后从中选择合适的菜品，将菜品ID传递给本工具以生成计划。
 *
 * 返回的数据格式符合 ComponentMealPlanDraft 接口
 */
@Injectable()
export class CreateMealPlanTool implements BaseTool {
  private readonly logger = new Logger(CreateMealPlanTool.name);

  constructor(private readonly dishesService: DishesService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'create_meal_plan',
      description:
        '创建用餐计划。用于为用户生成一份用餐计划。' +
        '\\n**重要**：你需要先调用 search_dishes 或 recommend_dishes 获取候选菜品，' +
        '\\n然后根据用户需求从中选择合适的菜品（2-3个），将菜品ID传给本工具。' +
        '\\n本工具会生成完整的计划数据，之后需要用 display_content 展示给用户。' +
        '\\n\\n使用流程示例：' +
        '\\n1. 用户：帮我安排明天的午餐，清淡高蛋白' +
        '\\n2. 调用 recommend_dishes(mealTime="lunch", tags=["清淡","高蛋白"])' +
        '\\n3. 从返回的菜品中选择2-3个（比如 dish_10001, dish_10002）' +
        '\\n4. 调用 create_meal_plan(dishIds=["dish_10001","dish_10002"], ...)' +
        '\\n5. 调用 display_content(type="meal_plan", data=<上一步返回的结果>)',
      parameters: {
        type: 'object',
        properties: {
          dishIds: {
            type: 'array',
            items: { type: 'string' },
            description:
              '【必填】你选择的菜品ID列表。需要先调用其他工具获取候选菜品，然后从中选择2-3个合适的菜品。',
          },
          startDate: {
            type: 'string',
            description:
              '【必填】计划开始日期，格式：YYYY-MM-DD。如果用户说"今天"、"明天"等，需要根据当前时间转换为具体日期。',
          },
          endDate: {
            type: 'string',
            description:
              '【必填】计划结束日期，格式：YYYY-MM-DD。如果是单日计划，与 startDate 相同。',
          },
          mealTime: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'nightsnack'],
            description:
              '【必填】餐次：breakfast(早餐), lunch(午餐), dinner(晚餐), nightsnack(夜宵)。',
          },
          summary: {
            type: 'string',
            description:
              '【可选】计划摘要。如果不提供，将自动生成。建议格式："为你安排了X月X日午餐，偏清淡高蛋白，控制油脂摄入。"',
          },
        },
        required: ['dishIds', 'startDate', 'endDate', 'mealTime'],
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any> {
    const { dishIds, startDate, endDate, mealTime, summary } = params;

    // 验证必填参数
    if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
      throw new Error(
        '缺少菜品ID列表。请先使用 recommend_dishes 或 search_dishes 获取候选菜品，然后从中选择2-3个菜品传递给本工具。',
      );
    }

    // 验证日期格式
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      throw new Error('日期格式无效。请使用 YYYY-MM-DD 格式，例如：2025-12-24');
    }

    // 验证餐次
    const validMealTimes = ['breakfast', 'lunch', 'dinner', 'nightsnack'];
    if (!validMealTimes.includes(mealTime)) {
      throw new Error(
        `无效的餐次：${mealTime}。必须是以下之一：${validMealTimes.join(', ')}`,
      );
    }

    this.logger.debug(
      `Creating meal plan: ${startDate} to ${endDate}, ${mealTime}, ${dishIds.length} dishes`,
    );

    // 获取完整的菜品信息
    const dishesResult = await this.dishesService.getDishesByIds(
      dishIds,
      context.userId,
    );
    const dishes = dishesResult.data.items;

    if (dishes.length === 0) {
      throw new Error('未找到指定的菜品。请检查菜品ID是否正确。');
    }

    // 生成或使用提供的摘要
    const finalSummary =
      summary || this.generateSummary(startDate, endDate, mealTime, dishes);

    // 构建返回的计划数据（符合 ComponentMealPlanDraft 格式）
    const mealPlan = {
      summary: finalSummary,
      previewData: {
        startDate,
        endDate,
        mealTime,
        dishes: dishes.map((dish) => ({
          id: dish.id,
          name: dish.name,
          images: dish.images || [],
          canteenId: dish.canteenId,
          canteenName: dish.canteenName,
          windowId: dish.windowId,
          windowName: dish.windowName,
          price: dish.price,
          averageRating: dish.averageRating,
          allergens: dish.allergens || [],
          tags: dish.tags || [],
        })),
      },
      confirmAction: {
        api: '/meal-plans',
        method: 'POST',
        body: {
          startDate,
          endDate,
          mealTime,
          dishes: dishIds,
        },
      },
    };

    return mealPlan;
  }

  /**
   * 验证日期格式 YYYY-MM-DD
   */
  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 自动生成用餐计划摘要
   */
  private generateSummary(
    startDate: string,
    endDate: string,
    mealTime: string,
    dishes: any[],
  ): string {
    const mealTimeNames = {
      breakfast: '早餐',
      lunch: '午餐',
      dinner: '晚餐',
      nightsnack: '夜宵',
    };

    const mealTimeName = mealTimeNames[mealTime] || mealTime;
    const dateStr =
      startDate === endDate ? startDate : `${startDate}至${endDate}`;

    // 从菜品中提取标签
    const allTags = new Set<string>();
    dishes.forEach((dish) => {
      if (dish.tags && Array.isArray(dish.tags)) {
        dish.tags.forEach((tag) => allTags.add(tag));
      }
    });

    // 构建摘要
    let summary = `为你安排了${dateStr}${mealTimeName}`;

    if (allTags.size > 0) {
      const tagList = Array.from(allTags).slice(0, 3); // 最多显示3个标签
      summary += `，${tagList.join('、')}`;
    }

    summary += '。';

    return summary;
  }
}
