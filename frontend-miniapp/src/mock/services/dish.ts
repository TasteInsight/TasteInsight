// Mock 菜品服务
import type { Dish, GetDishesRequest, PaginatedData } from '@/types/api';
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

// 获取菜品列表 (支持筛选、搜索、排序、分页)
export const mockGetDishes = async (params: GetDishesRequest): Promise<PaginatedData<Dish>> => {
  console.log('🍽️ [Mock] 获取菜品列表', params);
  await mockDelay();

  let dishes = createMockDishes();

  // 1. 筛选
  if (params.filter) {
    const { canteenId, mealTime, tag } = params.filter;

    if (canteenId && canteenId.length > 0) {
      dishes = dishes.filter(d => d.canteenId && canteenId.includes(d.canteenId));
    }

    if (mealTime && mealTime.length > 0) {
      // @ts-ignore
      dishes = dishes.filter(d => d.availableMealTime && d.availableMealTime.some(t => mealTime.includes(t)));
    }

    // 按标签过滤
    if (tag && tag.length > 0) {
      dishes = dishes.filter(d => 
        d.tags && d.tags.some(t => 
          tag.some(filterTag => t.toLowerCase().includes(filterTag.toLowerCase()))
        )
      );
    }
  }

  // 2. 搜索
  if (params.search && params.search.keyword) {
    const keyword = params.search.keyword.toLowerCase();
    dishes = dishes.filter(d => 
      (d.name || '').toLowerCase().includes(keyword) || 
      (d.description && d.description.toLowerCase().includes(keyword)) ||
      (d.tags || []).some(t => t.toLowerCase().includes(keyword))
    );
  }

  // 3. 排序
  if (params.sort && params.sort.field) {
    const { field, order = 'asc' } = params.sort;
    dishes.sort((a, b) => {
      // @ts-ignore
      const valA = a[field];
      // @ts-ignore
      const valB = b[field];
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });
  }

  // 4. 分页
  const { page, pageSize } = params.pagination;
  const total = dishes.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = dishes.slice(start, end);

  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};
