import { Test, TestingModule } from '@nestjs/testing';
import { UpdatePreferencesTool } from './update-preferences.tool';
import { UserProfileService } from '@/user-profile/user-profile.service';

const mockUserProfileService = {
  getUserProfile: jest.fn(),
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
    const context = { userId: 'test-user', sessionId: 'test-session' };

    beforeEach(() => {
      mockUserProfileService.getUserProfile.mockResolvedValue({
        data: {
          preferences: {
            tagPreferences: [],
            priceRange: { min: 0, max: 50 },
            tastePreferences: {
              spicyLevel: 0,
              sweetness: 0,
              saltiness: 0,
              oiliness: 0,
            },
            avoidIngredients: [],
          },
          allergens: [],
        },
      });
    });

    it.each([
      { tagPreferences: ['清淡', '高蛋白'] },
      { priceRange: { min: 10, max: 30 } },
      {
        tastePreferences: {
          spicyLevel: 3,
          sweetness: 2,
          saltiness: 3,
          oiliness: 2,
        },
      },
      { avoidIngredients: ['香菜', '葱', '蒜'] },
      { allergens: ['花生', '海鲜', '牛奶'] },
    ])(
      'creates a confirmable draft for %j instead of persisting it',
      async (params) => {
        const draft = await tool.execute(params, context);
        const { allergens, ...preferences } = params as any;
        expect(draft.confirmAction).toEqual({
          api: '/user/profile',
          method: 'PUT',
          body: {
            ...(Object.keys(preferences).length ? { preferences } : {}),
            ...(allergens !== undefined ? { allergens } : {}),
          },
        });
        expect(mockUserProfileService.getUserProfile).toHaveBeenCalledWith(
          'test-user',
        );
        expect(mockUserProfileService.updateUserProfile).not.toHaveBeenCalled();
      },
    );

    it('propagates a profile read failure without attempting a write', async () => {
      mockUserProfileService.getUserProfile.mockRejectedValueOnce(
        new Error('Profile unavailable'),
      );
      await expect(
        tool.execute({ allergens: ['花生'] }, context),
      ).rejects.toThrow('Profile unavailable');
      expect(mockUserProfileService.updateUserProfile).not.toHaveBeenCalled();
    });
  });
});
