import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { DishesService } from '@/dishes/dishes.service';
import { CanteensService } from '@/canteens/canteens.service';

import { DishSortField } from '@/common/enums';
import { SortOrder } from '@/dishes/dto/get-dishes.dto';

@Injectable()
export class PopularDishesTool implements BaseTool {
  private readonly logger = new Logger(PopularDishesTool.name);

  constructor(
    private readonly dishesService: DishesService,
    private readonly canteensService: CanteensService,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'get_popular_dishes',
      description:
        '获取热门菜品。当用户询问"推荐一些热门菜"、"大家都在吃什么"或"排行榜"时使用。支持按评分或评论数排序。',
      parameters: {
        type: 'object',
        properties: {
          sortBy: {
            type: 'string',
            enum: ['rating', 'reviews'],
            description:
              '排序依据：rating(评分), reviews(评论数)。默认reviews。',
            default: 'reviews',
          },
          canteenId: {
            type: 'string',
            description: '可选。食堂ID。',
          },
          limit: {
            type: 'number',
            description: '返回数量，默认5个',
            default: 5,
          },
        },
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any[]> {
    const { sortBy = 'reviews', canteenId, limit = 5 } = params;

    // Build filter
    const filter: any = {};
    if (canteenId) {
      const resolvedId = await this.canteensService.resolveCanteenId(canteenId);
      if (resolvedId) {
        filter.canteenId = resolvedId;
      } else {
        // 如果既不是有效ID也不是有效名称，使用不存在的ID
        filter.canteenId = 'non-existent-id';
      }
    }

    // Determine sort field
    let sortField = DishSortField.REVIEW_COUNT;
    if (sortBy === 'rating') {
      sortField = DishSortField.AVERAGE_RATING;
    }

    // Get dishes
    const result = await this.dishesService.getDishes(
      {
        isSuggestion: false,
        filter,
        search: { keyword: '', fields: [] },
        sort: {
          field: sortField,
          order: SortOrder.DESC,
        },
        pagination: { page: 1, pageSize: limit },
      },
      context.userId,
    );

    // Convert to dish cards
    return result.data.items;
  }
}
