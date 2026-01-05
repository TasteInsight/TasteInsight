import { Injectable } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { CanteensService } from '@/canteens/canteens.service';

@Injectable()
export class CanteenInfoTool implements BaseTool {
  constructor(private readonly canteensService: CanteensService) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'get_canteen_info',
      description:
        '获取食堂信息。如果用户询问"有哪些食堂"或"所有食堂"，调用此工具时不提供任何参数即可获取所有食堂列表。如果用户指定了某个食堂，则提供canteenId参数。',
      parameters: {
        type: 'object',
        properties: {
          canteenId: {
            type: 'string',
            description:
              '可选。食堂ID，仅当用户询问特定食堂时才提供。留空则返回所有食堂。',
          },
        },
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any[]> {
    const { canteenId } = params;

    if (canteenId) {
      // Get specific canteen
      const response = await this.canteensService.getCanteenById(canteenId);
      const canteen = response.data;
      return [canteen];
    } else {
      // Get all canteens
      const response = await this.canteensService.getCanteens(1, 100);

      return response.data.items;
    }
  }
}
