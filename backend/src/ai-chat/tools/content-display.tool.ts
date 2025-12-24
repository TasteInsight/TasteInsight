import { Injectable, Logger } from '@nestjs/common';
import { BaseTool, ToolDefinition, ToolContext } from './base-tool.interface';
import { DishesService } from '@/dishes/dishes.service';
import { CanteensService } from '@/canteens/canteens.service';
import {
  ComponentDishCard,
  ComponentCanteenCard,
  ComponentMealPlanDraft,
} from '../dto/chat.dto';
import { OpeningHoursUtil } from '../utils/opening-hours.util';

@Injectable()
export class ContentDisplayTool implements BaseTool {
  private readonly logger = new Logger(ContentDisplayTool.name);

  constructor(
    private readonly dishesService: DishesService,
    private readonly canteensService: CanteensService,
  ) {}

  getDefinition(): ToolDefinition {
    return {
      name: 'display_content',
      description:
        '向用户展示内容卡片（如菜品、食堂信息）。' +
        '\n使用场景：当你需要通过可视化卡片展示菜品或食堂时调用。' +
        '\n**重要**：此工具不会自动获取数据，必须显式传递参数！' +
        '\n必须基于之前查询工具（如get_canteen_info、search_dishes等）返回的结果，提取其中的id字段组成ids数组。' +
        '\n示例：如果get_canteen_info返回了[{id:"c1",name:"紫荆园"},{id:"c2",name:"桃李园"}]，' +
        '则应调用display_content时传递 {type:"canteen", ids:["c1","c2"]}',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['dish', 'canteen', 'meal_plan'],
            description:
              '【必填】要展示的内容类型：dish(菜品)、canteen(食堂)、meal_plan(膳食计划)',
          },
          ids: {
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              '【必填for dish/canteen】从查询工具返回结果中提取的id字段组成的数组。例如：["id1","id2","id3"]',
          },
          data: {
            type: 'object',
            description: '【仅for meal_plan】复杂的膳食计划数据对象',
          },
        },
        required: ['type'],
      },
    };
  }

  async execute(params: any, context: ToolContext): Promise<any> {
    const { type, ids, data } = params;

    if (!type) {
      throw new Error(
        '缺少参数 "type"。必须指定要展示的内容类型（dish、canteen 或 meal_plan）。',
      );
    }

    if (type === 'dish') {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error(
          '缺少或无效的参数 "ids"（类型为 "dish"）。请提供从搜索结果中获取的菜品ID数组。',
        );
      }
      return this.getDishCards(ids, context.userId);
    } else if (type === 'canteen') {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error(
          '缺少或无效的参数 "ids"（类型为 "canteen"）。请提供从查询结果中获取的食堂ID数组。',
        );
      }
      return this.getCanteenCards(ids);
    } else if (type === 'meal_plan') {
      if (!data) {
        throw new Error(
          '缺少参数 "data"（类型为 "meal_plan"）。请提供用餐计划对象。',
        );
      }
      return this.getMealPlanCards(data);
    } else {
      throw new Error(
        `无效的类型 "${type}"。允许的值为：dish、canteen、meal_plan。`,
      );
    }

    return [];
  }

  private async getDishCards(
    ids: string[],
    userId: string,
  ): Promise<ComponentDishCard[]> {
    const cards: ComponentDishCard[] = [];

    // 使用批量获取方法，一次查询获取所有菜品
    const result = await this.dishesService.getDishesByIds(ids, userId);
    const dishes = result.data.items;

    for (const dish of dishes) {
      const rating =
        dish.averageRating != null && typeof dish.averageRating === 'number'
          ? dish.averageRating.toString()
          : '0';

      cards.push({
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
      });
    }

    return cards;
  }

  private async getCanteenCards(
    ids: string[],
  ): Promise<ComponentCanteenCard[]> {
    const cards: ComponentCanteenCard[] = [];

    // 使用批量获取方法，一次查询获取所有食堂
    const result = await this.canteensService.getCanteensByIds(ids);
    const canteens = result.data.items;

    for (const canteen of canteens) {
      cards.push({
        id: canteen.id,
        name: canteen.name,
        status: OpeningHoursUtil.getStatus(canteen.openingHours),
        averageRating: canteen.averageRating || 0,
        image: canteen.images?.[0] || '',
        linkAction: {
          type: 'navigate',
          page: 'canteen_detail',
          params: { id: canteen.id },
        },
      });
    }

    return cards;
  }

  private getMealPlanCards(data: any): ComponentMealPlanDraft[] {
    // Validate that data is a valid meal plan object
    if (!data || typeof data !== 'object') {
      return [];
    }

    // Return the meal plan as an array of cards
    // The data should already be in the correct ComponentMealPlanDraft format
    return [data];
  }
}
