import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { DishesService } from '@/dishes/dishes.service';
import { CanteensService } from '@/canteens/canteens.service';

@Injectable()
export class DishSearchTool implements BaseTool {
  private readonly logger = new Logger(DishSearchTool.name);

  constructor(
    private readonly dishesService: DishesService,
    private readonly canteensService: CanteensService,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'search_dishes',
      description:
        '搜索菜品。可以通过关键词搜索菜品名称、标签、食材等。支持过滤条件如食堂、价格范围等。',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词，可以是菜品名称、标签、食材等',
          },
          canteenId: {
            type: 'string',
            description: '食堂ID或名称（如“紫荆园”、“桃李园”）',
          },
          priceMin: {
            type: 'number',
            description: '最低价格',
          },
          priceMax: {
            type: 'number',
            description: '最高价格',
          },
          limit: {
            type: 'number',
            description: '返回数量，默认10个',
            default: 10,
          },
          sortField: {
            type: 'string',
            enum: ['price', 'rating', 'reviews'],
            description: '排序字段：price(价格), rating(评分), reviews(评论数)',
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: '排序顺序：asc(升序), desc(降序)。默认降序。',
            default: 'desc',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签筛选，如["清淡", "川菜"]',
          },
          minRating: {
            type: 'number',
            description: '最低评分 (0-5)',
          },
          mealTime: {
            type: 'array',
            items: { type: 'string' },
            description: '适用餐次: breakfast, lunch, dinner, late_night',
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
        required: ['keyword'],
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any[]> {
    const {
      keyword,
      canteenId,
      priceMin,
      priceMax,
      limit = 10,
      sortField,
      sortOrder,
      tags,
      minRating,
      mealTime,
      spicyLevel,
      sweetness,
      saltiness,
      oiliness,
      meatPreference,
      avoidIngredients,
      favoriteIngredients,
    } = params;

    // Build filter
    const filter: any = {};
    // Resolve canteen ID if necessary
    if (canteenId) {
      const resolvedId = await this.canteensService.resolveCanteenId(canteenId);
      if (resolvedId) {
        filter.canteenId = [resolvedId];
      } else {
        // 如果既不是有效ID也不是有效名称，使用不存在的ID确保无结果返回
        this.logger.warn(`食堂ID或名称无效: ${canteenId}`);
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
    if (mealTime && mealTime.length > 0) {
      filter.mealTime = mealTime;
    }
    if (spicyLevel !== undefined && spicyLevel > 0) {
      filter.spicyLevel = {
        min: Math.max(1, spicyLevel),
        max: Math.min(5, spicyLevel),
      };
    }
    if (sweetness !== undefined && sweetness > 0) {
      filter.sweetness = {
        min: Math.max(1, sweetness),
        max: Math.min(5, sweetness),
      };
    }
    if (saltiness !== undefined && saltiness > 0) {
      filter.saltiness = {
        min: Math.max(1, saltiness),
        max: Math.min(5, saltiness),
      };
    }
    if (oiliness !== undefined && oiliness > 0) {
      filter.oiliness = {
        min: Math.max(1, oiliness),
        max: Math.min(5, oiliness),
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

    // Build sort
    const sort: any = {};
    if (sortField) {
      sort.field = sortField;
    }
    if (sortOrder) {
      sort.order = sortOrder;
    }

    // Search dishes
    const result = await this.dishesService.getDishes(
      {
        isSuggestion: false,
        filter,
        search: {
          keyword,
          fields: ['name', 'tags', 'ingredients'],
        },
        sort,
        pagination: { page: 1, pageSize: limit },
      },
      context.userId,
    );

    // Convert to dish cards
    return result.data.items;
  }
}
