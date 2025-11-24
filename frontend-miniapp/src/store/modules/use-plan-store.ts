// @/stores/use-plan-store.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  getMealPlans, 
  createOrUpdateMealPlan, 
  deleteMealPlan 
} from '@/api/modules/meal-plan';
import { getDishes } from '@/api/modules/dish';
import type { 
  MealPlan, 
  MealPlanRequest, 
  Dish, 
  GetDishesRequest 
} from '@/types/api';
import dayjs from 'dayjs';

export type EnrichedMealPlan = Omit<MealPlan, 'dishes'> & {
  dishes: Dish[];
};

export const usePlanStore = defineStore('plan', () => {
  // 状态
  const loading = ref(false);
  const error = ref<string | null>(null);
  const allPlans = ref<MealPlan[]>([]);
  const dishMap = ref<Record<string, Dish>>({});
  const selectedPlan = ref<EnrichedMealPlan | null>(null);

  // 计算属性：富化后的规划列表
  const enrichedPlans = computed<EnrichedMealPlan[]>(() => {
    return allPlans.value.map(plan => ({
      ...plan,
      dishes: plan.dishes
        .map(id => dishMap.value[id])
        .filter(Boolean) as Dish[],
    }));
  });

  // 计算属性：当前规划（未过期）
  const currentPlans = computed(() => 
    enrichedPlans.value.filter(p => dayjs(p.endDate).isAfter(dayjs()))
  );

  // 计算属性：历史规划（已过期）
  const historyPlans = computed(() => 
    enrichedPlans.value.filter(p => dayjs(p.endDate).isBefore(dayjs()))
  );

  // 获取所有规划
  const fetchPlans = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await getMealPlans();
      allPlans.value = response.data.items || [];
      
      // 批量获取菜品详情
      await fetchAllDishDetails(allPlans.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取规划列表失败';
      console.error('获取规划失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 批量获取菜品详情
  const fetchAllDishDetails = async (plans: MealPlan[]) => {
    const dishIds = new Set<string>();
    plans.forEach(plan => {
      plan.dishes.forEach(id => dishIds.add(id));
    });

    if (dishIds.size === 0) return;

    try {
      // 注意：这里假设 API 支持按 ID 列表过滤
      // 如果不支持，可能需要调整实现方式
      const requestParams: GetDishesRequest = {
        filter: {},
        search: { keyword: '' },
        sort: {},
        pagination: { page: 1, pageSize: dishIds.size },
      };
      
      const response = await getDishes(requestParams);
      const newDishMap: Record<string, Dish> = {};
      response.data.items.forEach(dish => {
        newDishMap[dish.id] = dish;
      });
      dishMap.value = { ...dishMap.value, ...newDishMap };
    } catch (err) {
      console.error('批量获取菜品详情失败:', err);
    }
  };

  // 创建规划
  const createPlan = async (planData: MealPlanRequest) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await createOrUpdateMealPlan(planData);
      await fetchPlans(); // 重新获取列表
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建规划失败';
      console.error('创建规划失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 更新规划
  const updatePlan = async (planId: string, planData: MealPlanRequest) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await createOrUpdateMealPlan(planData);
      await fetchPlans(); // 重新获取列表
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新规划失败';
      console.error('更新规划失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 删除规划
  const removePlan = async (planId: string) => {
    loading.value = true;
    error.value = null;
    try {
      await deleteMealPlan(planId);
      allPlans.value = allPlans.value.filter(p => p.id !== planId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除规划失败';
      console.error('删除规划失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 设置选中的规划
  const setSelectedPlan = (plan: EnrichedMealPlan | null) => {
    selectedPlan.value = plan;
  };

  // 根据ID获取富化后的规划
  const getPlanById = (planId: string): EnrichedMealPlan | undefined => {
    return enrichedPlans.value.find(p => p.id === planId);
  };

  return {
    // 状态
    loading,
    error,
    allPlans,
    selectedPlan,
    
    // 计算属性
    enrichedPlans,
    currentPlans,
    historyPlans,
    
    // 方法
    fetchPlans,
    createPlan,
    updatePlan,
    removePlan,
    setSelectedPlan,
    getPlanById,
  };
});