import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { ReviewsService } from '@/reviews/reviews.service';

@Injectable()
export class DishReviewsTool implements BaseTool {
  private readonly logger = new Logger(DishReviewsTool.name);

  constructor(private readonly reviewsService: ReviewsService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'get_dish_reviews',
      description:
        '获取菜品的评价信息。当用户询问"大家怎么评价"、"好不好吃"或查看具体评论时使用。',
      parameters: {
        type: 'object',
        properties: {
          dishId: {
            type: 'string',
            description: '菜品ID',
          },
          limit: {
            type: 'number',
            description: '返回评论数量，默认5条',
            default: 5,
          },
        },
        required: ['dishId'],
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any[]> {
    const { dishId, limit = 5 } = params;

    const result = await this.reviewsService.getReviews(dishId, 1, limit);

    return result.data.items;
  }
}
