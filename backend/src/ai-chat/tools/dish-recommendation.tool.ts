import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { DishesService } from '@/dishes/dishes.service';
import { ComponentDishCard } from '../dto/chat.dto';

@Injectable()
export class DishRecommendationTool implements BaseTool {
  private readonly logger = new Logger(DishRecommendationTool.name);

  constructor(private readonly dishesService: DishesService) {}

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
        },
        required: ['mealTime'],
      },
    };
  }

  async execute(
    params: any,
    context: ToolContext,
  ): Promise<ComponentDishCard[]> {
    const { mealTime, canteenId, priceMin, priceMax, limit = 5 } = params;

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
      filter.canteenId = canteenId;
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      filter.price = {};
      if (priceMin !== undefined) filter.price.min = priceMin;
      if (priceMax !== undefined) filter.price.max = priceMax;
    }

    // Get recommendations using suggestion mode
    const result = await this.dishesService.getDishes(
      {
        isSuggestion: true,
        filter,
        search: { keyword: '', fields: [] },
        sort: {},
        pagination: { page: 1, pageSize: limit },
      },
      context.userId,
    );

    // Convert to dish cards
    const dishCards: ComponentDishCard[] = result.data.items
      .map((dish) => {
        // Validate dish has required fields
        if (!dish || !dish.id || !dish.name) {
          this.logger.warn(
            `Skipping invalid dish in recommendation: ${dish?.id || 'unknown'}`,
          );
          return null;
        }

        const rating =
          dish.averageRating != null && typeof dish.averageRating === 'number'
            ? dish.averageRating.toString()
            : '0';
        const ratingDisplay =
          dish.averageRating != null && typeof dish.averageRating === 'number'
            ? dish.averageRating.toFixed(1)
            : '暂无';

        return {
          dish: {
            id: dish.id,
            name: dish.name,
            image: dish.images?.[0] || '',
            rating,
            tags: dish.tags || [],
          },
          canteenName: dish.canteenName || '',
          windowName: dish.windowName || '',
          recommendReason: `评分 ${ratingDisplay}`,
          linkAction: {
            type: 'navigate',
            page: 'dish_detail',
            params: { id: dish.id },
          },
        } as ComponentDishCard;
      })
      .filter((card) => card !== null);

    return dishCards;
  }
}
