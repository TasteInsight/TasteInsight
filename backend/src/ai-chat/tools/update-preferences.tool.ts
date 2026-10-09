import { Injectable } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { ComponentPreferenceDraft, PreferencePatch } from '../dto/chat.dto';

type PreferenceToolParams = NonNullable<PreferencePatch['preferences']> &
  Pick<PreferencePatch, 'allergens'>;

@Injectable()
export class UpdatePreferencesTool implements BaseTool {
  constructor(private readonly userProfileService: UserProfileService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'update_preferences',
      scenes: ['general_chat', 'meal_planner'],
      description:
        '生成更新用户的饮食偏好的确认草稿，不会保存任何设置。仅在用户明确要求记住或修改长期偏好时使用，单次用餐条件直接传给查询工具。' +
        '\n列表参数为完整目标列表；新增或删除某项前使用 get_my_preferences 核对现有设置，保留其他项。' +
        '\n工具会显示实际前后值及保存按钮，只有用户确认后才写入；不要把生成草稿表述为已经保存，也不要再用 display_content 展示此草稿。',
      parameters: {
        type: 'object',
        minProperties: 1,
        properties: {
          tagPreferences: {
            type: 'array',
            maxItems: 100,
            uniqueItems: true,
            items: { type: 'string', minLength: 1 },
            description:
              '偏好标签，例如：["清淡", "高蛋白"]。如果用户想添加标签，请获取当前标签并合并。',
          },
          priceRange: {
            type: 'object',
            additionalProperties: false,
            properties: {
              min: { type: 'number', minimum: 0 },
              max: { type: 'number', minimum: 0 },
            },
            required: ['min', 'max'],
            description: '价格范围',
          },
          tastePreferences: {
            type: 'object',
            additionalProperties: false,
            minProperties: 1,
            properties: {
              spicyLevel: {
                type: 'integer',
                minimum: 0,
                maximum: 5,
                description: '辣度 0-5',
              },
              sweetness: {
                type: 'integer',
                minimum: 0,
                maximum: 5,
                description: '甜度 0-5',
              },
              saltiness: {
                type: 'integer',
                minimum: 0,
                maximum: 5,
                description: '咸度 0-5',
              },
              oiliness: {
                type: 'integer',
                minimum: 0,
                maximum: 5,
                description: '油度 0-5',
              },
            },
          },
          avoidIngredients: {
            type: 'array',
            maxItems: 100,
            uniqueItems: true,
            items: { type: 'string', minLength: 1 },
            description: '忌口食材',
          },
          allergens: {
            type: 'array',
            maxItems: 100,
            uniqueItems: true,
            items: { type: 'string', minLength: 1 },
            description: '确认后的完整过敏原列表；空列表表示移除已保存过敏原。',
          },
        },
      },
    };
  }

  async execute(
    params: PreferenceToolParams,
    context: ToolContext,
  ): Promise<ComponentPreferenceDraft> {
    if (
      params.priceRange?.min !== undefined &&
      params.priceRange?.max !== undefined &&
      params.priceRange.min > params.priceRange.max
    ) {
      throw new Error('最低价格不能高于最高价格。');
    }
    const { allergens, ...preferenceFields } = params;
    const preferences = Object.fromEntries(
      Object.entries(preferenceFields).filter(
        ([, value]) => value !== undefined,
      ),
    );
    if (!Object.keys(preferences).length && allergens === undefined) {
      throw new Error('没有可确认的偏好变更。');
    }
    const { data } = await this.userProfileService.getUserProfile(
      context.userId,
    );
    const before: PreferencePatch = {};
    const after: PreferencePatch = {};
    if (Object.keys(preferences).length) {
      before.preferences = structuredClone(
        Object.fromEntries(
          Object.keys(preferences).map((key) => [key, data.preferences[key]]),
        ),
      );
      after.preferences = structuredClone(preferences);
    }
    if (allergens !== undefined) {
      before.allergens = structuredClone(data.allergens);
      after.allergens = structuredClone(allergens);
    }
    return {
      summary: '请核对偏好变更，确认后保存。',
      previewData: { before, after },
      confirmAction: {
        api: '/user/profile',
        method: 'PUT',
        body: structuredClone(after),
      },
    };
  }
}
