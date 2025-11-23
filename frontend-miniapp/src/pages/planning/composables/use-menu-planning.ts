import { ref, computed, onMounted } from 'vue';
import { getMealPlans } from '@/api/modules/meal-plan'; 
import { getDishes } from '@/api/modules/dish';
import type { MealPlan, Dish, GetDishesRequest } from '@/types/api';
import dayjs from 'dayjs';

// 扩展 MealPlan 类型，使其包含完整的 dish 对象
export type EnrichedMealPlan = Omit<MealPlan, 'dishes'> & {
  dishes: Dish[];
}

export function useMenuPlanning() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const allPlans = ref<MealPlan[]>([]);
  const dishMap = ref<Record<string, Dish>>({});

  // 1. 获取所有规划
  const fetchPlans = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await getMealPlans(); // 假设此接口无需分页
      allPlans.value = response.data.items || [];
      
      // 2. 批量获取所有涉及的菜品详情
      await fetchAllDishDetails(allPlans.value);
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取规划列表失败';
      console.error(error.value, err);
    } finally {
      loading.value = false;
    }
  };
  
  // 批量获取菜品详情的辅助函数
  const fetchAllDishDetails = async (plans: MealPlan[]) => {
    const dishIds = new Set<string>();
    plans.forEach(plan => {
      plan.dishes.forEach(id => dishIds.add(id));
    });

    if (dishIds.size === 0) return;

    try {
      const requestParams: GetDishesRequest = {
        filter: { canteenId: Array.from(dishIds) }, // 假设 API 支持按 ID 列表过滤
        search: { keyword: '' },
        sort: {},
        pagination: { page: 1, pageSize: dishIds.size },
      };
      const response = await getDishes(requestParams);
      const newDishMap: Record<string, Dish> = {};
      response.data.items.forEach(dish => {
        newDishMap[dish.id] = dish;
      });
      dishMap.value = newDishMap;
    } catch (err) {
      console.error("批量获取菜品详情失败:", err);
    }
  };

  // 3. 计算属性，将规划和菜品详情合并
  const enrichedPlans = computed<EnrichedMealPlan[]>(() => {
    return allPlans.value.map(plan => ({
      ...plan,
      dishes: plan.dishes.map(id => dishMap.value[id]).filter(Boolean) as Dish[],
    }));
  });
  
  // 4. 将合并后的数据区分为“当前”和“历史”
  const currentPlans = computed(() => 
    enrichedPlans.value.filter(p => dayjs(p.endDate).isAfter(dayjs()))
  );
  
  const historyPlans = computed(() => 
    enrichedPlans.value.filter(p => dayjs(p.endDate).isBefore(dayjs()))
  );

  onMounted(fetchPlans);

  return {
    loading,
    error,
    currentPlans,
    historyPlans,
    fetchPlans,
  };
}