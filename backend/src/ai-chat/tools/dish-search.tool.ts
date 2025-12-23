import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { DishesService } from '@/dishes/dishes.service';
import { ComponentDishCard } from '../dto/chat.dto';

@Injectable()
export class DishSearchTool implements BaseTool {
  private readonly logger = new Logger(DishSearchTool.name);

  constructor(private readonly dishesService: DishesService) {}

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
            description: '食堂ID',
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
        },
        required: ['keyword'],
      },
    };
  }

  async execute(
    params: any,
    context: ToolContext,
  ): Promise<ComponentDishCard[]> {
    const { keyword, canteenId, priceMin, priceMax, limit = 10 } = params;

    // Build filter
    const filter: any = {};
    if (canteenId) {
      filter.canteenId = canteenId;
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      filter.price = {};
      if (priceMin !== undefined) filter.price.min = priceMin;
      if (priceMax !== undefined) filter.price.max = priceMax;
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
            `Skipping invalid dish in search: ${dish?.id || 'unknown'}`,
          );
          return null;
        }

        const rating =
          dish.averageRating != null && typeof dish.averageRating === 'number'
            ? dish.averageRating.toString()
            : '0';

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
