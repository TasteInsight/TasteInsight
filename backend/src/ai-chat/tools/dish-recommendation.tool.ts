import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { DishesService } from '@/dishes/dishes.service';
import { CanteensService } from '@/canteens/canteens.service';
import { RecommendationScene } from '@/recommendation/constants/recommendation.constants';

@Injectable()
export class DishRecommendationTool implements BaseTool {
  private readonly logger = new Logger(DishRecommendationTool.name);

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly dishesService: DishesService,
    private readonly canteensService: CanteensService,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'recommend_dishes',
      description:
        '按真实菜品数据和已保存偏好推荐某个餐次的候选菜品；自动排除已保存过敏原和忌口。' +
        '\nscene 默认 guess_like（猜你喜欢）；查找相似菜品或替代品时使用 similar 并提供真实 triggerDishId，今日推荐使用 today。excludeDishIds 用于换一批候选或排除已选菜品；similar 自动排除来源菜品。' +
        '\n未限定食堂时返回多个食堂的备选菜品，按食堂分组；不同食堂是互相替代的用餐地点，不能合并成一顿饭。' +
        '\n组合中的配菜不足时，使用返回的 canteenId 再查询该食堂。用户已指定食堂时仅查询该食堂。' +
        '\npriceMin/priceMax 筛选单道菜价格，整餐预算仍需按所选菜品价格求和，并传给 create_meal_plan 的 totalBudget。' +
        '\n只依据返回的名称、食材、口味、价格、餐次和评价说明推荐理由；没有营养数据时不可声称精确热量或蛋白质。结果为空时说明限制，不自行放宽食堂、预算或忌口。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          scene: {
            type: 'string',
            enum: [
              RecommendationScene.GUESS_LIKE,
              RecommendationScene.SIMILAR,
              RecommendationScene.TODAY,
            ],
            default: RecommendationScene.GUESS_LIKE,
            description:
              '推荐场景：guess_like(猜你喜欢，默认)、similar(相似菜品/替代品)、today(今日推荐)。',
          },
          triggerDishId: {
            type: 'string',
            minLength: 1,
            description:
              '仅用于 similar，且该场景必填。用于查找相似菜品的真实菜品ID，先查询确认；来源菜品自动排除。',
          },
          excludeDishIds: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            maxItems: 100,
            uniqueItems: true,
            description:
              '可选。排除的真实菜品ID；换一批时提供上一批候选，替换某道菜时排除已选菜品。',
          },
          mealTime: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'nightsnack'],
            description:
              '必填。餐次：breakfast(早餐), lunch(午餐), dinner(晚餐), nightsnack(夜宵)。根据用户描述选择对应的英文值。',
          },
          canteenId: {
            type: 'string',
            minLength: 1,
            description:
              '可选。食堂ID或名称；用户限定地点或为已选食堂补充同餐配菜时提供。',
          },
          priceMin: {
            type: 'number',
            minimum: 0,
            description: '可选。最低价格（元），如用户说"10-20元"则为10',
          },
          priceMax: {
            type: 'number',
            minimum: 0,
            description: '可选。最高价格（元），如用户说"10-20元"则为20',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: '推荐数量，默认5个',
            default: 5,
          },
          tags: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            maxItems: 100,
            uniqueItems: true,
            description: '偏好标签，如["清淡", "川菜"]',
          },
          minRating: {
            type: 'number',
            minimum: 0,
            maximum: 5,
            description: '最低评分 (0-5)',
          },
          spicyLevel: {
            type: 'integer',
            minimum: 0,
            maximum: 5,
            description:
              '期望辣度 (0-5)，0为未设置/不要求，1-5分别表示微辣到非常辣',
          },
          sweetness: {
            type: 'integer',
            minimum: 0,
            maximum: 5,
            description:
              '期望甜度 (0-5)，0为未设置/不要求，1-5分别表示微甜到非常甜',
          },
          saltiness: {
            type: 'integer',
            minimum: 0,
            maximum: 5,
            description:
              '期望咸度 (0-5)，0为未设置/不要求，1-5分别表示微咸到非常咸',
          },
          oiliness: {
            type: 'integer',
            minimum: 0,
            maximum: 5,
            description:
              '期望油度 (0-5)，0为未设置/不要求，1-5分别表示清淡到非常油',
          },
          meatPreference: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            maxItems: 100,
            uniqueItems: true,
            description: '肉类偏好，如["猪肉", "牛肉", "鸡肉"]',
          },
          avoidIngredients: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            maxItems: 100,
            uniqueItems: true,
            description: '要避免的食材，如["香菜", "葱"]',
          },
          favoriteIngredients: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            maxItems: 100,
            uniqueItems: true,
            description: '喜欢的食材，如["番茄", "土豆"]',
          },
        },
        required: ['mealTime'],
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any[]> {
    const {
      scene = RecommendationScene.GUESS_LIKE,
      triggerDishId,
      excludeDishIds,
      mealTime,
      canteenId,
      priceMin,
      priceMax,
      limit = 5,
      tags,
      minRating,
      spicyLevel,
      sweetness,
      saltiness,
      oiliness,
      meatPreference,
      avoidIngredients,
      favoriteIngredients,
    } = params;

    // Validate mealTime value
    const validMealTimes = ['breakfast', 'lunch', 'dinner', 'nightsnack'];

    // Validate required parameter
    if (!mealTime) {
      throw new Error(
        `mealTime 是必填参数，必须是以下之一：${validMealTimes.join(', ')}`,
      );
    }

    if (!validMealTimes.includes(mealTime)) {
      throw new Error(
        `无效的 mealTime: ${mealTime}。必须是以下之一：${validMealTimes.join(', ')}`,
      );
    }

    if (
      priceMin !== undefined &&
      priceMax !== undefined &&
      priceMin > priceMax
    ) {
      throw new Error('priceMin 必须小于或等于 priceMax');
    }
    if (scene === RecommendationScene.SIMILAR && !triggerDishId) {
      throw new Error('similar 场景必须提供真实菜品ID triggerDishId');
    }
    if (triggerDishId && scene !== RecommendationScene.SIMILAR) {
      throw new Error('triggerDishId 仅能用于 similar 场景');
    }
    if (scene === RecommendationScene.SIMILAR) {
      const source = await this.dishesService.getDishesByIds(
        [triggerDishId],
        context.userId,
      );
      if (!source.data.items.some((dish) => dish.id === triggerDishId)) {
        throw new Error(
          `用于相似推荐的菜品 ${triggerDishId} 不存在，请先查询真实菜品ID`,
        );
      }
    }

    // Build filter
    const filter: any = {
      mealTime: [mealTime],
    };
    if (excludeDishIds?.length) {
      filter.excludeDishIds = excludeDishIds;
    }
    if (canteenId) {
      const resolvedId = await this.canteensService.resolveCanteenId(canteenId);
      if (resolvedId) {
        filter.canteenId = [resolvedId];
      } else {
        // 如果既不是有效ID也不是有效名称，使用不存在的ID确保无结果返回
        filter.canteenId = ['non-existent-id'];
      }
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      filter.price = {};
      if (priceMin !== undefined) filter.price.min = priceMin;
      if (priceMax !== undefined) filter.price.max = priceMax;
    }
    if (minRating !== undefined) {
      filter.rating = { min: minRating, max: 5 };
    }
    if (tags && tags.length > 0) {
      filter.tag = tags;
    }
    if (spicyLevel !== undefined && spicyLevel > 0) {
      // 使用±1的范围提供一定灵活性
      filter.spicyLevel = {
        min: Math.max(1, spicyLevel - 1),
        max: Math.min(5, spicyLevel + 1),
      };
    }
    if (sweetness !== undefined && sweetness > 0) {
      filter.sweetness = {
        min: Math.max(1, sweetness - 1),
        max: Math.min(5, sweetness + 1),
      };
    }
    if (saltiness !== undefined && saltiness > 0) {
      filter.saltiness = {
        min: Math.max(1, saltiness - 1),
        max: Math.min(5, saltiness + 1),
      };
    }
    if (oiliness !== undefined && oiliness > 0) {
      filter.oiliness = {
        min: Math.max(1, oiliness - 1),
        max: Math.min(5, oiliness + 1),
      };
    }
    if (meatPreference && meatPreference.length > 0) {
      filter.meatPreference = meatPreference;
    }
    if (avoidIngredients && avoidIngredients.length > 0) {
      filter.avoidIngredients = avoidIngredients;
    }
    if (favoriteIngredients && favoriteIngredients.length > 0) {
      filter.favoriteIngredients = favoriteIngredients;
    }

    // 调用统一推荐服务
    const result = await this.recommendationService.getRecommendations(
      context.userId,
      {
        scene,
        ...(triggerDishId ? { triggerDishId } : {}),
        filter,
        search: { keyword: '' },
        pagination: { page: 1, pageSize: limit },
        userContext: { diversifyCanteens: !canteenId },
      },
    );

    // 推荐服务只返回ID列表，需要转换为完整的菜品信息
    // 使用批量获取方法一次性获取所有菜品
    const dishIds = result.data.items.map((item) => item.id);

    if (dishIds.length === 0) {
      return [];
    }

    // 批量获取完整的菜品信息
    const dishesResult = await this.dishesService.getDishesByIds(
      dishIds,
      context.userId,
    );

    return dishesResult.data.items;
  }
}
