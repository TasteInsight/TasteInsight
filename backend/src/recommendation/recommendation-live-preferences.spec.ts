import { RecommendationService } from './recommendation.service';
import { CACHE_CONFIG } from './constants/recommendation.constants';

const emptyFeatures = {
  userId: 'user',
  preferences: null,
  allergens: [],
  favoriteFeatures: { dishIds: new Set() },
  browseFeatures: { recentDishIds: new Set(), tagWeights: new Map() },
};

describe('Recommendation current preference boundary', () => {
  it('overlays current preferences after an old feature read repopulates the cache', async () => {
    const current = { allergens: ['花生', '虾'] };
    const prisma = {
      user: { findUnique: jest.fn(async () => current) },
      userPreference: {
        findUnique: jest.fn(async () => ({
          avoidIngredients: ['香菜'],
          priceMax: 0,
        })),
      },
    };
    const cache = {
      getUserFeatures: jest.fn().mockResolvedValue({
        ...emptyFeatures,
        allergens: ['花生'],
        preferences: { avoidIngredients: [] },
      }),
    };
    const service = new RecommendationService(
      prisma as any,
      cache as any,
      null as any,
      null as any,
      null as any,
      null as any,
    );
    const result = await service.getUserFeaturesWithCache('user');
    expect(result.allergens).toEqual(['花生', '虾']);
    expect(result.preferences?.avoidIngredients).toEqual(['香菜']);
    expect(result.preferences?.priceMax).toBe(0);
  });

  it.each(['personalized', 'similar'])(
    'rechecks live restrictions before serving %s cached candidates',
    async (kind) => {
      const cached = [{ dish: { id: 'shrimp', name: '虾饭' }, score: 1 }];
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ allergens: ['虾'] }),
        },
        userPreference: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ avoidIngredients: ['香菜'] }),
        },
        dish: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const redis = {
        get: jest.fn().mockResolvedValue(JSON.stringify(cached)),
      };
      const cache = { getRedisClient: () => redis };
      const service = new RecommendationService(
        prisma as any,
        cache as any,
        null as any,
        null as any,
        null as any,
        null as any,
      );
      const result =
        kind === 'personalized'
          ? await service.getPersonalizedDishes('user', {
              canteenId: 'canteen',
              mealTime: 'lunch',
              pagination: { page: 1, pageSize: 5 },
            })
          : await service.getSimilarDishes(
              'source',
              { page: 1, pageSize: 5 },
              'user',
            );
      expect(result).toEqual({ items: [], total: 0, totalPages: 0 });
      expect(prisma.dish.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['shrimp'] },
            AND: expect.arrayContaining([
              { status: 'online' },
              { NOT: { allergens: { hasSome: ['虾'] } } },
              { NOT: { ingredients: { hasSome: ['香菜'] } } },
            ]),
          }),
        }),
      );
      expect(redis.get.mock.calls[0][0]).toMatch(
        new RegExp(`^${CACHE_CONFIG.KEY_PREFIX.RECOMMENDATION}user:`),
      );
    },
  );
});
