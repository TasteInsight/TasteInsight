import { Test, TestingModule } from '@nestjs/testing';
import { PopularDishesTool } from './popular-dishes.tool';
import { DishesService } from '@/dishes/dishes.service';
import { DishSortField } from '@/common/enums';
import { SortOrder } from '@/dishes/dto/get-dishes.dto';

const mockDishesService = {
  getDishes: jest.fn(),
};

describe('PopularDishesTool', () => {
  let tool: PopularDishesTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PopularDishesTool,
        {
          provide: DishesService,
          useValue: mockDishesService,
        },
      ],
    }).compile();

    tool = module.get<PopularDishesTool>(PopularDishesTool);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  it('should call dishesService.getDishes with correct parameters for reviews', async () => {
    mockDishesService.getDishes.mockResolvedValue({
      data: {
        items: [], // Mock return
        meta: {},
      },
    });

    await tool.execute(
      { sortBy: 'reviews', limit: 5 },
      {
        userId: 'test-user',
        sessionId: 'test-session',
        localTime: '2025-01-01',
      },
    );

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
});
