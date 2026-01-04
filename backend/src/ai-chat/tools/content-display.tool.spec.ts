import { Test, TestingModule } from '@nestjs/testing';
import { ContentDisplayTool } from './content-display.tool';
import { DishesService } from '@/dishes/dishes.service';
import { CanteensService } from '@/canteens/canteens.service';

const mockDishesService = {
  getDishesByIds: jest.fn(),
};

const mockCanteensService = {
  getCanteensByIds: jest.fn(),
};

describe('ContentDisplayTool', () => {
  let tool: ContentDisplayTool;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentDisplayTool,
        {
          provide: DishesService,
          useValue: mockDishesService,
        },
        {
          provide: CanteensService,
          useValue: mockCanteensService,
        },
      ],
    }).compile();

    tool = module.get<ContentDisplayTool>(ContentDisplayTool);
  });

  describe('getDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('display_content');
      expect(definition.description).toContain('展示内容卡片');
      expect(definition.parameters.properties).toHaveProperty('type');
      expect(definition.parameters.properties).toHaveProperty('ids');
      expect(definition.parameters.properties).toHaveProperty('data');
      expect(definition.parameters.required).toContain('type');
    });

    it('should have valid type enum values', () => {
      const definition = tool.getDefinition();
      const typeEnum = definition.parameters.properties.type.enum;

      expect(typeEnum).toContain('dish');
      expect(typeEnum).toContain('canteen');
      expect(typeEnum).toContain('meal_plan');
    });
  });

  describe('execute', () => {
    const mockContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      localTime: '2025-01-01',
    };

    describe('dish type', () => {
      const mockDishes = [
        {
          id: 'dish-1',
          name: '宫保鸡丁',
          images: ['https://example.com/dish1.jpg'],
          averageRating: 4.5,
          tags: ['川菜', '辣'],
          canteenName: '紫荆园',
          windowName: '川菜窗口',
        },
        {
          id: 'dish-2',
          name: '鱼香肉丝',
          images: [],
          averageRating: null,
          tags: ['川菜'],
          canteenName: '桃李园',
          windowName: '家常菜窗口',
        },
      ];

      beforeEach(() => {
        mockDishesService.getDishesByIds.mockResolvedValue({
          data: { items: mockDishes },
        });
      });

      it('should return dish cards for valid dish IDs', async () => {
        const result = await tool.execute(
          { type: 'dish', ids: ['dish-1', 'dish-2'] },
          mockContext,
        );

        expect(mockDishesService.getDishesByIds).toHaveBeenCalledWith(
          ['dish-1', 'dish-2'],
          'test-user',
        );
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          dish: {
            id: 'dish-1',
            name: '宫保鸡丁',
            image: 'https://example.com/dish1.jpg',
            rating: '4.5',
            tags: ['川菜', '辣'],
          },
          canteenName: '紫荆园',
          windowName: '川菜窗口',
          linkAction: {
            type: 'navigate',
            page: 'dish_detail',
            params: { id: 'dish-1' },
          },
        });
      });

      it('should handle dishes with no images', async () => {
        const result = await tool.execute(
          { type: 'dish', ids: ['dish-2'] },
          mockContext,
        );

        expect(result[1].dish.image).toBe('');
      });

      it('should handle dishes with null rating', async () => {
        const result = await tool.execute(
          { type: 'dish', ids: ['dish-2'] },
          mockContext,
        );

        expect(result[1].dish.rating).toBe('0');
      });

      it('should throw error when ids is missing for dish type', async () => {
        await expect(
          tool.execute({ type: 'dish' }, mockContext),
        ).rejects.toThrow('缺少或无效的参数 "ids"');
      });

      it('should throw error when ids is empty array for dish type', async () => {
        await expect(
          tool.execute({ type: 'dish', ids: [] }, mockContext),
        ).rejects.toThrow('缺少或无效的参数 "ids"');
      });
    });

    describe('canteen type', () => {
      const mockCanteens = [
        {
          id: 'canteen-1',
          name: '紫荆园',
          images: ['https://example.com/canteen1.jpg'],
          averageRating: 4.2,
          openingHours: '07:00-22:00',
        },
        {
          id: 'canteen-2',
          name: '桃李园',
          images: [],
          averageRating: null,
          openingHours: '',
        },
      ];

      beforeEach(() => {
        mockCanteensService.getCanteensByIds.mockResolvedValue({
          data: { items: mockCanteens },
        });
      });

      it('should return canteen cards for valid canteen IDs', async () => {
        const result = await tool.execute(
          { type: 'canteen', ids: ['canteen-1', 'canteen-2'] },
          mockContext,
        );

        expect(mockCanteensService.getCanteensByIds).toHaveBeenCalledWith([
          'canteen-1',
          'canteen-2',
        ]);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: 'canteen-1',
          name: '紫荆园',
          averageRating: 4.2,
          image: 'https://example.com/canteen1.jpg',
          linkAction: {
            type: 'navigate',
            page: 'canteen_detail',
            params: { id: 'canteen-1' },
          },
        });
      });

      it('should handle canteens with no images', async () => {
        const result = await tool.execute(
          { type: 'canteen', ids: ['canteen-2'] },
          mockContext,
        );

        expect(result[1].image).toBe('');
      });

      it('should handle canteens with null rating', async () => {
        const result = await tool.execute(
          { type: 'canteen', ids: ['canteen-2'] },
          mockContext,
        );

        expect(result[1].averageRating).toBe(0);
      });

      it('should throw error when ids is missing for canteen type', async () => {
        await expect(
          tool.execute({ type: 'canteen' }, mockContext),
        ).rejects.toThrow('缺少或无效的参数 "ids"');
      });

      it('should throw error when ids is empty array for canteen type', async () => {
        await expect(
          tool.execute({ type: 'canteen', ids: [] }, mockContext),
        ).rejects.toThrow('缺少或无效的参数 "ids"');
      });
    });

    describe('meal_plan type', () => {
      it('should return meal plan cards for valid data', async () => {
        const mealPlanData = {
          date: '2025-01-15',
          meals: [
            {
              type: 'breakfast',
              dishes: [
                { id: 'dish-1', name: '小笼包' },
                { id: 'dish-2', name: '豆浆' },
              ],
            },
            {
              type: 'lunch',
              dishes: [{ id: 'dish-3', name: '红烧肉' }],
            },
          ],
        };

        const result = await tool.execute(
          { type: 'meal_plan', data: mealPlanData },
          mockContext,
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mealPlanData);
      });

      it('should throw error when data is missing for meal_plan type', async () => {
        await expect(
          tool.execute({ type: 'meal_plan' }, mockContext),
        ).rejects.toThrow('缺少参数 "data"');
      });
    });

    describe('error handling', () => {
      it('should throw error when type is missing', async () => {
        await expect(tool.execute({}, mockContext)).rejects.toThrow(
          '缺少参数 "type"',
        );
      });

      it('should throw error for invalid type', async () => {
        await expect(
          tool.execute({ type: 'invalid' }, mockContext),
        ).rejects.toThrow('无效的类型 "invalid"');
      });
    });
  });
});
