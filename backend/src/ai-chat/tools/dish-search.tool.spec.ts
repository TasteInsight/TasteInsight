import { Test, TestingModule } from '@nestjs/testing';
import { DishSearchTool } from './dish-search.tool';
import { DishesService } from '@/dishes/dishes.service';
import { CanteensService } from '@/canteens/canteens.service';

const mockDishesService = {
  getDishes: jest.fn(),
};

const mockCanteensService = {
  resolveCanteenId: jest.fn(),
};

describe('DishSearchTool', () => {
  let tool: DishSearchTool;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishSearchTool,
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

    tool = module.get<DishSearchTool>(DishSearchTool);
  });

  describe('getDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('search_dishes');
      expect(definition.description).toContain('搜索菜品');
      expect(definition.parameters.properties).toHaveProperty('keyword');
      expect(definition.parameters.properties).toHaveProperty('canteenId');
      expect(definition.parameters.properties).toHaveProperty('priceMin');
      expect(definition.parameters.properties).toHaveProperty('priceMax');
      expect(definition.parameters.properties).toHaveProperty('limit');
      expect(definition.parameters.properties).toHaveProperty('sortField');
      expect(definition.parameters.properties).toHaveProperty('sortOrder');
      expect(definition.parameters.properties).toHaveProperty('tags');
      expect(definition.parameters.properties).toHaveProperty('minRating');
      expect(definition.parameters.properties).toHaveProperty('mealTime');
      expect(definition.parameters.properties).toHaveProperty('spicyLevel');
      expect(definition.parameters.properties).toHaveProperty('sweetness');
      expect(definition.parameters.properties).toHaveProperty('saltiness');
      expect(definition.parameters.properties).toHaveProperty('oiliness');
      expect(definition.parameters.required).toContain('keyword');
    });
  });

  describe('execute', () => {
    const mockContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      localTime: '2025-01-01',
    };

    const mockDishItems = [
      { id: 'dish-1', name: '宫保鸡丁', price: 15 },
      { id: 'dish-2', name: '鱼香肉丝', price: 14 },
    ];

    beforeEach(() => {
      mockDishesService.getDishes.mockResolvedValue({
        data: {
          items: mockDishItems,
          meta: { total: 2 },
        },
      });
    });

    it('should search dishes with keyword only', async () => {
      const result = await tool.execute({ keyword: '鸡丁' }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          search: {
            keyword: '鸡丁',
            fields: ['name', 'tags', 'ingredients'],
          },
          pagination: { page: 1, pageSize: 10 },
        }),
        'test-user',
      );
      expect(result).toEqual(mockDishItems);
    });

    it('should search dishes with canteen filter', async () => {
      mockCanteensService.resolveCanteenId.mockResolvedValue('canteen-1');

      await tool.execute({ keyword: '鸡丁', canteenId: '紫荆园' }, mockContext);

      expect(mockCanteensService.resolveCanteenId).toHaveBeenCalledWith(
        '紫荆园',
      );
      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            canteenId: ['canteen-1'],
          }),
        }),
        'test-user',
      );
    });

    it('should handle invalid canteen ID', async () => {
      mockCanteensService.resolveCanteenId.mockResolvedValue(null);

      await tool.execute(
        { keyword: '鸡丁', canteenId: '无效食堂' },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            canteenId: ['non-existent-id'],
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with price range', async () => {
      await tool.execute(
        { keyword: '套餐', priceMin: 10, priceMax: 30 },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            price: { min: 10, max: 30 },
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with minimum rating', async () => {
      await tool.execute({ keyword: '好吃', minRating: 4 }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            rating: { min: 4, max: 5 },
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with tags', async () => {
      await tool.execute(
        { keyword: '川菜', tags: ['辣', '下饭'] },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            tag: ['辣', '下饭'],
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with meal time filter', async () => {
      await tool.execute(
        { keyword: '早餐', mealTime: ['breakfast'] },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            mealTime: ['breakfast'],
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with spicy level', async () => {
      await tool.execute({ keyword: '辣椒', spicyLevel: 4 }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            spicyLevel: { min: 4, max: 4 },
          }),
        }),
        'test-user',
      );
    });

    it('should ignore spicy level of 0', async () => {
      await tool.execute({ keyword: '清淡', spicyLevel: 0 }, mockContext);

      const calledArgs = mockDishesService.getDishes.mock.calls[0][0];
      expect(calledArgs.filter.spicyLevel).toBeUndefined();
    });

    it('should search dishes with sweetness', async () => {
      await tool.execute({ keyword: '甜品', sweetness: 3 }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            sweetness: { min: 3, max: 3 },
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with saltiness', async () => {
      await tool.execute({ keyword: '咸菜', saltiness: 4 }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            saltiness: { min: 4, max: 4 },
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with oiliness', async () => {
      await tool.execute({ keyword: '油炸', oiliness: 5 }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            oiliness: { min: 5, max: 5 },
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with meat preference', async () => {
      await tool.execute(
        { keyword: '肉', meatPreference: ['牛肉', '鸡肉'] },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            meatPreference: ['牛肉', '鸡肉'],
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with avoid ingredients', async () => {
      await tool.execute(
        { keyword: '菜', avoidIngredients: ['香菜', '葱'] },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            avoidIngredients: ['香菜', '葱'],
          }),
        }),
        'test-user',
      );
    });

    it('should search dishes with favorite ingredients', async () => {
      await tool.execute(
        { keyword: '菜', favoriteIngredients: ['番茄', '土豆'] },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            favoriteIngredients: ['番茄', '土豆'],
          }),
        }),
        'test-user',
      );
    });

    it('should apply sort options', async () => {
      await tool.execute(
        { keyword: '菜', sortField: 'price', sortOrder: 'asc' },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: { field: 'price', order: 'asc' },
        }),
        'test-user',
      );
    });

    it('should apply custom limit', async () => {
      await tool.execute({ keyword: '菜', limit: 20 }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: { page: 1, pageSize: 20 },
        }),
        'test-user',
      );
    });

    it('should combine multiple filters', async () => {
      mockCanteensService.resolveCanteenId.mockResolvedValue('canteen-1');

      await tool.execute(
        {
          keyword: '鸡肉',
          canteenId: '紫荆园',
          priceMin: 10,
          priceMax: 25,
          minRating: 4,
          tags: ['清淡'],
          spicyLevel: 2,
          limit: 5,
          sortField: 'rating',
          sortOrder: 'desc',
        },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            canteenId: ['canteen-1'],
            price: { min: 10, max: 25 },
            rating: { min: 4, max: 5 },
            tag: ['清淡'],
            spicyLevel: { min: 2, max: 2 },
          }),
          search: {
            keyword: '鸡肉',
            fields: ['name', 'tags', 'ingredients'],
          },
          sort: { field: 'rating', order: 'desc' },
          pagination: { page: 1, pageSize: 5 },
        }),
        'test-user',
      );
    });
  });
});
