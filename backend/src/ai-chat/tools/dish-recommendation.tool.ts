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
        '推荐菜品给用户。必须至少指定餐次（breakfast/lunch/dinner/nightsnack）。可选：食堂ID、价格范围等。示例：推荐午餐，价格10-20元。',
      parameters: {
        type: 'object',
        properties: {
          mealTime: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'nightsnack'],
            description:
              '必填。餐次：breakfast(早餐), lunch(午餐), dinner(晚餐), nightsnack(夜宵)。根据用户描述选择对应的英文值。',
          },
          canteenId: {
            type: 'string',
            description: '可选。食堂ID，仅当用户明确指定食堂时才提供。',
          },
          priceMin: {
            type: 'number',
            description: '可选。最低价格（元），如用户说"10-20元"则为10',
          },
          priceMax: {
            type: 'number',
            description: '可选。最高价格（元），如用户说"10-20元"则为20',
          },
          limit: {
            type: 'number',
            description: '推荐数量，默认5个',
            default: 5,
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '偏好标签，如["清淡", "川菜"]',
          },
          minRating: {
            type: 'number',
            description: '最低评分 (0-5)',
          },
          spicyLevel: {
            type: 'number',
            description:
              '期望辣度 (0-5)，0为未设置/不要求，1-5分别表示微辣到非常辣',
          },
          sweetness: {
            type: 'number',
            description:
              '期望甜度 (0-5)，0为未设置/不要求，1-5分别表示微甜到非常甜',
          },
          saltiness: {
            type: 'number',
            description:
              '期望咸度 (0-5)，0为未设置/不要求，1-5分别表示微咸到非常咸',
          },
          oiliness: {
            type: 'number',
            description:
              '期望油度 (0-5)，0为未设置/不要求，1-5分别表示清淡到非常油',
          },
          meatPreference: {
            type: 'array',
            items: { type: 'string' },
            description: '肉类偏好，如["猪肉", "牛肉", "鸡肉"]',
          },
          avoidIngredients: {
            type: 'array',
            items: { type: 'string' },
            description: '要避免的食材，如["香菜", "葱"]',
          },
          favoriteIngredients: {
            type: 'array',
            items: { type: 'string' },
            description: '喜欢的食材，如["番茄", "土豆"]',
          },
        },
        required: ['mealTime'],
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any[]> {
    const {
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
        `mealTime is required and must be one of: ${validMealTimes.join(', ')}`,
      );
    }

    if (!validMealTimes.includes(mealTime)) {
      throw new Error(
        `Invalid mealTime: ${mealTime}. Must be one of: ${validMealTimes.join(', ')}`,
      );
    }

    // Build filter
    const filter: any = {
      mealTime: [mealTime],
    };
    if (canteenId) {
      const resolvedId = await this.canteensService.resolveCanteenId(canteenId);
      if (resolvedId) {
        filter.canteenId = resolvedId;
      } else {
        // 如果既不是有效ID也不是有效名称，使用不存在的ID确保无结果返回
        filter.canteenId = 'non-existent-id';
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

    // 直接调用推荐服务，使用 GUESS_LIKE 场景（猜你喜欢）
    const result = await this.recommendationService.getRecommendations(
      context.userId,
      {
        scene: RecommendationScene.GUESS_LIKE,
        filter,
        search: { keyword: '' },
        pagination: { page: 1, pageSize: limit },
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
