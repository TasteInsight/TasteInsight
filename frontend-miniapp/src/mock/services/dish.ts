// Mock 菜品服务
import type { Dish } from '@/types/api';
import { createMockDishes } from '../data/dish';

// 模拟网络延迟
const mockDelay = () => new Promise(resolve => setTimeout(resolve, 200));

// 获取菜品详情
export const mockGetDishById = async (id: string): Promise<Dish | null> => {
  console.log(`🍽️ [Mock] 获取菜品详情: ${id}`);
  await mockDelay();
  
  const dishes = createMockDishes();
  const dish = dishes.find(d => d.id === id);
  
  if (dish) {
    console.log(`✅ [Mock] 找到菜品: ${dish.name}`);
    return dish;
  } else {
    console.warn(`⚠️ [Mock] 菜品不存在: ${id}`);
    return null;
  }
};
