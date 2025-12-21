/// <reference types="jest" />
import { setActivePinia, createPinia } from 'pinia';

// NOTE: usePlanStore reads local storage during module init.
// We must define `uni` BEFORE requiring the store module.
const mockGetStorageSync = jest.fn();
const mockSetStorageSync = jest.fn();

(global as any).uni = {
  getStorageSync: mockGetStorageSync,
  setStorageSync: mockSetStorageSync,
};

jest.mock('@/api/modules/meal-plan', () => ({
  getMealPlans: jest.fn(),
  createMealPlan: jest.fn(),
  updateMealPlan: jest.fn(),
  deleteMealPlan: jest.fn(),
}));

jest.mock('@/api/modules/dish', () => ({
  getDishById: jest.fn(),
  getDishes: jest.fn(),
  favoriteDish: jest.fn(),
  unfavoriteDish: jest.fn(),
  uploadDish: jest.fn(),
}));

describe('usePlanStore integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockGetStorageSync.mockReturnValue([]);
  });

  it('fetchPlans: should load plans and enrich dishes', async () => {
    const { getMealPlans } = require('@/api/modules/meal-plan');
    const { getDishById } = require('@/api/modules/dish');
    const { usePlanStore } = require('@/store/modules/use-plan-store');

    (getMealPlans as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            id: 'p1',
            startDate: '2025-12-18',
            endDate: '2025-12-18',
            mealTime: 'lunch',
            dishes: ['d1', 'd2'],
          },
        ],
      },
    });

    (getDishById as jest.Mock)
      .mockResolvedValueOnce({ code: 200, data: { id: 'd1', name: 'Dish 1' } })
      .mockResolvedValueOnce({ code: 200, data: { id: 'd2', name: 'Dish 2' } });

    const store = usePlanStore();
    await store.fetchPlans();

    expect(store.allPlans.length).toBe(1);
    expect(store.enrichedPlans.length).toBe(1);
    expect(store.enrichedPlans[0].dishes.map((d: any) => d.id)).toEqual(['d1', 'd2']);
    expect(store.error).toBe(null);
  });

  it('createPlan: should prepend plan and enrich new dishes', async () => {
    const { createMealPlan } = require('@/api/modules/meal-plan');
    const { getDishById } = require('@/api/modules/dish');
    const { usePlanStore } = require('@/store/modules/use-plan-store');

    (createMealPlan as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        id: 'p2',
        startDate: '2025-12-18',
        endDate: '2025-12-18',
        mealTime: 'dinner',
        dishes: ['d3'],
      },
    });

    (getDishById as jest.Mock).mockResolvedValueOnce({ code: 200, data: { id: 'd3', name: 'Dish 3' } });

    const store = usePlanStore();
    const created = await store.createPlan({
      startDate: '2025-12-18',
      endDate: '2025-12-18',
      mealTime: 'dinner',
      dishes: ['d3'],
    });

    expect(created.id).toBe('p2');
    expect(store.allPlans[0].id).toBe('p2');
    expect(store.enrichedPlans.find((p: any) => p.id === 'p2')?.dishes[0]?.id).toBe('d3');
  });

  it('executePlan: should mark completed and persist ids', async () => {
    const { usePlanStore } = require('@/store/modules/use-plan-store');

    const store = usePlanStore();
    // seed plan - ensure it's not expired and not completed
    const futureDate = '2025-12-25'; // Future date to ensure not expired
    store.allPlans = [
      {
        id: 'p3',
        startDate: futureDate,
        endDate: futureDate,
        mealTime: 'breakfast',
        dishes: [],
      } as any,
    ];
    // Ensure dishMap has the necessary data
    store.dishMap = new Map();

    // Before: should be in currentPlans
    expect(store.currentPlans.map((p: any) => p.id)).toContain('p3');
    expect(store.historyPlans.map((p: any) => p.id)).not.toContain('p3');

    await store.executePlan('p3');

    // After: should be moved to historyPlans
    expect(store.currentPlans.map((p: any) => p.id)).not.toContain('p3');
    expect(store.historyPlans.map((p: any) => p.id)).toContain('p3');
    expect(mockSetStorageSync).toHaveBeenCalledWith('completedPlanIds', expect.any(Array));
  });
});
