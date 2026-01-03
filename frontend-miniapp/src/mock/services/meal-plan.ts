// Mock 饮食计划服务
import type { MealPlan, MealPlanRequest } from '@/types/api';
import {
  getMockPlanDatabase,
  addMockPlan,
  updateMockPlan,
  deleteMockPlan,
  getMockPlanById,
  resetMockPlanDatabase,
} from '../data/meal-plan';
import dayjs from 'dayjs';

// 模拟网络延迟
const mockDelay = (min = 200, max = 500) =>
  new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

// 生成唯一ID
const generateId = () => `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * 获取饮食计划列表
 */
export const mockGetMealPlans = async (): Promise<MealPlan[]> => {
  console.log('📅 [Mock] 获取饮食计划列表');
  await mockDelay();

  const plans = getMockPlanDatabase();
  console.log(`✅ [Mock] 返回 ${plans.length} 个饮食计划`);

  // 按开始日期倒序排列
  return [...plans].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
};

/**
 * 根据ID获取饮食计划
 */
export const mockGetMealPlanById = async (planId: string): Promise<MealPlan | null> => {
  console.log(`📅 [Mock] 获取饮食计划详情: ${planId}`);
  await mockDelay(100, 300);

  const plan = getMockPlanById(planId);

  if (plan) {
    console.log(`✅ [Mock] 找到规划: ${planId}`);
    return plan;
  } else {
    console.warn(`⚠️ [Mock] 规划不存在: ${planId}`);
    return null;
  }
};

/**
 * 创建饮食计划
 */
export const mockCreateMealPlan = async (planData: MealPlanRequest): Promise<MealPlan> => {
  console.log('📅 [Mock] 创建饮食计划', planData);
  await mockDelay(300, 600);

  const newPlan: MealPlan = {
    id: generateId(),
    userId: 'mock_user_001',
    startDate: planData.startDate || dayjs().format('YYYY-MM-DD'),
    endDate: planData.endDate || dayjs().format('YYYY-MM-DD'),
    mealTime: planData.mealTime || 'lunch',
    dishes: planData.dishes || [],
    createdAt: new Date().toISOString(),
  };

  addMockPlan(newPlan);
  console.log(`✅ [Mock] 创建成功: ${newPlan.id}`);

  return newPlan;
};

/**
 * 更新饮食计划
 */
export const mockUpdateMealPlan = async (
  planId: string,
  planData: Partial<MealPlanRequest>
): Promise<MealPlan | null> => {
  console.log(`📅 [Mock] 更新饮食计划: ${planId}`, planData);
  await mockDelay(300, 600);

  const updatedPlan = updateMockPlan(planId, {
    startDate: planData.startDate,
    endDate: planData.endDate,
    mealTime: planData.mealTime,
    dishes: planData.dishes,
  });

  if (updatedPlan) {
    console.log(`✅ [Mock] 更新成功: ${planId}`);
    return updatedPlan;
  } else {
    console.warn(`⚠️ [Mock] 更新失败，规划不存在: ${planId}`);
    return null;
  }
};

/**
 * 创建或更新饮食计划
 */
export const mockCreateOrUpdateMealPlan = async (planData: MealPlanRequest): Promise<MealPlan> => {
  console.log('📅 [Mock] 创建/更新饮食计划', planData);
  await mockDelay(300, 600);

  // 检查是否存在相同日期和用餐时间的规划
  const plans = getMockPlanDatabase();
  const existingPlan = plans.find(
    p => p.startDate === planData.startDate && p.mealTime === planData.mealTime
  );

  if (existingPlan) {
    // 更新现有规划
    const updated = updateMockPlan(existingPlan.id, {
      endDate: planData.endDate,
      dishes: planData.dishes,
    });
    console.log(`✅ [Mock] 更新现有规划: ${existingPlan.id}`);
    return updated!;
  } else {
    // 创建新规划
    return mockCreateMealPlan(planData);
  }
};

/**
 * 删除饮食计划
 */
export const mockDeleteMealPlan = async (planId: string): Promise<boolean> => {
  console.log(`📅 [Mock] 删除饮食计划: ${planId}`);
  await mockDelay(200, 400);

  const success = deleteMockPlan(planId);

  if (success) {
    console.log(`✅ [Mock] 删除成功: ${planId}`);
  } else {
    console.warn(`⚠️ [Mock] 删除失败，规划不存在: ${planId}`);
  }

  return success;
};

/**
 * 获取当前有效的规划（未过期）
 */
export const mockGetCurrentPlans = async (): Promise<MealPlan[]> => {
  console.log('📅 [Mock] 获取当前规划');
  await mockDelay();

  const plans = getMockPlanDatabase();
  const now = dayjs();

  const currentPlans = plans.filter(p => dayjs(p.endDate).isAfter(now, 'day'));
  console.log(`✅ [Mock] 返回 ${currentPlans.length} 个当前规划`);

  return currentPlans;
};

/**
 * 获取历史规划（已过期）
 */
export const mockGetHistoryPlans = async (): Promise<MealPlan[]> => {
  console.log('📅 [Mock] 获取历史规划');
  await mockDelay();

  const plans = getMockPlanDatabase();
  const now = dayjs();

  const historyPlans = plans.filter(p => dayjs(p.endDate).isBefore(now, 'day'));
  console.log(`✅ [Mock] 返回 ${historyPlans.length} 个历史规划`);

  return historyPlans;
};

/**
 * 按用餐时间筛选规划
 */
export const mockGetPlansByMealTime = async (
  mealTime: 'breakfast' | 'lunch' | 'dinner' | 'nightsnack'
): Promise<MealPlan[]> => {
  console.log(`📅 [Mock] 按用餐时间筛选: ${mealTime}`);
  await mockDelay();

  const plans = getMockPlanDatabase();
  const filtered = plans.filter(p => p.mealTime === mealTime);

  console.log(`✅ [Mock] 返回 ${filtered.length} 个 ${mealTime} 规划`);
  return filtered;
};

/**
 * 按日期范围筛选规划
 */
export const mockGetPlansByDateRange = async (
  startDate: string,
  endDate: string
): Promise<MealPlan[]> => {
  console.log(`📅 [Mock] 按日期范围筛选: ${startDate} - ${endDate}`);
  await mockDelay();

  const plans = getMockPlanDatabase();
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  const filtered = plans.filter(p => {
    const planStart = dayjs(p.startDate);
    const planEnd = dayjs(p.endDate);
    // 规划的时间范围与查询范围有交集
    return planStart.isBefore(end) && planEnd.isAfter(start);
  });

  console.log(`✅ [Mock] 返回 ${filtered.length} 个规划`);
  return filtered;
};

/**
 * 重置 Mock 数据（用于测试）
 */
export const mockResetMealPlans = () => {
  console.log('🔄 [Mock] 重置饮食计划数据');
  resetMockPlanDatabase();
};

/**
 * 模拟执行规划（标记为已完成）
 * 注意：实际的完成状态由前端 store 管理，这里仅用于测试
 */
export const mockExecutePlan = async (planId: string): Promise<boolean> => {
  console.log(`📅 [Mock] 执行规划: ${planId}`);
  await mockDelay(200, 400);

  const plan = getMockPlanById(planId);
  if (plan) {
    console.log(`✅ [Mock] 规划已标记为执行: ${planId}`);
    return true;
  }

  console.warn(`⚠️ [Mock] 执行失败，规划不存在: ${planId}`);
  return false;
};
