import { CreateMealPlanTool } from './create-meal-plan.tool';

describe('CreateMealPlanTool meal constraints', () => {
  const context = { userId: 'u1', sessionId: 's1' };
  const params = {
    dishIds: ['main', 'side'],
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    mealTime: 'lunch',
  };
  const main = {
    id: 'main',
    name: '鸡肉饭',
    canteenId: 'c1',
    canteenName: '第一食堂',
    price: 15,
    status: 'online',
    availableMealTime: ['lunch'],
    ingredients: ['鸡肉'],
    allergens: [],
  };
  const side = {
    id: 'side',
    name: '清炒时蔬',
    canteenId: 'c1',
    canteenName: '第一食堂',
    price: 5,
    status: 'online',
    availableMealTime: ['lunch'],
    ingredients: ['白菜'],
    allergens: [],
  };
  let dishes: any;
  let recommendations: any;
  let tool: CreateMealPlanTool;

  beforeEach(() => {
    dishes = {
      getDishesByIds: jest
        .fn()
        .mockResolvedValue({ data: { items: [main, side] } }),
    };
    recommendations = {
      getUserFeaturesWithCache: jest.fn().mockResolvedValue({
        allergens: [],
        preferences: { avoidIngredients: [], priceMax: 15 },
      }),
    };
    tool = new (CreateMealPlanTool as any)(dishes, recommendations);
  });

  it('creates a faithful same-canteen draft and uses whole-meal budget only when supplied', async () => {
    const draft = await tool.execute(params, context);
    expect(draft.previewData.dishes.map((dish: any) => dish.id)).toEqual(
      draft.confirmAction.body.dishes,
    );
    expect(draft.confirmAction.body.dishes).toEqual(['main', 'side']);
    await expect(
      tool.execute({ ...params, totalBudget: 20 }, context),
    ).resolves.toMatchObject({ previewData: { mealTime: 'lunch' } });
    await expect(
      tool.execute({ ...params, totalBudget: 19 }, context),
    ).rejects.toThrow('预算');
  });

  it('compares total and budget in cents without floating-point rejection', async () => {
    dishes.getDishesByIds.mockResolvedValue({
      data: {
        items: [
          { ...main, price: 0.1 },
          { ...side, price: 0.2 },
        ],
      },
    });
    await expect(
      tool.execute({ ...params, totalBudget: 0.3 }, context),
    ).resolves.toMatchObject({ constraints: { totalBudget: 0.3 } });
    await expect(
      tool.execute({ ...params, totalBudget: 0.29 }, context),
    ).rejects.toThrow('预算');
  });

  it('rejects a cross-canteen meal unless explicitly opted in', async () => {
    dishes.getDishesByIds.mockResolvedValue({
      data: { items: [main, { ...side, canteenId: 'c2' }] },
    });
    await expect(tool.execute(params, context)).rejects.toThrow('同一个食堂');
    await expect(
      tool.execute({ ...params, allowCrossCanteen: true }, context),
    ).resolves.toMatchObject({
      confirmAction: { body: { dishes: ['main', 'side'] } },
    });
  });

  it('does not create a draft with IDs missing from the preview', async () => {
    dishes.getDishesByIds.mockResolvedValue({ data: { items: [main] } });
    await expect(tool.execute(params, context)).rejects.toThrow('菜品');
  });

  it.each([{ status: 'offline' }, { availableMealTime: ['breakfast'] }])(
    'rejects a dish that is not available for this meal: %o',
    async (override) => {
      dishes.getDishesByIds.mockResolvedValue({
        data: { items: [main, { ...side, ...override }] },
      });
      await expect(tool.execute(params, context)).rejects.toThrow('供应');
    },
  );

  it.each([
    {
      allergens: ['花生'],
      preferences: { avoidIngredients: [] },
      override: { allergens: ['花生'] },
    },
    {
      allergens: [],
      preferences: { avoidIngredients: ['白菜'] },
      override: {},
    },
  ])(
    'honors persisted dietary exclusions: %o',
    async ({ allergens, preferences, override }) => {
      recommendations.getUserFeaturesWithCache.mockResolvedValue({
        allergens,
        preferences,
      });
      dishes.getDishesByIds.mockResolvedValue({
        data: { items: [main, { ...side, ...override }] },
      });
      await expect(tool.execute(params, context)).rejects.toThrow('忌口');
    },
  );

  it.each([
    { startDate: '2026-02-31', endDate: '2026-03-03' },
    { startDate: '2026-10-06', endDate: '2026-10-05' },
  ])('rejects an invalid date interval: %o', async (interval) => {
    await expect(
      tool.execute({ ...params, ...interval }, context),
    ).rejects.toThrow('日期');
  });
});
