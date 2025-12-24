import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { UserProfileService } from '@/user-profile/user-profile.service';

@Injectable()
export class MyFavoritesTool implements BaseTool {
  private readonly logger = new Logger(MyFavoritesTool.name);

  constructor(private readonly userProfileService: UserProfileService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'get_my_favorites',
      description:
        '获取用户的收藏菜品。当用户询问"我收藏了什么"、"我的最爱"时使用。',
      parameters: {
        type: 'object',
        properties: {
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
    const { limit = 5 } = params;

    // Get favorites
    // Assuming page 1 for simplicity in chat context
    const result = await this.userProfileService.getMyFavorites(
      context.userId,
      1,
      limit,
    );

    // Convert to dish cards
    return result.data.items;
  }
}
