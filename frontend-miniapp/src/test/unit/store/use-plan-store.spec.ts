jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'user' } }),
}));

import { setActivePinia, createPinia } from 'pinia';

// mock global uni storage
(global as any).uni = {
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn().mockReturnValue([]),
};

// mock APIs
jest.mock('@/api/modules/meal-plan');
jest.mock('@/api/modules/dish');

import * as mealPlanModule from '@/api/modules/meal-plan';
import * as dishModule from '@/api/modules/dish';
const getMealPlans = mealPlanModule.getMealPlans as jest.Mock;
const createMealPlan = mealPlanModule.createMealPlan as jest.Mock;
const updateMealPlan = mealPlanModule.updateMealPlan as jest.Mock;
const deleteMealPlan = mealPlanModule.deleteMealPlan as jest.Mock;
const setMealPlanCompletion = mealPlanModule.setMealPlanCompletion as jest.Mock;
const getDishById = dishModule.getDishById as jest.Mock;
import { usePlanStore } from '@/store/modules/use-plan-store';

describe('store/modules/use-plan-store', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    setActivePinia(createPinia());
    setMealPlanCompletion.mockImplementation(async (id: string, date: string, completed: boolean) => {
      const plan = usePlanStore().allPlans.find(item => item.id === id)!;
      return { code: 200, data: { ...plan, completedDates: completed ? [...(plan.completedDates || []), date] : (plan.completedDates || []).filter(value => value !== date) } };
    });
    // ensure global uni mocks remain
    (global as any).uni = (global as any).uni || {
      setStorageSync: jest.fn(),
      getStorageSync: jest.fn().mockReturnValue([]),
    };
  });

  test('fetchPlans populates plans and dishMap on success', async () => {
    const mealPlans = [
      {
        id: 'p1',
        dishes: ['d1'],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        mealTime: 'lunch',
      },
    ];
    (getMealPlans as jest.Mock).mockResolvedValue({ code: 200, data: { items: mealPlans } });
    (getDishById as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'd1', name: 'D' } });

    const store = usePlanStore();

    await store.fetchPlans();

    expect(store.allPlans.length).toBe(1);
    expect(store.enrichedPlans[0].dishes[0].id).toBe('d1');
  });

  test('fetchPlans rejects incomplete dish data without publishing an editable plan', async () => {
    const mealPlans = [
      {
        id: 'p1',
        dishes: ['bad'],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        mealTime: 'lunch',
      },
    ];
    (getMealPlans as jest.Mock).mockResolvedValue({ code: 200, data: { items: mealPlans } });
    (getDishById as jest.Mock).mockRejectedValue(new Error('fail'));

    const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    const store = usePlanStore();

    await expect(store.fetchPlans()).rejects.toThrow('fail');

    expect(store.allPlans.length).toBe(0);
    expect(store.initialized).toBe(false);
    expect(store.error).toBe('fail');
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  test('createPlan adds new plan and fetches dishes', async () => {
    const newPlan = {
      id: 'np',
      dishes: ['d2'],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      mealTime: 'breakfast',
    };
    (createMealPlan as jest.Mock).mockResolvedValue({ code: 201, data: newPlan });
    (getDishById as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'd2', name: 'DD' } });

    const store = usePlanStore();

    const created = await store.createPlan({} as any);
    expect(created.id).toBe('np');
    expect(store.allPlans[0].id).toBe('np');
    expect(store.enrichedPlans[0].dishes[0].id).toBe('d2');
  });

  test('updatePlan updates existing plan or inserts when missing', async () => {
    const existing = {
      id: 'e1',
      dishes: [],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      mealTime: 'lunch',
      userId: '',
      createdAt: '',
    };
    const updated = {
      id: 'e1',
      dishes: [],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      mealTime: 'dinner',
      userId: '',
      createdAt: '',
    };

    (updateMealPlan as jest.Mock).mockResolvedValue({ code: 200, data: updated });
    (getDishById as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'dX', name: 'D' } });

    const store = usePlanStore();
    store.allPlans = [existing as any];

    const res = await store.updatePlan('e1', {} as any);
    expect(res.id).toBe('e1');
    expect(store.allPlans.find(p => p.id === 'e1')?.mealTime).toBe('dinner');

    // missing id -> inserts front
    (updateMealPlan as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        id: 'new',
        dishes: [],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        mealTime: 'lunch',
      },
    });
    const inserted = await store.updatePlan('missing', {} as any);
    expect(store.allPlans[0].id).toBe('new');
  });

  test('removePlan deletes plan by id', async () => {
    (deleteMealPlan as jest.Mock).mockResolvedValue({ code: 200, data: null });
    const store = usePlanStore();

    store.allPlans = [
      {
        id: 'r1',
        dishes: [],
        startDate: '',
        endDate: '',
        mealTime: 'lunch',
        userId: '',
        createdAt: '',
      },
      {
        id: 'r2',
        dishes: [],
        startDate: '',
        endDate: '',
        mealTime: 'lunch',
        userId: '',
        createdAt: '',
      },
    ];
    await store.removePlan('r1');
    expect(store.allPlans.find(p => p.id === 'r1')).toBeUndefined();
  });

  test('executePlan persists the selected occurrence through the API', async () => {
    const store = usePlanStore();
    store.allPlans = [
      {
        id: 'ex1',
        dishes: [],
        startDate: '',
        endDate: '',
        mealTime: 'lunch',
        userId: '',
        createdAt: '',
      },
    ];

    await store.executePlan('ex1');
    expect(setMealPlanCompletion).toHaveBeenCalledWith('ex1', '', true);
    expect((global as any).uni.setStorageSync).not.toHaveBeenCalled();

    // execute non-existing plan should throw
    await expect(store.executePlan('no')).rejects.toThrow('规划不存在');
  });

  test('getPlanById returns enriched plan and history/current separation', async () => {
    const now = new Date();
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();

    jest.doMock('@/api/modules/dish', () => ({
      getDishById: (id: string) => Promise.resolve({ code: 200, data: { id, name: 'D' } }),
    }));
    jest.doMock('@/api/modules/meal-plan', () => ({
      getMealPlans: () => Promise.resolve({ code: 200, data: { items: [] } }),
    }));

    const store = usePlanStore();

    store.allPlans = [
      { id: 'h1', dishes: [], startDate: past, endDate: past, mealTime: 'lunch' } as any,
      { id: 'c1', dishes: [], startDate: future, endDate: future, mealTime: 'lunch' } as any,
    ];

    // mark h1 as completed
    await store.executePlan('h1');

    expect(store.historyPlans.length).toBeGreaterThan(0);
    expect(store.currentPlans.length).toBeGreaterThan(0);
    expect(store.getPlanById('h1')?.id).toBe('h1');
  });

  test('fetchPlans returns early when there are no dish ids', async () => {
    const mealPlans = [
      {
        id: 'p-empty',
        dishes: [],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        mealTime: 'lunch',
      },
    ];
    (getMealPlans as jest.Mock).mockResolvedValue({ code: 200, data: { items: mealPlans } });

    const store = usePlanStore();
    await store.fetchPlans();

    expect(getDishById).not.toHaveBeenCalled();
    expect(store.allPlans[0].dishes.length).toBe(0);
  });

  test('fetchPlans treats non-200 required dish responses as a recoverable read failure', async () => {
    const mealPlans = [
      {
        id: 'p2',
        dishes: ['dx'],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        mealTime: 'lunch',
      },
    ];
    (getMealPlans as jest.Mock).mockResolvedValue({ code: 200, data: { items: mealPlans } });
    (getDishById as jest.Mock).mockResolvedValue({ code: 404, data: null });

    const store = usePlanStore();
    await expect(store.fetchPlans()).rejects.toThrow('规划菜品资料暂时无法读取');

    expect(store.enrichedPlans.length).toBe(0);
    expect(store.initialized).toBe(false);
    expect(store.error).toContain('重试');
  });

  test('executePlan leaves completion unchanged when the server rejects it', async () => {
    const store = usePlanStore();
    store.allPlans = [
      {
        id: 's1',
        dishes: [],
        startDate: '',
        endDate: '',
        mealTime: 'lunch',
        userId: '',
        createdAt: '',
      },
    ];

    setMealPlanCompletion.mockRejectedValueOnce(new Error('save failed'));
    await expect(store.executePlan('s1')).rejects.toThrow('save failed');
    expect(store.getPlanById('s1')?.isCompleted).toBe(false);
    expect((global as any).uni.setStorageSync).not.toHaveBeenCalled();
  });

  test('legacy whole-plan local completion is not read as daily completion authority', async () => {
    // reset modules to simulate init-time behavior
    jest.resetModules();
    const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});

    const origUni = (global as any).uni;
    (global as any).uni = {
      getStorageSync: jest.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
      setStorageSync: jest.fn(),
    };

    // ensure active Pinia is set in the fresh module context
    const piniaModule = await import('pinia');
    piniaModule.setActivePinia(piniaModule.createPinia());

    const storeModule = await import('@/store/modules/use-plan-store');
    const store2 = storeModule.usePlanStore();

    expect(consoleErr).not.toHaveBeenCalled();
    expect((global as any).uni.getStorageSync).not.toHaveBeenCalled();
    expect(store2.allPlans).toEqual([]);

    // restore
    (global as any).uni = origUni;
    consoleErr.mockRestore();
  });

  test('sortPlans places unknown mealTime at the end when dates are equal', () => {
    const date = new Date().toISOString();
    const a = { id: 'a', dishes: [], startDate: date, endDate: date, mealTime: 'weird' };
    const b = { id: 'b', dishes: [], startDate: date, endDate: date, mealTime: 'breakfast' };

    const store = usePlanStore();
    store.allPlans = [a as any, b as any];

    const current = store.currentPlans;
    expect(current[0].id).toBe('b');
  });
});
