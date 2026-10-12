// @/api/modules/mealPlan.ts
import request from '@/utils/request';
import type { MealPlan, MealPlanRequest, ApiResponse } from '@/types/api';

/**
 * 获取饮食计划
 */
export const getMealPlans = (query?: {
  startDate?: string;
  endDate?: string;
  mealTime?: MealPlan['mealTime'];
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<{ items: MealPlan[] }>> => {
  return request<{ items: MealPlan[] }>({
    url: '/meal-plans',
    method: 'GET',
    ...(query ? { data: query } : {}),
  });
};

/**
 * 创建饮食计划
 */
export const createMealPlan = (planData: MealPlanRequest): Promise<ApiResponse<MealPlan>> => {
  return request<MealPlan>({
    url: '/meal-plans',
    method: 'POST',
    data: planData,
  });
};

/**
 * 更新饮食计划
 */
export const updateMealPlan = (
  planData: MealPlanRequest,
  id: string
): Promise<ApiResponse<MealPlan>> => {
  return request<MealPlan>({
    url: `/meal-plans/${id}`,
    method: 'PUT',
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

export const setMealPlanCompletion = (id: string, date: string, completed: boolean) =>
  request<MealPlan>({
    url: `/meal-plans/${encodeURIComponent(id)}/completions/${encodeURIComponent(date)}`,
    method: completed ? 'PUT' : 'DELETE',
  });

export interface DiningApplication {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  user: { id: string; nickname: string; avatar: string };
}

export interface DiningInvite {
  id: string;
  mealPlanId?: string;
  host: { id: string; nickname: string; avatar: string };
  date: string;
  startsAt: string;
  mealTime: MealPlan['mealTime'];
  canteen: { id: string; name: string };
  capacity: number;
  acceptedCount: number;
  status: 'open' | 'full' | 'expired' | 'cancelled';
  myApplication?: Pick<DiningApplication, 'id' | 'status'>;
  applications?: DiningApplication[];
}

export interface CreateDiningInviteRequest {
  date: string;
  startsAt: string;
  canteenId: string;
  capacity: number;
}

export const createDiningInvite = (planId: string, body: CreateDiningInviteRequest) =>
  request<DiningInvite>({
    url: `/meal-plans/${encodeURIComponent(planId)}/dining-invites`,
    method: 'POST',
    data: body,
  });
export const getDiningInvites = (mine = false, page = 1) =>
  request<{ items: DiningInvite[]; meta: { page: number; totalPages: number } }>({
    url: mine ? '/dining-invites/mine' : '/dining-invites',
    method: 'GET',
    data: { page, pageSize: 20 },
  });
export const getDiningInvite = (id: string) =>
  request<DiningInvite>({ url: `/dining-invites/${encodeURIComponent(id)}`, method: 'GET' });
export const applyDiningInvite = (id: string) =>
  request<DiningInvite>({
    url: `/dining-invites/${encodeURIComponent(id)}/applications`,
    method: 'POST',
  });
export const decideDiningApplication = (
  id: string,
  applicationId: string,
  action: 'accept' | 'reject'
) =>
  request<DiningInvite>({
    url: `/dining-invites/${encodeURIComponent(id)}/applications/${encodeURIComponent(applicationId)}`,
    method: 'PUT',
    data: { action },
  });
export const withdrawDiningApplication = (id: string) =>
  request<DiningInvite>({
    url: `/dining-invites/${encodeURIComponent(id)}/applications/me`,
    method: 'DELETE',
  });
export const cancelDiningInvite = (id: string) =>
  request<DiningInvite>({ url: `/dining-invites/${encodeURIComponent(id)}`, method: 'DELETE' });
