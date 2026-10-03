import { RecommendationService } from './recommendation.service';

describe('Recommendation candidate contracts', () => {
  const dish = {
    id: 'live-dish',
    name: '午餐菜品',
    availableMealTime: ['lunch'],
    averageRating: 4,
    reviewCount: 2,
  };
  const features = {
    userId: 'user',
    preferences: null,
    allergens: [],
    favoriteFeatures: { dishIds: new Set() },
    browseFeatures: { tagWeights: new Map(), recentDishIds: new Set() },
  };
  const prisma = {
    dish: { findUnique: jest.fn(), findMany: jest.fn() },
    favoriteDish: { findMany: jest.fn() },
  };
  const events = { logImpressions: jest.fn() };
  let service: RecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dish.findUnique.mockResolvedValue(null);
    prisma.dish.findMany.mockImplementation(async (query) =>
      query.select
        ? [dish].slice(0, query.take).map(({ id }) => ({ id }))
        : [dish],
    );
    prisma.favoriteDish.findMany.mockResolvedValue([]);
    service = new RecommendationService(
      prisma as any,
      null as any,
      events as any,
      null as any,
      null as any,
      null as any,
    );
    jest
      .spyOn(service, 'getUserFeaturesWithCache')
      .mockResolvedValue(features as any);
  });

  it('hydrates rule fallback IDs when the triggering dish no longer exists', async () => {
    const result = await service.getRecommendations('user', {
      triggerDishId: 'deleted-dish',
      filter: {},
      pagination: { page: 1, pageSize: 1 },
    } as any);
    expect(result.data.items).toEqual([
      { id: 'live-dish', score: undefined, scoreBreakdown: undefined },
    ]);
    expect(events.logImpressions).toHaveBeenCalledWith(
      'user',
      ['live-dish'],
      expect.any(Object),
    );
  });

  it('hydrates fallback candidates after every configured recall path is empty', async () => {
    const embedding = {
      isEnabled: () => false,
      getUserEmbedding: jest.fn().mockResolvedValue(null),
      generateUserEmbedding: jest.fn().mockResolvedValue(null),
      recallDishesByUserEmbedding: jest.fn().mockResolvedValue([]),
    };
    const experiment = {
      assignUserToExperiment: jest
        .fn()
        .mockResolvedValue({
          recallQuota: { vectorQuota: 1, ruleQuota: 0, collaborativeQuota: 0 },
        }),
    };
    service = new RecommendationService(
      prisma as any,
      null as any,
      events as any,
      experiment as any,
      embedding as any,
      null as any,
    );
    jest
      .spyOn(service, 'getUserFeaturesWithCache')
      .mockResolvedValue(features as any);
    const result = await service.getRecommendations('user', {
      filter: {},
      pagination: { page: 1, pageSize: 1 },
    } as any);
    expect(result.data.items[0].id).toBe('live-dish');
    expect(events.logImpressions).toHaveBeenCalledWith(
      'user',
      ['live-dish'],
      expect.any(Object),
    );
  });

  it('applies meal-time filtering before fetching embedded candidates', async () => {
    const embedding = {
      isEnabled: () => true,
      getUserEmbedding: jest.fn().mockResolvedValue([1]),
      calculateUserDishSimilarities: jest
        .fn()
        .mockResolvedValue(new Map([[dish.id, 0.9]])),
    };
    service = new RecommendationService(
      prisma as any,
      null as any,
      events as any,
      null as any,
      embedding as any,
      null as any,
    );
    jest
      .spyOn(service, 'getUserFeaturesWithCache')
      .mockResolvedValue(features as any);
    await service.getPersonalizedDishes('user', {
      mealTime: 'lunch',
      pagination: { page: 1, pageSize: 1 },
    });
    expect(prisma.dish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ availableMealTime: { has: 'lunch' } }),
      }),
    );
  });
});
