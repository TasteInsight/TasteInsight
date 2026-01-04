import { Test, TestingModule } from '@nestjs/testing';
import { MyFavoritesTool } from './my-favorites.tool';
import { UserProfileService } from '@/user-profile/user-profile.service';

const mockUserProfileService = {
  getMyFavorites: jest.fn(),
};

describe('MyFavoritesTool', () => {
  let tool: MyFavoritesTool;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyFavoritesTool,
        {
          provide: UserProfileService,
          useValue: mockUserProfileService,
        },
      ],
    }).compile();

    tool = module.get<MyFavoritesTool>(MyFavoritesTool);
  });

  describe('getDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('get_my_favorites');
      expect(definition.description).toContain('收藏菜品');
      expect(definition.parameters.properties).toHaveProperty('limit');
    });

    it('should have default limit of 5', () => {
      const definition = tool.getDefinition();
      const limitProp = definition.parameters.properties.limit;

      expect(limitProp.default).toBe(5);
    });
  });

  describe('execute', () => {
    const mockContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      localTime: '2025-01-01',
    };

    const mockFavorites = [
      {
        id: 'dish-1',
        name: '宫保鸡丁',
        price: 15,
        averageRating: 4.5,
      },
      {
        id: 'dish-2',
        name: '鱼香肉丝',
        price: 14,
        averageRating: 4.3,
      },
    ];

    beforeEach(() => {
      mockUserProfileService.getMyFavorites.mockResolvedValue({
        data: { items: mockFavorites },
      });
    });

    it('should return favorites with default limit', async () => {
      const result = await tool.execute({}, mockContext);

      expect(mockUserProfileService.getMyFavorites).toHaveBeenCalledWith(
        'test-user',
        1,
        5,
      );
      expect(result).toEqual(mockFavorites);
    });

    it('should return favorites with custom limit', async () => {
      await tool.execute({ limit: 10 }, mockContext);

      expect(mockUserProfileService.getMyFavorites).toHaveBeenCalledWith(
        'test-user',
        1,
        10,
      );
    });

    it('should return empty array when user has no favorites', async () => {
      mockUserProfileService.getMyFavorites.mockResolvedValue({
        data: { items: [] },
      });

      const result = await tool.execute({}, mockContext);

      expect(result).toEqual([]);
    });

    it('should use correct userId from context', async () => {
      const differentContext = {
        ...mockContext,
        userId: 'different-user',
      };

      await tool.execute({}, differentContext);

      expect(mockUserProfileService.getMyFavorites).toHaveBeenCalledWith(
        'different-user',
        1,
        5,
      );
    });
  });
});
