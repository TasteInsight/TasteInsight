// @/api/modules/mealPlan.ts
import request from '@/utils/request';
import type { MealPlan, MealPlanRequest, ApiResponse, SuccessResponse } from '@/types/api';

// ========== Mock 配置 ==========
const USE_MOCK = true;

const mockDelay = (ms: number = 300) => 
  new Promise(resolve => setTimeout(resolve, ms));

const createMockMealPlans = (): MealPlan[] => [
  {
    id: 'plan_001',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
    mealTime: 'breakfast',
    dishes: ['dish_001', 'dish_004'],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'plan_002',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
    mealTime: 'lunch',
    dishes: ['dish_003', 'dish_004', 'dish_005'],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'plan_003',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
    mealTime: 'dinner',
    dishes: ['dish_002', 'dish_005'],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'plan_004',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
    mealTime: 'lunch',
    dishes: ['dish_001', 'dish_003'],
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'plan_005',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 86400000 * 15).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
    mealTime: 'dinner',
    dishes: ['dish_002', 'dish_004'],
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
];

const mockMealPlansDatabase = createMockMealPlans();
// ========== End Mock 配置 ==========

/**
 * 获取饮食计划
 */
export const getMealPlans = async (): Promise<ApiResponse<{ items: MealPlan[] }>> => {
  if (USE_MOCK) {
    await mockDelay(400);
    console.log('📅 [Mock] 获取饮食计划:', mockMealPlansDatabase);
    return {
      code: 200,
      message: 'Success',
      data: {
        items: mockMealPlansDatabase,
      },
    };
  }
  
  return request<{ items: MealPlan[] }>({
    url: '/meal-plans',
    method: 'GET',
  });
};

/**
 * 创建/更新饮食计划
 */
export const createOrUpdateMealPlan = (
  planData: MealPlanRequest
): Promise<ApiResponse<MealPlan>> => {
  return request<MealPlan>({
    url: '/meal-plans',
    method: 'POST',
    data: planData,
  });
};

/**
 * 删除饮食计划
 */
export const deleteMealPlan = (planId: string): Promise<ApiResponse<null>> => {
  return request<null>({
    url: `/meal-plans/${planId}`,
    method: 'DELETE',
  });
};