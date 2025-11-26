// Mock 食堂服务
import type { Canteen, Window, Dish, CanteenListData, WindowListData, WindowDishesData } from '@/types/api';
import { createMockCanteens, createMockWindows, getWindowsByCanteenId } from '../data/canteen';
import { createMockDishes } from '../data/dish';

// 模拟网络延迟
const mockDelay = (min = 100, max = 400) => 
  new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

/**
 * 获取食堂列表
 */
export const mockGetCanteenList = async (): Promise<CanteenListData> => {
  console.log('🏢 [Mock] 获取食堂列表');
  await mockDelay();
  
  const canteens = createMockCanteens();
  console.log(`✅ [Mock] 返回 ${canteens.length} 个食堂`);
  
  const total = canteens.length;
  const pageSize = 20;
  return {
    items: canteens,
    meta: {
      total,
      page: 1,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

/**
 * 根据ID获取食堂详情
 */
export const mockGetCanteenDetail = async (canteenId: string): Promise<Canteen | null> => {
  console.log(`🏢 [Mock] 获取食堂详情: ${canteenId}`);
  await mockDelay();
  
  const canteens = createMockCanteens();
  const canteen = canteens.find(c => c.id === canteenId);
  
  if (canteen) {
    // 添加窗口列表
    const windows = getWindowsByCanteenId(canteenId);
    const enrichedCanteen = {
      ...canteen,
      windows: windows,
    };
    console.log(`✅ [Mock] 找到食堂: ${canteen.name}，包含 ${windows.length} 个窗口`);
    return enrichedCanteen;
  } else {
    console.warn(`⚠️ [Mock] 食堂不存在: ${canteenId}`);
    return null;
  }
};

/**
 * 根据食堂ID获取窗口列表
 */
export const mockGetWindowList = async (canteenId: string): Promise<WindowListData> => {
  console.log(`🪟 [Mock] 获取窗口列表: ${canteenId}`);
  await mockDelay();
  
  const windows = getWindowsByCanteenId(canteenId);
  console.log(`✅ [Mock] 返回 ${windows.length} 个窗口`);
  
  const totalW = windows.length;
  const pageSizeW = 20;
  return {
    items: windows,
    meta: {
      total: totalW,
      page: 1,
      pageSize: pageSizeW,
      totalPages: Math.ceil(totalW / pageSizeW),
    },
  };
};

/**
 * 根据ID获取窗口详情
 */
export const mockGetWindowDetail = async (windowId: string): Promise<Window | null> => {
  console.log(`🪟 [Mock] 获取窗口详情: ${windowId}`);
  await mockDelay();
  
  const windows = createMockWindows();
  const window = windows.find(w => w.id === windowId);
  
  if (window) {
    console.log(`✅ [Mock] 找到窗口: ${window.name}`);
    return window;
  } else {
    console.warn(`⚠️ [Mock] 窗口不存在: ${windowId}`);
    return null;
  }
};

/**
 * 根据窗口ID获取菜品列表
 */
export const mockGetWindowDishes = async (windowId: string): Promise<WindowDishesData> => {
  console.log(`🍽️ [Mock] 获取窗口菜品: ${windowId}`);
  await mockDelay(200, 600);
  
  const allDishes = createMockDishes();
  const windows = createMockWindows();
  const window = windows.find(w => w.id === windowId);
  
  if (!window) {
    console.warn(`⚠️ [Mock] 窗口不存在: ${windowId}`);
    return { items: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } };
  }
  
  // 根据窗口号匹配菜品
  const windowNumber = window.number;
  const dishes = allDishes.filter(dish => dish.windowNumber === windowNumber);
  
  console.log(`✅ [Mock] 窗口 ${window.name} 返回 ${dishes.length} 个菜品`);
  
  return {
    items: dishes,
    meta: {
      total: dishes.length,
      page: 1,
      pageSize: 50,
      totalPages: Math.ceil(dishes.length / 50),
    },
  };
};

/**
 * 搜索菜品（支持跨窗口搜索）
 */
export const mockSearchDishes = async (keyword: string, canteenId?: string): Promise<Dish[]> => {
  console.log(`🔍 [Mock] 搜索菜品: "${keyword}"${canteenId ? ` in ${canteenId}` : ''}`);
  await mockDelay(200, 500);
  
  const allDishes = createMockDishes();
  const searchLower = keyword.toLowerCase();
  
  let filtered = allDishes.filter(dish => 
    (dish.name || '').toLowerCase().includes(searchLower) ||
    (dish.tags || []).some(tag => tag.toLowerCase().includes(searchLower)) ||
    dish.description?.toLowerCase().includes(searchLower)
  );
  
  // 如果指定了食堂，进一步筛选
  if (canteenId) {
    filtered = filtered.filter(dish => dish.canteenId === canteenId);
  }
  
  console.log(`✅ [Mock] 搜索到 ${filtered.length} 个菜品`);
  return filtered;
};

/**
 * 按标签筛选菜品
 */
export const mockGetDishesByTag = async (tag: string): Promise<Dish[]> => {
  console.log(`🏷️ [Mock] 按标签筛选: ${tag}`);
  await mockDelay();
  
  const allDishes = createMockDishes();
  const filtered = allDishes.filter(dish => (dish.tags || []).includes(tag));
  
  console.log(`✅ [Mock] 返回 ${filtered.length} 个菜品`);
  return filtered;
};

/**
 * 按用餐时间筛选菜品
 */
export const mockGetDishesByMealTime = async (
  mealTime: 'breakfast' | 'lunch' | 'dinner' | 'nightsnack'
): Promise<Dish[]> => {
  console.log(`🍽️ [Mock] 按用餐时间筛选: ${mealTime}`);
  await mockDelay();
  
  const allDishes = createMockDishes();
  const filtered = allDishes.filter(dish => 
    (dish.availableMealTime || []).includes(mealTime as any)
  );
  
  console.log(`✅ [Mock] 返回 ${filtered.length} 个 ${mealTime} 菜品`);
  return filtered;
};

/**
 * 获取推荐菜品（高评分菜品）
 */
export const mockGetRecommendedDishes = async (limit = 10): Promise<Dish[]> => {
  console.log(`⭐ [Mock] 获取推荐菜品 (top ${limit})`);
  await mockDelay();
  
  const allDishes = createMockDishes();
  const sorted = [...allDishes].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  const recommended = sorted.slice(0, limit);
  
  console.log(`✅ [Mock] 返回 ${recommended.length} 个推荐菜品`);
  return recommended;
};

/**
 * 获取热门菜品（按评论数排序）
 */
export const mockGetPopularDishes = async (limit = 10): Promise<Dish[]> => {
  console.log(`🔥 [Mock] 获取热门菜品 (top ${limit})`);
  await mockDelay();
  
  const allDishes = createMockDishes();
  const sorted = [...allDishes].sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
  const popular = sorted.slice(0, limit);
  
  console.log(`✅ [Mock] 返回 ${popular.length} 个热门菜品`);
  return popular;
};
