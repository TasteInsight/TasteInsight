import { RecommendationService } from './recommendation.service';
import { RecommendationScene } from './constants/recommendation.constants';

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
    userPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue({ allergens: [] }) },
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
      assignUserToExperiment: jest.fn().mockResolvedValue({
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

  it('includes eligible canteens outside the global recall and groups alternatives without weakening filters', async () => {
    const candidates = [
      { ...dish, id: 'a1', canteenId: 'a' },
      { ...dish, id: 'a2', canteenId: 'a' },
      { ...dish, id: 'a3', canteenId: 'a' },
      { ...dish, id: 'a4', canteenId: 'a' },
    ];
    prisma.dish.findMany.mockImplementation(async (query) => {
      if (query.distinct)
        return [
          { ...dish, id: 'b1', canteenId: 'b' },
          { ...dish, id: 'c1', canteenId: 'c' },
        ];
      if (query.select) return candidates.map(({ id }) => ({ id }));
      return candidates;
    });
    jest
      .spyOn(service as any, 'scoreCandidates')
      .mockImplementation(async (items: any) =>
        items.map((item: any, index: number) => ({
          dish: item,
          score: 1 - index * 0.15,
        })),
      );

    const result = await service.getRecommendations('user', {
      filter: {
        mealTime: ['lunch'],
        price: { min: 0, max: 20 },
        avoidIngredients: ['香菜'],
      },
      pagination: { page: 1, pageSize: 5 },
      userContext: { diversifyCanteens: true },
    } as any);
    expect(result.data.items.map((item) => item.id)).toEqual([
      'a1',
      'a2',
      'a3',
      'b1',
      'c1',
    ]);
    expect(prisma.dish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ['canteenId'],
        where: {
          AND: expect.arrayContaining([
            { status: 'online' },
            { availableMealTime: { hasSome: ['lunch'] } },
            { price: { gte: 0, lte: 20 } },
            { NOT: { ingredients: { hasSome: ['香菜'] } } },
          ]),
        },
      }),
    );
  });

  it('does not add venue alternatives outside an explicit canteen constraint', async () => {
    await service.getRecommendations('user', {
      filter: { canteenId: ['requested-canteen'] },
      pagination: { page: 1, pageSize: 1 },
      userContext: { diversifyCanteens: true },
    } as any);
    expect(
      prisma.dish.findMany.mock.calls.every(([query]) => !query.distinct),
    ).toBe(true);
    expect(prisma.dish.findMany.mock.calls[0][0].where.AND).toContainEqual({
      canteenId: { in: ['requested-canteen'] },
    });
  });

  it('hard-filters saved dietary exclusions together with explicit ingredient exclusions and allergens', async () => {
    jest.spyOn(service, 'getUserFeaturesWithCache').mockResolvedValue({
      ...features,
      allergens: ['花生'],
      preferences: { avoidIngredients: ['香菜'] },
    } as any);
    await service.getRecommendations('user', {
      filter: { avoidIngredients: ['葱'] },
      pagination: { page: 1, pageSize: 1 },
    } as any);
    const filter = prisma.dish.findMany.mock.calls[0][0].where.AND;
    expect(filter).toContainEqual({
      NOT: { allergens: { hasSome: ['花生'] } },
    });
    expect(filter).toContainEqual({
      NOT: { ingredients: { hasSome: ['香菜', '葱'] } },
    });
  });

  it('keeps explicit exclusions and hard restrictions across vector, rule, and collaborative recalls', async () => {
    const embedding = {
      isEnabled: () => false,
      getUserEmbedding: jest.fn().mockResolvedValue([1]),
      recallDishesByUserEmbedding: jest
        .fn()
        .mockResolvedValue(['previous-option', dish.id]),
    };
    service = new RecommendationService(
      prisma as any,
      null as any,
      events as any,
      null as any,
      embedding as any,
      null as any,
    );
    jest.spyOn(service, 'getUserFeaturesWithCache').mockResolvedValue({
      ...features,
      allergens: ['花生'],
      preferences: { avoidIngredients: ['香菜'] },
    } as any);
    prisma.favoriteDish.findMany
      .mockResolvedValueOnce([{ dishId: 'favorite' }])
      .mockResolvedValueOnce([{ userId: 'peer' }])
      .mockResolvedValueOnce([
        { dishId: 'previous-option' },
        { dishId: dish.id },
      ]);

    await service.getRecommendations('user', {
      filter: {
        excludeDishIds: ['previous-option'],
        canteenId: ['requested-canteen'],
        windowId: ['requested-window'],
        mealTime: ['lunch'],
        price: { min: 0, max: 20 },
        avoidIngredients: ['葱'],
      },
      pagination: { page: 1, pageSize: 1 },
      userContext: { diversifyCanteens: true },
    } as any);

    const hardFilters = [
      { id: { notIn: ['previous-option'] } },
      { status: 'online' },
      { canteenId: { in: ['requested-canteen'] } },
      { windowId: { in: ['requested-window'] } },
      { availableMealTime: { hasSome: ['lunch'] } },
      { price: { gte: 0, lte: 20 } },
      { NOT: { allergens: { hasSome: ['花生'] } } },
      { NOT: { ingredients: { hasSome: ['香菜', '葱'] } } },
    ];
    expect(embedding.recallDishesByUserEmbedding).toHaveBeenCalledWith(
      'user',
      expect.any(Number),
      { AND: expect.arrayContaining(hardFilters) },
    );
    expect(prisma.favoriteDish.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.dish.findMany).toHaveBeenCalledTimes(3);
    for (const [query] of prisma.dish.findMany.mock.calls) {
      expect(query.where.AND).toEqual(expect.arrayContaining(hardFilters));
      expect(query.distinct).toBeUndefined();
    }
  });

  it.each([false, true])(
    'keeps exclusions and dietary restrictions through empty-recall fallbacks (explicit canteen: %s)',
    async (hasCanteen) => {
      prisma.dish.findMany.mockResolvedValue([]);
      jest.spyOn(service, 'getUserFeaturesWithCache').mockResolvedValue({
        ...features,
        allergens: ['花生'],
        preferences: { avoidIngredients: ['香菜'] },
      } as any);
      const result = await service.getRecommendations('user', {
        filter: {
          excludeDishIds: ['previous-option'],
          ...(hasCanteen ? { canteenId: ['requested-canteen'] } : {}),
          windowId: ['requested-window'],
          mealTime: ['lunch'],
          price: { min: 0, max: 20 },
          avoidIngredients: ['葱'],
        },
        pagination: { page: 1, pageSize: 3 },
        userContext: { diversifyCanteens: true },
      } as any);
      expect(result.data.items).toEqual([]);
      const hardFilters = [
        { id: { notIn: ['previous-option'] } },
        { status: 'online' },
        { windowId: { in: ['requested-window'] } },
        { availableMealTime: { hasSome: ['lunch'] } },
        { price: { gte: 0, lte: 20 } },
        { NOT: { allergens: { hasSome: ['花生'] } } },
        { NOT: { ingredients: { hasSome: ['香菜', '葱'] } } },
        ...(hasCanteen ? [{ canteenId: { in: ['requested-canteen'] } }] : []),
      ];
      const queries = prisma.dish.findMany.mock.calls.map(([query]) => query);
      for (const query of queries) {
        expect(query.where.AND).toEqual(expect.arrayContaining(hardFilters));
      }
      expect(queries.filter((query) => query.select)).toHaveLength(2);
      expect(queries.some((query) => query.distinct)).toBe(!hasCanteen);
      expect(queries.some((query) => query.orderBy?.createdAt === 'desc')).toBe(
        true,
      );
      expect(
        queries.some((query) =>
          query.where.AND.some(
            (condition: any) => condition.reviewCount?.gte === 5,
          ),
        ),
      ).toBe(true);
      expect(
        queries.some(
          (query) =>
            !query.select &&
            !query.distinct &&
            !query.orderBy &&
            query.take === 6,
        ),
      ).toBe(true);
    },
  );

  it.each([true, false])(
    'excludes the similarity source from shared candidate queries (vector candidates: %s)',
    async (hasVectorCandidates) => {
      const embedding = {
        isEnabled: () => false,
        getUserEmbedding: jest.fn().mockResolvedValue([1]),
        recallSimilarDishesByEmbedding: jest
          .fn()
          .mockResolvedValue(hasVectorCandidates ? ['source', dish.id] : []),
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
      prisma.dish.findUnique.mockResolvedValue({
        ...dish,
        id: 'source',
        canteenId: 'source-canteen',
        tags: ['清淡'],
      });
      if (!hasVectorCandidates) prisma.dish.findMany.mockResolvedValue([]);

      await service.getRecommendations('user', {
        scene: RecommendationScene.SIMILAR,
        triggerDishId: 'source',
        filter: {
          excludeDishIds: ['previous-option'],
          mealTime: ['lunch'],
          price: { min: 0, max: 20 },
        },
        pagination: { page: 1, pageSize: 3 },
        userContext: { diversifyCanteens: true },
      } as any);

      expect(embedding.recallSimilarDishesByEmbedding).toHaveBeenCalledWith(
        'source',
        expect.any(Number),
        true,
      );
      const queries = prisma.dish.findMany.mock.calls.map(([query]) => query);
      expect(queries.some((query) => query.distinct)).toBe(true);
      for (const query of queries) {
        expect(query.where.AND).toEqual(
          expect.arrayContaining([
            { id: { notIn: ['previous-option', 'source'] } },
            { availableMealTime: { hasSome: ['lunch'] } },
            { price: { gte: 0, lte: 20 } },
          ]),
        );
      }
      if (!hasVectorCandidates) {
        expect(
          queries.some((query) => query.orderBy?.createdAt === 'desc'),
        ).toBe(true);
      }
    },
  );

  it('automatically excludes the similarity source without explicit exclusions', async () => {
    prisma.dish.findUnique.mockResolvedValue({
      ...dish,
      id: 'source',
      canteenId: 'source-canteen',
      tags: ['清淡'],
    });
    await service.getRecommendations('user', {
      scene: RecommendationScene.SIMILAR,
      triggerDishId: 'source',
      filter: {},
      pagination: { page: 1, pageSize: 1 },
      userContext: { diversifyCanteens: true },
    } as any);
    const queries = prisma.dish.findMany.mock.calls.map(([query]) => query);
    expect(queries.some((query) => query.distinct)).toBe(true);
    for (const query of queries) {
      expect(query.where.AND).toContainEqual({ id: { notIn: ['source'] } });
    }
  });
});
