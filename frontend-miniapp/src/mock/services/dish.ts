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
    const { canteenId, mealTime, tag, price, rating, meatPreference } = params.filter;

    // 按食堂ID过滤
    if (canteenId && canteenId.length > 0) {
      dishes = dishes.filter(d => d.canteenId && canteenId.includes(d.canteenId));
    }

    // 按用餐时段过滤
    if (mealTime && mealTime.length > 0) {
      dishes = dishes.filter(d => 
        d.availableMealTime && d.availableMealTime.some((t: string) => mealTime.includes(t))
      );
    }

    // 按标签过滤（口味等）
    if (tag && tag.length > 0) {
      dishes = dishes.filter(d => 
        d.tags && d.tags.some(t => 
          tag.some(filterTag => t.toLowerCase().includes(filterTag.toLowerCase()))
        )
      );
    }

    // 按价格范围过滤
    if (price && (price.min !== undefined || price.max !== undefined)) {
      dishes = dishes.filter(d => {
        const dishPrice = d.price || 0;
        const minOk = price.min === undefined || dishPrice >= price.min;
        const maxOk = price.max === undefined || dishPrice <= price.max;
        return minOk && maxOk;
      });
    }

    // 按评分范围过滤
    if (rating && (rating.min !== undefined || rating.max !== undefined)) {
      dishes = dishes.filter(d => {
        const dishRating = d.averageRating || 0;
        const minOk = rating.min === undefined || dishRating >= rating.min;
        const maxOk = rating.max === undefined || dishRating <= rating.max;
        return minOk && maxOk;
      });
    }

    // 按荤素偏好过滤（通过 tags 实现）
    if (meatPreference && meatPreference.length > 0) {
      dishes = dishes.filter(d => {
        if (!d.tags) return false;
        const tagsLower = d.tags.map(t => t.toLowerCase());
        return meatPreference.some(pref => {
          if (pref === '荤') {
            return tagsLower.some(t => t.includes('荤') || t.includes('肉') || t.includes('鸡') || t.includes('鱼') || t.includes('虾'));
          } else if (pref === '素') {
            return tagsLower.some(t => t.includes('素') || t.includes('蔬') || t.includes('菜'));
          } else if (pref === '荤素') {
            return tagsLower.some(t => t.includes('荤素') || t.includes('搭配'));
          }
          return false;
        });
      });
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

  console.log(`✅ [Mock] 筛选后返回 ${items.length}/${total} 个菜品`);

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
