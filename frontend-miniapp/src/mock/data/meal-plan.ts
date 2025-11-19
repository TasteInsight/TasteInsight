// Mock 饮食计划数据
import type { MealPlan } from '@/types/api';

export const createMockMealPlans = (): MealPlan[] => [
  {
    id: 'plan_001',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    mealTime: 'breakfast',
    dishes: ['dish_001', 'dish_004'],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'plan_002',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    mealTime: 'lunch',
    dishes: ['dish_003', 'dish_004', 'dish_005'],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'plan_003',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    mealTime: 'dinner',
    dishes: ['dish_002', 'dish_005'],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'plan_004',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    mealTime: 'lunch',
    dishes: ['dish_001', 'dish_004'],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'plan_005',
    userId: 'mock_user_001',
    startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    mealTime: 'dinner',
    dishes: ['dish_002', 'dish_004'],
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
