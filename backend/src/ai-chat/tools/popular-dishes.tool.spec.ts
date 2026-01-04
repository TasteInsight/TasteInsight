import { Test, TestingModule } from '@nestjs/testing';
import { PopularDishesTool } from './popular-dishes.tool';
import { DishesService } from '@/dishes/dishes.service';
import { CanteensService } from '@/canteens/canteens.service';
import { DishSortField } from '@/common/enums';
import { SortOrder } from '@/dishes/dto/get-dishes.dto';

const mockDishesService = {
  getDishes: jest.fn(),
};

const mockCanteensService = {
  resolveCanteenId: jest.fn(),
};

describe('PopularDishesTool', () => {
  let tool: PopularDishesTool;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PopularDishesTool,
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

    tool = module.get<PopularDishesTool>(PopularDishesTool);
  });

  describe('getDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('get_popular_dishes');
      expect(definition.description).toContain('热门菜品');
      expect(definition.parameters.properties).toHaveProperty('sortBy');
      expect(definition.parameters.properties).toHaveProperty('canteenId');
      expect(definition.parameters.properties).toHaveProperty('limit');
    });
  });

  describe('execute', () => {
    const mockContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      localTime: '2025-01-01',
    };

    const mockDishItems = [
      { id: 'dish-1', name: '宫保鸡丁', reviewCount: 100 },
      { id: 'dish-2', name: '鱼香肉丝', reviewCount: 80 },
    ];

    beforeEach(() => {
      mockDishesService.getDishes.mockResolvedValue({
        data: {
          items: mockDishItems,
          meta: { total: 2 },
        },
      });
    });

    it('should call dishesService.getDishes with reviews sort by default', async () => {
      await tool.execute({ limit: 5 }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: {
            field: DishSortField.REVIEW_COUNT,
            order: SortOrder.DESC,
          },
          pagination: { page: 1, pageSize: 5 },
        }),
        'test-user',
      );
    });

    it('should sort by rating when sortBy is rating', async () => {
      await tool.execute({ sortBy: 'rating', limit: 10 }, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: {
            field: DishSortField.AVERAGE_RATING,
            order: SortOrder.DESC,
          },
          pagination: { page: 1, pageSize: 10 },
        }),
        'test-user',
      );
    });

    it('should filter by canteenId when provided', async () => {
      mockCanteensService.resolveCanteenId.mockResolvedValue('canteen-123');

      await tool.execute({ canteenId: 'canteen-123', limit: 5 }, mockContext);

      expect(mockCanteensService.resolveCanteenId).toHaveBeenCalledWith(
        'canteen-123',
      );
      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { canteenId: 'canteen-123' },
        }),
        'test-user',
      );
    });

    it('should use non-existent-id when canteen not found', async () => {
      mockCanteensService.resolveCanteenId.mockResolvedValue(null);

      await tool.execute(
        { canteenId: 'invalid-canteen', limit: 5 },
        mockContext,
      );

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { canteenId: 'non-existent-id' },
        }),
        'test-user',
      );
    });

    it('should return dish items from result', async () => {
      const result = await tool.execute({ limit: 5 }, mockContext);

      expect(result).toEqual(mockDishItems);
    });

    it('should use default limit of 5', async () => {
      await tool.execute({}, mockContext);

      expect(mockDishesService.getDishes).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: { page: 1, pageSize: 5 },
        }),
        'test-user',
      );
    });
  });
});
