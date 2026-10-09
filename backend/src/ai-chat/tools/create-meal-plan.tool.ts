import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { DishesService } from '@/dishes/dishes.service';
import { RecommendationService } from '@/recommendation/recommendation.service';

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

  constructor(
    private readonly dishesService: DishesService,
    private readonly recommendationService: RecommendationService,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'create_meal_plan',
      scenes: ['general_chat', 'meal_planner'],
      description:
        '创建一份可确认的用餐计划草稿，不会直接保存计划。先用 recommend_dishes 或 search_dishes 查询真实菜品，再选择同一食堂内通常1-2个菜品。' +
        '\n多个食堂的推荐是互相替代的方案；每个食堂方案应分别创建草稿，不能把所有候选放进同一顿饭。' +
        '\n只有用户明确要求跨食堂组合时才设置 allowCrossCanteen=true。整顿饭的预算通过 totalBudget 传入，不能把单道菜的价格范围当作整餐预算。' +
        '\n根据实际菜品名称、食材、价格和餐次搭配，不要拼接多个套餐或编造营养数据。本工具会校验食堂、供应、过敏原和已保存忌口。' +
        '\n使用 display_content(type="meal_plan", data=<本工具完整结果>) 展示草稿，保留其中的 constraints 和确认数据。',
      parameters: {
        type: 'object',
        properties: {
          dishIds: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            uniqueItems: true,
            items: { type: 'string', minLength: 1 },
            description:
              '【必填】你选择的菜品ID列表。请确保所有菜品来自同一个食堂（除非用户另有要求），且组合合理（避免多个主食）。',
          },
          startDate: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description:
              '【必填】计划开始日期，格式：YYYY-MM-DD。如果用户说"今天"、"明天"等，需要根据当前时间转换为具体日期。',
          },
          endDate: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
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
              '可选。根据日期、食堂和真实菜品描述计划，不编造营养数据；不提供时自动生成。',
          },
          totalBudget: {
            type: 'number',
            minimum: 0,
            description:
              '可选。用户明确指定的整顿饭总预算（元），按所有选中菜品价格之和校验。',
          },
          allowCrossCanteen: {
            type: 'boolean',
            default: false,
            description:
              '仅在用户明确要求一顿饭跨食堂取餐时设为true；比较多个食堂的备选方案时保持false。',
          },
        },
        required: ['dishIds', 'startDate', 'endDate', 'mealTime'],
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any> {
    const {
      dishIds,
      startDate,
      endDate,
      mealTime,
      summary,
      totalBudget,
      allowCrossCanteen,
    } = params;

    // 验证必填参数
    if (
      !Array.isArray(dishIds) ||
      dishIds.length === 0 ||
      dishIds.some((id) => typeof id !== 'string' || !id)
    ) {
      throw new Error(
        '缺少有效的菜品ID列表。请先查询候选菜品，再从同一食堂选择通常1-2个菜品。',
      );
    }
    const selectedIds = [...new Set<string>(dishIds)];

    // 验证日期格式
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      throw new Error('日期无效。请使用有效的 YYYY-MM-DD 日期。');
    }
    if (endDate < startDate) {
      throw new Error('结束日期不能早于开始日期。');
    }
    if (
      totalBudget !== undefined &&
      (typeof totalBudget !== 'number' ||
        !Number.isFinite(totalBudget) ||
        totalBudget < 0)
    ) {
      throw new Error('整餐预算必须为非负金额。');
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
      selectedIds,
      context.userId,
    );
    const dishes = dishesResult.data.items;

    if (dishes.length !== selectedIds.length) {
      throw new Error('部分指定菜品不存在。请重新查询菜品后创建计划。');
    }
    if (
      dishes.some(
        (dish) =>
          dish.status !== 'online' ||
          !dish.availableMealTime.includes(mealTime),
      )
    ) {
      throw new Error('所选菜品当前不供应该餐次。请重新查询可供应的菜品。');
    }
    if (
      allowCrossCanteen !== true &&
      new Set(dishes.map((dish) => dish.canteenId)).size > 1
    ) {
      throw new Error(
        '一顿饭的菜品必须来自同一个食堂。请将不同食堂的备选方案分别创建计划。',
      );
    }
    const features = await this.recommendationService.getUserFeaturesWithCache(
      context.userId,
    );
    if (
      dishes.some(
        (dish) =>
          dish.allergens.some((allergen) =>
            features.allergens.includes(allergen),
          ) ||
          dish.ingredients.some((ingredient) =>
            features.preferences?.avoidIngredients.includes(ingredient),
          ),
      )
    ) {
      throw new Error('所选菜品包含已保存的过敏原或忌口食材。请选择其他菜品。');
    }
    const totalPrice = dishes.reduce(
      (sum, dish) => sum + Math.round(dish.price * 100),
      0,
    );
    if (
      totalBudget !== undefined &&
      totalPrice > Math.round(totalBudget * 100)
    ) {
      throw new Error(
        `所选菜品总价${(totalPrice / 100).toFixed(2)}元，超过整餐预算${totalBudget}元。请重新搭配。`,
      );
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
          priceUnit: dish.priceUnit,
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
          dishes: selectedIds,
        },
      },
      ...(totalBudget !== undefined || allowCrossCanteen === true
        ? {
            constraints: {
              ...(totalBudget !== undefined ? { totalBudget } : {}),
              ...(allowCrossCanteen === true
                ? { allowCrossCanteen: true }
                : {}),
            },
          }
        : {}),
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
    return (
      !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString
    );
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
