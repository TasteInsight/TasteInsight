import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { UserProfileService } from '@/user-profile/user-profile.service';

@Injectable()
export class UpdatePreferencesTool implements BaseTool {
  private readonly logger = new Logger(UpdatePreferencesTool.name);

  constructor(private readonly userProfileService: UserProfileService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'update_preferences',
      description:
        '更新用户的饮食偏好。当用户表达对某种食物的喜好、厌恶、过敏或价格要求时使用。',
      parameters: {
        type: 'object',
        properties: {
          tagPreferences: {
            type: 'array',
            items: { type: 'string' },
            description:
              '偏好标签，例如：["清淡", "高蛋白"]。如果用户想添加标签，请获取当前标签并合并。',
          },
          priceRange: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
            },
            description: '价格范围',
          },
          tastePreferences: {
            type: 'object',
            properties: {
              spicyLevel: { type: 'number', description: '辣度 0-5' },
              sweetness: { type: 'number', description: '甜度 0-5' },
              saltiness: { type: 'number', description: '咸度 0-5' },
              oiliness: { type: 'number', description: '油度 0-5' },
            },
          },
          avoidIngredients: {
            type: 'array',
            items: { type: 'string' },
            description: '忌口食材',
          },
          allergens: {
            type: 'array',
            items: { type: 'string' },
            description: '过敏原。注意：这将更新用户的过敏信息。',
          },
        },
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<string> {
    const {
      tagPreferences,
      priceRange,
      tastePreferences,
      avoidIngredients,
      allergens,
    } = params;

    const updateDto: any = {};
    if (tagPreferences || priceRange || tastePreferences || avoidIngredients) {
      updateDto.preferences = {};
      if (tagPreferences) updateDto.preferences.tagPreferences = tagPreferences;
      if (priceRange) updateDto.preferences.priceRange = priceRange;
      if (tastePreferences)
        updateDto.preferences.tastePreferences = tastePreferences;
      if (avoidIngredients)
        updateDto.preferences.avoidIngredients = avoidIngredients;
    }

    if (allergens) {
      updateDto.allergens = allergens;
    }

    await this.userProfileService.updateUserProfile(context.userId, updateDto);

    return 'User preferences updated successfully';
  }
}
