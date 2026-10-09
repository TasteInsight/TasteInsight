import { Injectable } from '@nestjs/common';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { BaseTool, ToolContext, ToolDefinition } from './base-tool.interface';

@Injectable()
export class GetMyPreferencesTool implements BaseTool {
  constructor(private readonly userProfileService: UserProfileService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'get_my_preferences',
      description:
        '读取当前用户已保存的饮食偏好和过敏原，不修改数据。用于沿用长期限制，以及在新增或删除偏好前核对已有设置。',
      parameters: { type: 'object', properties: {} },
    };
  }

  async execute(_params: Record<string, never>, context: ToolContext) {
    const { data } = await this.userProfileService.getUserProfile(
      context.userId,
    );
    return { preferences: data.preferences, allergens: data.allergens };
  }
}
