import { Test, TestingModule } from '@nestjs/testing';
import { UpdatePreferencesTool } from './update-preferences.tool';
import { UserProfileService } from '@/user-profile/user-profile.service';

const mockUserProfileService = {
  updateUserProfile: jest.fn(),
};

describe('UpdatePreferencesTool', () => {
  let tool: UpdatePreferencesTool;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatePreferencesTool,
        {
          provide: UserProfileService,
          useValue: mockUserProfileService,
        },
      ],
    }).compile();

    tool = module.get<UpdatePreferencesTool>(UpdatePreferencesTool);
  });

  describe('getDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('update_preferences');
      expect(definition.description).toContain('更新用户的饮食偏好');
      expect(definition.parameters.properties).toHaveProperty('tagPreferences');
      expect(definition.parameters.properties).toHaveProperty('priceRange');
      expect(definition.parameters.properties).toHaveProperty(
        'tastePreferences',
      );
      expect(definition.parameters.properties).toHaveProperty(
        'avoidIngredients',
      );
      expect(definition.parameters.properties).toHaveProperty('allergens');
    });

    it('should have taste preferences with numeric ranges', () => {
      const definition = tool.getDefinition();
      const tastePrefs = definition.parameters.properties.tastePreferences;

      expect(tastePrefs.properties).toHaveProperty('spicyLevel');
      expect(tastePrefs.properties).toHaveProperty('sweetness');
      expect(tastePrefs.properties).toHaveProperty('saltiness');
      expect(tastePrefs.properties).toHaveProperty('oiliness');
    });
  });

  describe('execute', () => {
    const mockContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      localTime: '2025-01-01',
    };

    beforeEach(() => {
      mockUserProfileService.updateUserProfile.mockResolvedValue({});
    });

    it('should update tag preferences', async () => {
      const result = await tool.execute(
        { tagPreferences: ['清淡', '高蛋白'] },
        mockContext,
      );

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {
          preferences: {
            tagPreferences: ['清淡', '高蛋白'],
          },
        },
      );
      expect(result).toBe('User preferences updated successfully');
    });

    it('should update price range', async () => {
      const result = await tool.execute(
        { priceRange: { min: 10, max: 30 } },
        mockContext,
      );

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {
          preferences: {
            priceRange: { min: 10, max: 30 },
          },
        },
      );
      expect(result).toBe('User preferences updated successfully');
    });

    it('should update taste preferences', async () => {
      const result = await tool.execute(
        {
          tastePreferences: {
            spicyLevel: 3,
            sweetness: 2,
            saltiness: 3,
            oiliness: 2,
          },
        },
        mockContext,
      );

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {
          preferences: {
            tastePreferences: {
              spicyLevel: 3,
              sweetness: 2,
              saltiness: 3,
              oiliness: 2,
            },
          },
        },
      );
      expect(result).toBe('User preferences updated successfully');
    });

    it('should update avoid ingredients', async () => {
      const result = await tool.execute(
        { avoidIngredients: ['香菜', '葱', '蒜'] },
        mockContext,
      );

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {
          preferences: {
            avoidIngredients: ['香菜', '葱', '蒜'],
          },
        },
      );
      expect(result).toBe('User preferences updated successfully');
    });

    it('should update allergens', async () => {
      const result = await tool.execute(
        { allergens: ['花生', '海鲜', '牛奶'] },
        mockContext,
      );

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {
          allergens: ['花生', '海鲜', '牛奶'],
        },
      );
      expect(result).toBe('User preferences updated successfully');
    });

    it('should update multiple preferences at once', async () => {
      const result = await tool.execute(
        {
          tagPreferences: ['清淡'],
          priceRange: { min: 15, max: 25 },
          tastePreferences: { spicyLevel: 1, sweetness: 2 },
          avoidIngredients: ['辣椒'],
          allergens: ['花生'],
        },
        mockContext,
      );

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {
          preferences: {
            tagPreferences: ['清淡'],
            priceRange: { min: 15, max: 25 },
            tastePreferences: { spicyLevel: 1, sweetness: 2 },
            avoidIngredients: ['辣椒'],
          },
          allergens: ['花生'],
        },
      );
      expect(result).toBe('User preferences updated successfully');
    });

    it('should handle empty params', async () => {
      const result = await tool.execute({}, mockContext);

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {},
      );
      expect(result).toBe('User preferences updated successfully');
    });

    it('should handle only allergens update', async () => {
      const result = await tool.execute({ allergens: ['蛋类'] }, mockContext);

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {
          allergens: ['蛋类'],
        },
      );
      expect(result).toBe('User preferences updated successfully');
    });

    it('should handle partial taste preferences', async () => {
      const result = await tool.execute(
        {
          tastePreferences: { spicyLevel: 0 },
        },
        mockContext,
      );

      expect(mockUserProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user',
        {
          preferences: {
            tastePreferences: { spicyLevel: 0 },
          },
        },
      );
      expect(result).toBe('User preferences updated successfully');
    });
  });
});
