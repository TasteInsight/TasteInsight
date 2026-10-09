import { DishRecommendationTool } from './dish-recommendation.tool';
import { RecommendationScene } from '@/recommendation/constants/recommendation.constants';

describe('DishRecommendationTool', () => {
  const context = { userId: 'u1', sessionId: 's1' };
  let recommendation: any;
  let dishes: any;
  let canteens: any;
  let tool: DishRecommendationTool;

  beforeEach(() => {
    recommendation = {
      getRecommendations: jest
        .fn()
        .mockResolvedValue({ data: { items: [{ id: 'main' }] } }),
    };
    dishes = {
      getDishesByIds: jest.fn().mockResolvedValue({
        data: { items: [{ id: 'main', canteenId: 'c1' }] },
      }),
    };
    canteens = { resolveCanteenId: jest.fn().mockResolvedValue('c1') };
    tool = new DishRecommendationTool(recommendation, dishes, canteens);
  });

  it('requests genuine venue alternatives when no canteen is specified, retaining the flat dish result', async () => {
    await expect(
      tool.execute(
        { mealTime: 'lunch', priceMax: 20, avoidIngredients: ['香菜'] },
        context,
      ),
    ).resolves.toEqual([{ id: 'main', canteenId: 'c1' }]);
    expect(recommendation.getRecommendations).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        scene: RecommendationScene.GUESS_LIKE,
        filter: {
          mealTime: ['lunch'],
          price: { max: 20 },
          avoidIngredients: ['香菜'],
        },
        pagination: { page: 1, pageSize: 5 },
        userContext: { diversifyCanteens: true },
      }),
    );
  });

  it('keeps an explicit canteen constraint instead of adding other venues', async () => {
    await tool.execute({ mealTime: 'lunch', canteenId: '第一食堂' }, context);
    expect(recommendation.getRecommendations).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        filter: { mealTime: ['lunch'], canteenId: ['c1'] },
        userContext: { diversifyCanteens: false },
      }),
    );
  });

  it('does not drop an unresolved explicit canteen constraint', async () => {
    canteens.resolveCanteenId.mockResolvedValue(null);
    await tool.execute(
      { mealTime: 'lunch', canteenId: '不存在的食堂' },
      context,
    );
    expect(
      recommendation.getRecommendations.mock.calls[0][1].filter.canteenId,
    ).toEqual(['non-existent-id']);
    expect(
      recommendation.getRecommendations.mock.calls[0][1].userContext,
    ).toEqual({ diversifyCanteens: false });
  });

  it('uses the existing today scene without changing candidate hydration', async () => {
    await expect(
      tool.execute({ mealTime: 'dinner', scene: 'today', limit: 3 }, context),
    ).resolves.toEqual([{ id: 'main', canteenId: 'c1' }]);
    expect(recommendation.getRecommendations).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        scene: RecommendationScene.TODAY,
        pagination: { page: 1, pageSize: 3 },
      }),
    );
    expect(dishes.getDishesByIds).toHaveBeenCalledTimes(1);
  });

  it('resolves the similarity source and passes explicit replacement exclusions', async () => {
    dishes.getDishesByIds.mockResolvedValueOnce({
      data: { items: [{ id: 'source', canteenId: 'c1' }] },
    });
    await expect(
      tool.execute(
        {
          mealTime: 'lunch',
          scene: 'similar',
          triggerDishId: 'source',
          excludeDishIds: ['previous-option'],
          canteenId: '第一食堂',
          priceMax: 20,
          avoidIngredients: ['香菜'],
        },
        context,
      ),
    ).resolves.toEqual([{ id: 'main', canteenId: 'c1' }]);
    expect(dishes.getDishesByIds).toHaveBeenNthCalledWith(1, ['source'], 'u1');
    expect(dishes.getDishesByIds).toHaveBeenNthCalledWith(2, ['main'], 'u1');
    expect(recommendation.getRecommendations).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        scene: RecommendationScene.SIMILAR,
        triggerDishId: 'source',
        filter: {
          mealTime: ['lunch'],
          canteenId: ['c1'],
          price: { max: 20 },
          avoidIngredients: ['香菜'],
          excludeDishIds: ['previous-option'],
        },
        userContext: { diversifyCanteens: false },
      }),
    );
  });

  it('passes exclusions for new preference-based options without a source lookup', async () => {
    await tool.execute(
      { mealTime: 'lunch', excludeDishIds: ['previous-option'] },
      context,
    );
    expect(recommendation.getRecommendations).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        scene: RecommendationScene.GUESS_LIKE,
        filter: {
          mealTime: ['lunch'],
          excludeDishIds: ['previous-option'],
        },
      }),
    );
    expect(dishes.getDishesByIds).toHaveBeenCalledTimes(1);
  });

  it('rejects a similar request without its source before any lookup', async () => {
    await expect(
      tool.execute({ mealTime: 'lunch', scene: 'similar' }, context),
    ).rejects.toThrow(/triggerDishId/);
    expect(recommendation.getRecommendations).not.toHaveBeenCalled();
    expect(dishes.getDishesByIds).not.toHaveBeenCalled();
  });

  it.each([undefined, 'guess_like', 'today'])(
    'rejects a source under scene %s instead of silently changing the scene',
    async (scene) => {
      await expect(
        tool.execute(
          { mealTime: 'lunch', scene, triggerDishId: 'source' },
          context,
        ),
      ).rejects.toThrow(/triggerDishId.*similar/);
      expect(recommendation.getRecommendations).not.toHaveBeenCalled();
      expect(dishes.getDishesByIds).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing similarity source without requesting unrelated recommendations', async () => {
    dishes.getDishesByIds.mockResolvedValue({ data: { items: [] } });
    await expect(
      tool.execute(
        {
          mealTime: 'lunch',
          scene: 'similar',
          triggerDishId: 'deleted-source',
        },
        context,
      ),
    ).rejects.toThrow(/deleted-source.*不存在/);
    expect(recommendation.getRecommendations).not.toHaveBeenCalled();
  });

  it('rejects reversed price bounds before resolving candidate data', async () => {
    await expect(
      tool.execute({ mealTime: 'lunch', priceMin: 20, priceMax: 10 }, context),
    ).rejects.toThrow(/priceMin.*priceMax/);
    expect(recommendation.getRecommendations).not.toHaveBeenCalled();
    expect(canteens.resolveCanteenId).not.toHaveBeenCalled();
    expect(dishes.getDishesByIds).not.toHaveBeenCalled();
  });

  it('keeps empty recommendations empty without inventing or hydrating dishes', async () => {
    recommendation.getRecommendations.mockResolvedValue({
      data: { items: [] },
    });
    await expect(tool.execute({ mealTime: 'lunch' }, context)).resolves.toEqual(
      [],
    );
    expect(dishes.getDishesByIds).not.toHaveBeenCalled();
  });

  it('publishes bounded domain inputs without exposing ranking or experiment controls', () => {
    const schema = tool.getDefinition().parameters;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['mealTime']);
    expect(schema.properties.scene).toMatchObject({
      enum: ['guess_like', 'similar', 'today'],
      default: 'guess_like',
    });
    expect(schema.properties.triggerDishId).toMatchObject({
      type: 'string',
      minLength: 1,
    });
    expect(schema.properties.limit).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 5,
    });
    for (const field of ['priceMin', 'priceMax']) {
      expect(schema.properties[field]).toMatchObject({
        type: 'number',
        minimum: 0,
      });
    }
    expect(schema.properties.minRating).toMatchObject({
      minimum: 0,
      maximum: 5,
    });
    for (const field of ['spicyLevel', 'sweetness', 'saltiness', 'oiliness']) {
      expect(schema.properties[field]).toMatchObject({
        type: 'integer',
        minimum: 0,
        maximum: 5,
      });
    }
    for (const field of [
      'tags',
      'meatPreference',
      'avoidIngredients',
      'favoriteIngredients',
      'excludeDishIds',
    ]) {
      expect(schema.properties[field]).toMatchObject({
        type: 'array',
        maxItems: 100,
        uniqueItems: true,
        items: { type: 'string', minLength: 1 },
      });
    }
    for (const field of ['experimentId', 'groupItemId', 'weights', 'version']) {
      expect(schema.properties).not.toHaveProperty(field);
    }
  });
});
