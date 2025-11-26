// @/api/modules/mealPlan.ts
import request from '@/utils/request';
import type { MealPlan, MealPlanRequest, ApiResponse, SuccessResponse } from '@/types/api';
import { USE_MOCK, mockGetMealPlans, mockCreateOrUpdateMealPlan, mockDeleteMealPlan } from '@/mock';

/**
 * 获取饮食计划
 */
export const getMealPlans = async (): Promise<ApiResponse<{ items: MealPlan[] }>> => {
  if (USE_MOCK) {
    const items = await mockGetMealPlans();
    return {
      code: 200,
      message: 'Success',
      data: {
        items,
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
export const createOrUpdateMealPlan = async (
  planData: MealPlanRequest
): Promise<ApiResponse<MealPlan>> => {
  if (USE_MOCK) {
    const plan = await mockCreateOrUpdateMealPlan(planData);
    return {
      code: 200,
      message: 'Success',
      data: plan,
    };
  }
  
  return request<MealPlan>({
    url: '/meal-plans',
    method: 'POST',
    data: planData,
  });
};

/**
 * 删除饮食计划
 */
export const deleteMealPlan = async (planId: string): Promise<ApiResponse<null>> => {
  if (USE_MOCK) {
    await mockDeleteMealPlan(planId);
    return {
      code: 200,
      message: 'Success',
      data: null,
    };
  }
  
  return request<null>({
    url: `/meal-plans/${planId}`,
    method: 'DELETE',
  });
};