import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileService } from './user-profile.service';
import { PrismaService } from '@/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userPreference: {
    upsert: jest.fn(),
  },
  userSetting: {
    upsert: jest.fn(),
  },
  review: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  favoriteDish: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  browseHistory: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  dishUpload: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  report: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('UserProfileService', () => {
  let service: UserProfileService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserProfile', () => {
    it('should return user profile', async () => {
      const mockUser = {
        id: 'user1',
        openId: 'openid1',
        nickname: 'User 1',
        avatar: 'avatar.jpg',
        allergens: [],
        preferences: {
          id: 'pref1',
          userId: 'user1',
          spicyLevel: 1,
          tagPreferences: [],
          priceMin: 0,
          priceMax: 50,
          meatPreference: [],
          sweetness: 1,
          saltiness: 1,
          oiliness: 1,
          canteenPreferences: [],
          portionSize: 'medium',
          favoriteIngredients: [],
          avoidIngredients: [],
        },
        settings: {
          newDishAlert: true,
          priceChangeAlert: false,
          reviewReplyAlert: true,
          weeklyRecommendation: true,
          showCalories: true,
          showNutrition: false,
          defaultSortBy: 'rating',
        },
        favoriteDishes: [],
        reviews: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserProfile('user1');
      expect(result.data.id).toEqual('user1');
      expect(result.data.preferences.tastePreferences.spicyLevel).toEqual(1);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserProfile('user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      const updateDto = {
        nickname: 'New Name',
        preferences: {
          tagPreferences: [],
          priceRange: { min: 10, max: 60 },
          meatPreference: [],
          tastePreferences: {
            sweetness: 2,
            saltiness: 2,
            oiliness: 2,
            spicyLevel: 2,
          },
          canteenPreferences: [],
          portionSize: 'large',
          favoriteIngredients: [],
          avoidIngredients: [],
        },
        settings: {
          notificationSettings: {
            newDishAlert: false,
            priceChangeAlert: true,
            reviewReplyAlert: false,
            weeklyRecommendation: false,
          },
          displaySettings: {
            showCalories: false,
            showNutrition: true,
            sortBy: 'price_low',
          },
        },
      };

      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.userPreference.upsert.mockResolvedValue({});
      // Mock getUserProfile to return something
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user1',
        openId: 'openid1',
        nickname: 'New Name',
        avatar: null,
        allergens: [],
        preferences: {
          spicyLevel: 2,
          sweetness: 2,
          saltiness: 2,
          oiliness: 2,
          priceMin: 10,
          priceMax: 60,
          tagPreferences: [],
          meatPreference: [],
          canteenPreferences: [],
          portionSize: 'large',
          favoriteIngredients: [],
          avoidIngredients: [],
        },
        settings: {
          newDishAlert: false,
          priceChangeAlert: true,
          reviewReplyAlert: false,
          weeklyRecommendation: false,
          showCalories: false,
          showNutrition: true,
          defaultSortBy: 'price_low',
        },
        favoriteDishes: [],
        reviews: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateUserProfile('user1', updateDto);
      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(mockPrismaService.userPreference.upsert).toHaveBeenCalled();
    });

    it('should update user profile with partial preferences containing undefined values', async () => {
      const updateDto = {
        nickname: 'Updated User', // Add a user field to trigger user.update
        preferences: {
          tagPreferences: ['川菜'],
          priceRange: { min: 10, max: 50 },
          meatPreference: ['鸡肉'],
          tastePreferences: {
            spicyLevel: 3,
            sweetness: undefined,
            saltiness: undefined,
            oiliness: 2,
          },
          canteenPreferences: [],
          portionSize: 'large',
          favoriteIngredients: [],
          avoidIngredients: [],
        },
      };

      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.userPreference.upsert.mockResolvedValue({});
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user1',
        openId: 'openid1',
        nickname: 'Updated User',
        avatar: null,
        allergens: [],
        preferences: {
          spicyLevel: 3,
          sweetness: 0,
          saltiness: 0,
          oiliness: 2,
          priceMin: 10,
          priceMax: 50,
          tagPreferences: ['川菜'],
          meatPreference: ['鸡肉'],
          canteenPreferences: [],
          portionSize: 'large',
          favoriteIngredients: [],
          avoidIngredients: [],
        },
        settings: {
          newDishAlert: true,
          priceChangeAlert: false,
          reviewReplyAlert: true,
          weeklyRecommendation: true,
          showCalories: true,
          showNutrition: false,
          defaultSortBy: 'rating',
        },
        favoriteDishes: [],
        reviews: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateUserProfile('user1', updateDto);
      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(mockPrismaService.userPreference.upsert).toHaveBeenCalled();
      expect(result.data.nickname).toBe('Updated User');
      expect(result.data.preferences.tastePreferences.spicyLevel).toBe(3);
      expect(result.data.preferences.tastePreferences.oiliness).toBe(2);
    });

    it('should update user profile with partial settings containing undefined values', async () => {
      const updateDto = {
        nickname: 'Updated User 2', // Add a user field to trigger user.update
        settings: {
          notificationSettings: {
            newDishAlert: true,
            priceChangeAlert: undefined,
            reviewReplyAlert: undefined,
            weeklyRecommendation: false,
          },
          displaySettings: {
            showCalories: true,
            showNutrition: false,
            sortBy: undefined,
          },
        },
      };

      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.userSetting.upsert.mockResolvedValue({});
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user1',
        openId: 'openid1',
        nickname: 'Updated User 2',
        avatar: null,
        allergens: [],
        preferences: {
          spicyLevel: 0,
          sweetness: 0,
          saltiness: 0,
          oiliness: 0,
          tagPreferences: [],
          priceMin: 0,
          priceMax: 50,
          meatPreference: [],
          canteenPreferences: [],
          portionSize: 'medium',
          favoriteIngredients: [],
          avoidIngredients: [],
        },
        settings: {
          newDishAlert: true,
          priceChangeAlert: false,
          reviewReplyAlert: false,
          weeklyRecommendation: false,
          showCalories: true,
          showNutrition: false,
          defaultSortBy: 'rating',
        },
        favoriteDishes: [],
        reviews: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateUserProfile('user1', updateDto);
      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(mockPrismaService.userSetting.upsert).toHaveBeenCalled();
      expect(result.data.nickname).toBe('Updated User 2');
      expect(result.data.settings.notificationSettings.newDishAlert).toBe(true);
      expect(result.data.settings.displaySettings.showCalories).toBe(true);
    });
  });

  describe('getMyReviews', () => {
    it('should return user reviews', async () => {
      const mockReviews = [
        {
          id: 'review1',
          dishId: 'dish1',
          userId: 'user1',
          rating: 5,
          spicyLevel: 1,
          sweetness: 1,
          saltiness: 1,
          oiliness: 1,
          content: 'Good',
          images: [],
          status: 'approved',
          createdAt: new Date(),
          dish: { name: 'Dish 1', images: ['img.jpg'] },
          user: { nickname: 'User 1', avatar: 'avatar.jpg' },
        },
      ];
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.review.count.mockResolvedValue(1);

      const result = await service.getMyReviews('user1', 1, 20);
      expect(result.data.items.length).toBe(1);
      expect(result.data.items[0].dishName).toBe('Dish 1');
    });
  });

  describe('getMyFavorites', () => {
    it('should return user favorites', async () => {
      const mockFavorites = [
        {
          dishId: 'dish1',
          addedAt: new Date(),
        },
      ];
      mockPrismaService.favoriteDish.findMany.mockResolvedValue(mockFavorites);
      mockPrismaService.favoriteDish.count.mockResolvedValue(1);

      const result = await service.getMyFavorites('user1', 1, 20);
      expect(result.data.items.length).toBe(1);
      expect(result.data.items[0].dishId).toBe('dish1');
    });
  });

  describe('getBrowseHistory', () => {
    it('should return browse history', async () => {
      const mockHistory = [
        {
          dishId: 'dish1',
          viewedAt: new Date(),
        },
      ];
      mockPrismaService.browseHistory.findMany.mockResolvedValue(mockHistory);
      mockPrismaService.browseHistory.count.mockResolvedValue(1);

      const result = await service.getBrowseHistory('user1', 1, 20);
      expect(result.data.items.length).toBe(1);
    });
  });

  describe('clearBrowseHistory', () => {
    it('should clear browse history', async () => {
      mockPrismaService.browseHistory.deleteMany.mockResolvedValue({
        count: 1,
      });
      const result = await service.clearBrowseHistory('user1');
      expect(result.code).toBe(200);
      expect(mockPrismaService.browseHistory.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
      });
    });
  });

  describe('getMyUploads', () => {
    it('should return user uploads', async () => {
      const mockUploads = [
        {
          id: 'upload1',
          name: 'Dish 1',
          canteenName: 'Canteen 1',
          price: 10,
          status: 'pending',
          rejectReason: null,
          createdAt: new Date(),
        },
      ];
      mockPrismaService.dishUpload.findMany.mockResolvedValue(mockUploads);
      mockPrismaService.dishUpload.count.mockResolvedValue(1);

      const result = await service.getMyUploads('user1', 1, 20);
      expect(result.data.items.length).toBe(1);
    });
  });

  describe('mapToUserPreferencesUpdateData', () => {
    it('should filter out undefined values', () => {
      const preferences = {
        tagPreferences: ['川菜'],
        priceRange: { min: 10, max: 50 },
        meatPreference: ['鸡肉'],
        tastePreferences: {
          spicyLevel: 3,
          sweetness: undefined,
          saltiness: undefined,
          oiliness: 2,
        },
        canteenPreferences: [],
        portionSize: 'large',
        favoriteIngredients: [],
        avoidIngredients: [],
      };

      // Access the private method using type assertion
      const result = (service as any).mapToUserPreferencesUpdateData(preferences);

      expect(result.tagPreferences).toEqual(['川菜']);
      expect(result.priceMin).toBe(10);
      expect(result.priceMax).toBe(50);
      expect(result.meatPreference).toEqual(['鸡肉']);
      expect(result.spicyLevel).toBe(3);
      expect(result.oiliness).toBe(2);
      expect(result.sweetness).toBeUndefined();
      expect(result.saltiness).toBeUndefined();
    });
  });

  describe('mapToUserSettingsUpdateData', () => {
    it('should filter out undefined values', () => {
      const settings = {
        notificationSettings: {
          newDishAlert: true,
          priceChangeAlert: undefined,
          reviewReplyAlert: undefined,
          weeklyRecommendation: false,
        },
        displaySettings: {
          showCalories: true,
          showNutrition: false,
          sortBy: undefined,
        },
      };

      // Access the private method using type assertion
      const result = (service as any).mapToUserSettingsUpdateData(settings);

      expect(result.newDishAlert).toBe(true);
      expect(result.weeklyRecommendation).toBe(false);
      expect(result.showCalories).toBe(true);
      expect(result.showNutrition).toBe(false);
      expect(result.priceChangeAlert).toBeUndefined();
      expect(result.reviewReplyAlert).toBeUndefined();
      expect(result.defaultSortBy).toBeUndefined();
    });
  });
});
