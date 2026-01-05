import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { UserProfileService } from '@/user-profile/user-profile.service';

@Injectable()
export class MyHistoryTool implements BaseTool {
  private readonly logger = new Logger(MyHistoryTool.name);

  constructor(private readonly userProfileService: UserProfileService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'get_my_history',
      description:
        '获取用户的浏览历史。当用户询问"我最近看了什么"、"历史记录"时使用。',
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

    // Get browse history
    const result = await this.userProfileService.getBrowseHistory(
      context.userId,
      1,
      limit,
    );

    // Convert to dish cards
    return result.data.items;
  }
}
