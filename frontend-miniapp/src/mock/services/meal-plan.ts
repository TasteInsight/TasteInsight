// Mock 饮食计划服务
import type { MealPlan } from '@/types/api';
import { createMockMealPlans } from '../data/meal-plan';

// 模拟网络延迟
const mockDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 300));

// 获取饮食计划列表
export const mockGetMealPlans = async (): Promise<MealPlan[]> => {
  console.log('📅 [Mock] 获取饮食计划');
  await mockDelay();
  
  const plans = createMockMealPlans();
  console.log(`✅ [Mock] 返回 ${plans.length} 个饮食计划`);
  return plans;
};
