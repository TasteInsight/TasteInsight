import { Test, TestingModule } from '@nestjs/testing';
import { ContentDisplayTool } from './content-display.tool';
import { DishesService } from '@/dishes/dishes.service';
import { CanteensService } from '@/canteens/canteens.service';
import { CreateMealPlanTool } from './create-meal-plan.tool';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { ToolRegistryService } from './tool-registry.service';

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
        CreateMealPlanTool,
        ToolRegistryService,
        {
          provide: RecommendationService,
          useValue: {
            getUserFeaturesWithCache: async () => ({
              allergens: [],
              preferences: null,
            }),
          },
        },
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
    module
      .get<ToolRegistryService>(ToolRegistryService)
      .registerTool(module.get<CreateMealPlanTool>(CreateMealPlanTool));
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
      scene: 'general_chat',
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
      const main = {
        id: 'dish-1',
        name: '鸡肉饭',
        price: 15,
        priceUnit: '份',
        canteenId: 'c1',
        status: 'online',
        availableMealTime: ['lunch'],
        allergens: [],
        ingredients: [],
      };
      const side = { ...main, id: 'dish-2', name: '清炒时蔬', price: 5 };
      const body = {
        startDate: '2026-10-05',
        endDate: '2026-10-05',
        mealTime: 'lunch',
        dishes: ['dish-1', 'dish-2'],
      };
      const mealPlanData = {
        summary: '第一食堂午餐',
        previewData: {
          ...body,
          dishes: [
            { id: 'dish-1', name: '虚构名称', price: 1 },
            { id: 'dish-2', name: '旧名称', price: 1 },
          ],
        },
        confirmAction: { api: '/meal-plans', method: 'POST', body },
      };

      beforeEach(() => {
        mockDishesService.getDishesByIds.mockResolvedValue({
          data: { items: [main, side] },
        });
      });

      it('rehydrates valid drafts from live data instead of trusting supplied dish details', async () => {
        const result = await tool.execute(
          { type: 'meal_plan', data: mealPlanData },
          mockContext,
        );
        expect(result).toHaveLength(1);
        expect(result[0].previewData.dishes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'dish-1',
              name: '鸡肉饭',
              price: 15,
              priceUnit: '份',
            }),
          ]),
        );
        expect(result[0].confirmAction).toEqual(mealPlanData.confirmAction);
      });

      it.each([
        { items: [main], message: '菜品' },
        { items: [main, { ...side, canteenId: 'c2' }], message: '同一个食堂' },
      ])(
        'does not bypass plan constraints through direct display: %o',
        async ({ items, message }) => {
          mockDishesService.getDishesByIds.mockResolvedValue({
            data: { items },
          });
          await expect(
            tool.execute(
              { type: 'meal_plan', data: mealPlanData },
              mockContext,
            ),
          ).rejects.toThrow(message);
        },
      );

      it.each([
        { ...body, dishes: ['dish-1'] },
        { ...body, startDate: '2026-10-06' },
        { ...body, mealTime: 'dinner' },
      ])(
        'rejects disagreement between preview and confirmation: %o',
        async (conflictingBody) => {
          await expect(
            tool.execute(
              {
                type: 'meal_plan',
                data: {
                  ...mealPlanData,
                  confirmAction: {
                    ...mealPlanData.confirmAction,
                    body: conflictingBody,
                  },
                },
              },
              mockContext,
            ),
          ).rejects.toThrow('不一致');
        },
      );

      it('preserves explicit constraints and rechecks the whole-meal budget', async () => {
        mockDishesService.getDishesByIds.mockResolvedValue({
          data: { items: [main, { ...side, canteenId: 'c2' }] },
        });
        const constraints = { allowCrossCanteen: true, totalBudget: 20 };
        const result = await tool.execute(
          { type: 'meal_plan', data: { ...mealPlanData, constraints } },
          mockContext,
        );
        expect((result[0] as any).constraints).toEqual(constraints);
        await expect(
          tool.execute(
            {
              type: 'meal_plan',
              data: {
                ...mealPlanData,
                constraints: { ...constraints, totalBudget: 19 },
              },
            },
            mockContext,
          ),
        ).rejects.toThrow('预算');
      });

      it('rejects non-draft objects', async () => {
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

        await expect(
          tool.execute({ type: 'meal_plan', data: mealPlanData }, mockContext),
        ).rejects.toThrow('计划草稿');
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
