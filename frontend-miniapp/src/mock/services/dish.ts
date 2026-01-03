// Mock 菜品服务
import type { Dish, GetDishesRequest, PaginatedData, DishesImages } from '@/types/api';
import { createMockDishes } from '../data/dish';
import { createMockUser } from '../data/user';

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

    // 按食堂ID过滤
    if (canteenId && canteenId.length > 0) {
      dishes = dishes.filter(d => 
        d.canteenId && canteenId.includes(d.canteenId)
      );
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
    const fields = params.search.fields;

    dishes = dishes.filter(d => {
      // 如果指定了 fields，只在指定字段中搜索
      if (fields && fields.length > 0) {
        return fields.some(field => {
          if (field === 'name') return (d.name || '').toLowerCase().includes(keyword);
          if (field === 'description') return (d.description || '').toLowerCase().includes(keyword);
          if (field === 'tags') return (d.tags || []).some(t => t.toLowerCase().includes(keyword));
          if (field === 'canteen') return (d.canteenName || '').toLowerCase().includes(keyword);
          if (field === 'window') return (d.windowName || '').toLowerCase().includes(keyword);
          return false;
        });
      }
      
      // 默认在所有字段中搜索
      return (
        (d.name || '').toLowerCase().includes(keyword) || 
        (d.description || '').toLowerCase().includes(keyword) ||
        (d.tags || []).some(t => t.toLowerCase().includes(keyword)) ||
        (d.canteenName || '').toLowerCase().includes(keyword) ||
        (d.windowName || '').toLowerCase().includes(keyword)
      );
    });
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
      if (field === 'createdAt' && valA instanceof Date) {
        valA = valA.getTime();
        valB = (valB as Date).getTime();
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

/**
 * 应用智能推荐逻辑
 * 根据用户偏好对菜品进行筛选和排序
 */
function applySmartRecommendation(dishes: Dish[], user: any): Dish[] {
  let recommendedDishes = [...dishes];
  
  if (!user.preferences) {
    // 如果没有用户偏好，按评分和热度排序
    return recommendedDishes.sort((a, b) => {
      // 优先级：评分 > 评论数 > 创建时间
      const scoreA = (a.averageRating || 0) * 10 + (a.reviewCount || 0) * 0.1;
      const scoreB = (b.averageRating || 0) * 10 + (b.reviewCount || 0) * 0.1;
      return scoreB - scoreA;
    });
  }

  const prefs = user.preferences;

  // 1. 过滤过敏原
  if (prefs.avoidIngredients && prefs.avoidIngredients.length > 0) {
    recommendedDishes = recommendedDishes.filter(dish => {
      if (!dish.ingredients && !dish.allergens) return true;
      
      const allIngredients = [
        ...(dish.ingredients || []),
        ...(dish.allergens || [])
      ];
      
      return !prefs.avoidIngredients.some((avoid: string) => 
        allIngredients.some((ingredient: string) => 
          ingredient.toLowerCase().includes(avoid.toLowerCase())
        )
      );
    });
  }

  // 2. 按价格范围过滤
  if (prefs.priceRange) {
    recommendedDishes = recommendedDishes.filter(dish => {
      const price = dish.price || 0;
      return price >= prefs.priceRange.min && price <= prefs.priceRange.max;
    });
  }

  // 3. 按食堂偏好过滤
  if (prefs.canteenPreferences && prefs.canteenPreferences.length > 0) {
    recommendedDishes = recommendedDishes.filter(dish => 
      dish.canteenId && prefs.canteenPreferences.includes(dish.canteenId)
    );
  }

  // 4. 按口味偏好过滤和评分
  if (prefs.tastePreferences) {
    const tastePrefs = prefs.tastePreferences;
    
    recommendedDishes = recommendedDishes.map(dish => {
      let score = 0;
      
      // 辣度匹配度（允许±1的误差）
      if (tastePrefs.spicyLevel !== undefined && tastePrefs.spicyLevel > 0) {
        const diff = Math.abs((dish.spicyLevel || 0) - tastePrefs.spicyLevel);
        score += Math.max(0, 5 - diff * 2); // 完全匹配得5分，误差1得3分，误差2得1分
      }
      
      // 甜度匹配度
      if (tastePrefs.sweetness !== undefined && tastePrefs.sweetness > 0) {
        const diff = Math.abs((dish.sweetness || 0) - tastePrefs.sweetness);
        score += Math.max(0, 5 - diff * 2);
      }
      
      // 咸度匹配度
      if (tastePrefs.saltiness !== undefined && tastePrefs.saltiness > 0) {
        const diff = Math.abs((dish.saltiness || 0) - tastePrefs.saltiness);
        score += Math.max(0, 5 - diff * 2);
      }
      
      // 油腻度匹配度
      if (tastePrefs.oiliness !== undefined && tastePrefs.oiliness > 0) {
        const diff = Math.abs((dish.oiliness || 0) - tastePrefs.oiliness);
        score += Math.max(0, 5 - diff * 2);
      }
      
      return { ...dish, recommendationScore: score };
    }) as Dish[];
  }

  // 5. 按荤素偏好过滤
  if (prefs.meatPreference && prefs.meatPreference.length > 0) {
    recommendedDishes = recommendedDishes.filter(dish => {
      if (!dish.tags) return false;
      const tagsLower = dish.tags.map((t: string) => t.toLowerCase());
      
      return prefs.meatPreference.some((pref: string) => {
        if (pref === '荤') {
          return tagsLower.some((t: string) => 
            t.includes('荤') || t.includes('肉') || t.includes('鸡') || t.includes('鱼') || t.includes('虾')
          );
        } else if (pref === '素') {
          return tagsLower.some((t: string) => 
            t.includes('素') || t.includes('蔬') || t.includes('菜')
          );
        } else if (pref === '荤素') {
          return tagsLower.some((t: string) => 
            t.includes('荤素') || t.includes('搭配')
          );
        }
        return false;
      });
    });
  }

  // 6. 智能排序：结合推荐分数、评分、热度
  recommendedDishes.sort((a, b) => {
    // @ts-ignore
    const scoreA = (a.recommendationScore || 0) + (a.averageRating || 0) * 2 + (a.reviewCount || 0) * 0.01;
    // @ts-ignore
    const scoreB = (b.recommendationScore || 0) + (b.averageRating || 0) * 2 + (b.reviewCount || 0) * 0.01;
    return scoreB - scoreA;
  });

  console.log(`🍽️ [Mock] 智能推荐筛选出 ${recommendedDishes.length} 个菜品`);
  return recommendedDishes;
}

/**
 * 获取菜品图片列表
 */
export const mockGetDishesImages = async (): Promise<DishesImages> => {
  console.log('🍽️ [Mock] 获取菜品图片列表');
  await mockDelay();
  
  // 从 mock 菜品数据中提取图片
  const dishes = createMockDishes();
  const images = dishes
    .filter(dish => dish.images && dish.images.length > 0)
    .flatMap(dish => dish.images!)
    .slice(0, 10); // 限制返回10张图片
  
  console.log(`✅ [Mock] 返回 ${images.length} 张菜品图片`);
  
  return {
    images
  };
};
