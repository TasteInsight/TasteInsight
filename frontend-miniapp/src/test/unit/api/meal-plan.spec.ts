import { jest } from '@jest/globals';

describe('api/modules/meal-plan.ts', () => {
  const MODULE_PATH = '@/api/modules/meal-plan';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('getMealPlans GETs /meal-plans', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { items: [] } });
    jest.doMock('@/utils/request', () => mockReq);

    const { getMealPlans } = require(MODULE_PATH);
    await getMealPlans();

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/meal-plans',
      method: 'GET',
    });
  });

  test('createMealPlan POSTs payload', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 201, data: { id: 'm1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { createMealPlan } = require(MODULE_PATH);
    const payload = { title: 'Plan' } as any;
    const res = await createMealPlan(payload);

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/meal-plans',
      method: 'POST',
      data: payload,
    });
    expect(res.code).toBe(201);
  });

  test('updateMealPlan PATCHes with id', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: { id: 'm1' } });
    jest.doMock('@/utils/request', () => mockReq);

    const { updateMealPlan } = require(MODULE_PATH);
    await updateMealPlan({ title: 'x' } as any, 'm1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/meal-plans/m1',
      method: 'PATCH',
    });
  });

  test('deleteMealPlan DELETEs with planId', async () => {
    const mockReq = jest.fn() as unknown as jest.Mock<any, any>;
    mockReq.mockResolvedValue({ code: 200, data: null });
    jest.doMock('@/utils/request', () => mockReq);

    const { deleteMealPlan } = require(MODULE_PATH);
    await deleteMealPlan('m1');

    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockReq.mock.calls[0][0]).toMatchObject({
      url: '/meal-plans/m1',
      method: 'DELETE',
    });
  });
});