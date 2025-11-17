// @/api/modules/mealPlan.ts
import request from '@/utils/request';
import type { MealPlan, MealPlanRequest, ApiResponse, SuccessResponse } from '@/types/api';

/**
 * 获取饮食计划
 */
export const getMealPlans = (): Promise<ApiResponse<{ items: MealPlan[] }>> => {
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