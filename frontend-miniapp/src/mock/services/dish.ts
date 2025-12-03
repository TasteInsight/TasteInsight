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
    const { 
      canteenId, 
      mealTime, 
      tag, 
      price, 
      rating, 
      meatPreference,
      spicyLevel,
      sweetness,
      saltiness,
      oiliness,
      avoidIngredients
    } = params.filter;

    // 按食堂ID或名称过滤
    if (canteenId && canteenId.length > 0) {
      dishes = dishes.filter(d => {
        // 检查食堂ID匹配
        if (d.canteenId && canteenId.includes(d.canteenId)) {
          return true;
        }
        // 检查食堂名称匹配
        if (d.canteenName && canteenId.includes(d.canteenName)) {
          return true;
        }
        return false;
      });
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

    // 按辣度范围过滤
    if (spicyLevel && (spicyLevel.min !== undefined || spicyLevel.max !== undefined)) {
      dishes = dishes.filter(d => {
        const dishSpicyLevel = d.spicyLevel || 0;
        const minOk = spicyLevel.min === undefined || dishSpicyLevel >= spicyLevel.min;
        const maxOk = spicyLevel.max === undefined || dishSpicyLevel <= spicyLevel.max;
        return minOk && maxOk;
      });
    }

    // 按甜度范围过滤
    if (sweetness && (sweetness.min !== undefined || sweetness.max !== undefined)) {
      dishes = dishes.filter(d => {
        const dishSweetness = d.sweetness || 0;
        const minOk = sweetness.min === undefined || dishSweetness >= sweetness.min;
        const maxOk = sweetness.max === undefined || dishSweetness <= sweetness.max;
        return minOk && maxOk;
      });
    }

    // 按咸度范围过滤
    if (saltiness && (saltiness.min !== undefined || saltiness.max !== undefined)) {
      dishes = dishes.filter(d => {
        const dishSaltiness = d.saltiness || 0;
        const minOk = saltiness.min === undefined || dishSaltiness >= saltiness.min;
        const maxOk = saltiness.max === undefined || dishSaltiness <= saltiness.max;
        return minOk && maxOk;
      });
    }

    // 按油腻程度过滤
    if (oiliness && (oiliness.min !== undefined || oiliness.max !== undefined)) {
      dishes = dishes.filter(d => {
        const dishOiliness = d.oiliness || 0;
        const minOk = oiliness.min === undefined || dishOiliness >= oiliness.min;
        const maxOk = oiliness.max === undefined || dishOiliness <= oiliness.max;
        return minOk && maxOk;
      });
    }

    // 按忌口食材过滤
    if (avoidIngredients && avoidIngredients.length > 0) {
      dishes = dishes.filter(d => {
        if (!d.ingredients && !d.allergens) return true; // 如果没有食材信息，默认不过滤
        
        const allIngredients = [
          ...(d.ingredients || []),
          ...(d.allergens || [])
        ];
        
        // 检查是否包含忌口食材
        return !avoidIngredients.some(avoid => 
          allIngredients.some(ingredient => 
            ingredient.toLowerCase().includes(avoid.toLowerCase())
          )
        );
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
      let valA = a[field];
      // @ts-ignore
      let valB = b[field];
      
      // 处理日期字段
      if (field === 'createdAt' && typeof valA === 'string') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      
      // 处理数值字段
      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'asc' ? valA - valB : valB - valA;
      }
      
      // 处理字符串字段
      if (typeof valA === 'string' && typeof valB === 'string') {
        const comparison = valA.localeCompare(valB);
        return order === 'asc' ? comparison : -comparison;
      }
      
      // 默认保持原顺序
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
