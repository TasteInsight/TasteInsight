// Mock 饮食计划数据
import type { MealPlan } from '@/types/api';
import dayjs from 'dayjs';

// 辅助函数：生成日期字符串
const dateStr = (daysOffset: number) => 
  dayjs().add(daysOffset, 'day').format('YYYY-MM-DD');

const isoDate = (daysOffset: number) => 
  dayjs().add(daysOffset, 'day').toISOString();

export const createMockMealPlans = (): MealPlan[] => [
  // ========== 当前规划（未过期） ==========
  
  // 今天的早餐规划
  {
    id: 'plan_001',
    userId: 'mock_user_001',
    startDate: dateStr(0),
    endDate: dateStr(3),
    mealTime: 'breakfast',
    dishes: ['dish_004', 'dish_006'],
    createdAt: isoDate(-1),
  },
  
  // 今天的午餐规划
  {
    id: 'plan_002',
    userId: 'mock_user_001',
    startDate: dateStr(0),
    endDate: dateStr(5),
    mealTime: 'lunch',
    dishes: ['dish_001', 'dish_003', 'dish_004'],
    createdAt: isoDate(-2),
  },
  
  // 今天的晚餐规划
  {
    id: 'plan_003',
    userId: 'mock_user_001',
    startDate: dateStr(0),
    endDate: dateStr(7),
    mealTime: 'dinner',
    dishes: ['dish_002', 'dish_005'],
    createdAt: isoDate(-1),
  },
  
  // 今天的夜宵规划
  {
    id: 'plan_004',
    userId: 'mock_user_001',
    startDate: dateStr(0),
    endDate: dateStr(2),
    mealTime: 'nightsnack',
    dishes: ['dish_007'],
    createdAt: isoDate(0),
  },
  
  // 未来开始的规划（下周）
  {
    id: 'plan_005',
    userId: 'mock_user_001',
    startDate: dateStr(7),
    endDate: dateStr(14),
    mealTime: 'lunch',
    dishes: ['dish_001', 'dish_002', 'dish_004'],
    createdAt: isoDate(0),
  },
  
  // 即将到期的规划（明天结束）
  {
    id: 'plan_006',
    userId: 'mock_user_001',
    startDate: dateStr(-3),
    endDate: dateStr(1),
    mealTime: 'dinner',
    dishes: ['dish_003', 'dish_005'],
    createdAt: isoDate(-4),
  },
  
  // ========== 历史规划（已过期） ==========
  
  // 刚过期的规划（昨天结束）- 应显示"未完成"
  {
    id: 'plan_history_001',
    userId: 'mock_user_001',
    startDate: dateStr(-5),
    endDate: dateStr(-1),
    mealTime: 'lunch',
    dishes: ['dish_001', 'dish_004'],
    createdAt: isoDate(-6),
  },
  
  // 上周过期的规划 - 应显示"未完成"
  {
    id: 'plan_history_002',
    userId: 'mock_user_001',
    startDate: dateStr(-10),
    endDate: dateStr(-5),
    mealTime: 'dinner',
    dishes: ['dish_002', 'dish_003'],
    createdAt: isoDate(-11),
  },
  
  // 更早的历史规划
  {
    id: 'plan_history_003',
    userId: 'mock_user_001',
    startDate: dateStr(-15),
    endDate: dateStr(-10),
    mealTime: 'breakfast',
    dishes: ['dish_004', 'dish_006'],
    createdAt: isoDate(-16),
  },
  
  // 两周前的晚餐规划
  {
    id: 'plan_history_004',
    userId: 'mock_user_001',
    startDate: dateStr(-20),
    endDate: dateStr(-14),
    mealTime: 'dinner',
    dishes: ['dish_005'],
    createdAt: isoDate(-21),
  },
  
  // 很久以前的规划
  {
    id: 'plan_history_005',
    userId: 'mock_user_001',
    startDate: dateStr(-30),
    endDate: dateStr(-25),
    mealTime: 'lunch',
    dishes: ['dish_001', 'dish_002', 'dish_003'],
    createdAt: isoDate(-31),
  },
];

// 用于存储运行时的规划数据（模拟数据库）
let mockPlanDatabase: MealPlan[] | null = null;

// 获取当前所有规划（模拟数据库查询）
export const getMockPlanDatabase = (): MealPlan[] => {
  if (!mockPlanDatabase) {
    mockPlanDatabase = createMockMealPlans();
  }
  return mockPlanDatabase;
};

// 重置数据库（用于测试）
export const resetMockPlanDatabase = () => {
  mockPlanDatabase = null;
};

// 添加规划到数据库
export const addMockPlan = (plan: MealPlan) => {
  const db = getMockPlanDatabase();
  db.unshift(plan); // 新规划放在最前面
};

// 更新规划
export const updateMockPlan = (planId: string, updates: Partial<MealPlan>) => {
  const db = getMockPlanDatabase();
  const index = db.findIndex(p => p.id === planId);
  if (index !== -1) {
    db[index] = { ...db[index], ...updates };
    return db[index];
  }
  return null;
};

// 删除规划
export const deleteMockPlan = (planId: string): boolean => {
  const db = getMockPlanDatabase();
  const index = db.findIndex(p => p.id === planId);
  if (index !== -1) {
    db.splice(index, 1);
    return true;
  }
  return false;
};

// 根据ID获取规划
export const getMockPlanById = (planId: string): MealPlan | undefined => {
  const db = getMockPlanDatabase();
  return db.find(p => p.id === planId);
};
