// @/stores/use-plan-store.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  getMealPlans, 
  createOrUpdateMealPlan, 
  deleteMealPlan 
} from '@/api/modules/meal-plan';
import { getDishById } from '@/api/modules/dish';
import type { 
  MealPlan, 
  MealPlanRequest, 
  Dish 
} from '@/types/api';
import dayjs from 'dayjs';

export type EnrichedMealPlan = Omit<MealPlan, 'dishes'> & {
  dishes: Dish[];
  isCompleted: boolean; // 是否已完成（手动执行为已完成，自动过期为未完成）
  isExpired: boolean;   // 是否已过期
};

export const usePlanStore = defineStore('plan', () => {
  // 状态
  const loading = ref(false);
  const error = ref<string | null>(null);
  const allPlans = ref<MealPlan[]>([]);
  const dishMap = ref<Record<string, Dish>>({});
  const selectedPlan = ref<EnrichedMealPlan | null>(null);
  const completedPlanIds = ref<Set<string>>(new Set()); // 已手动执行完成的规划ID

  // 计算属性：富化后的规划列表
  const enrichedPlans = computed<EnrichedMealPlan[]>(() => {
    const now = dayjs();
    return allPlans.value.map(plan => {
      const isExpired = dayjs(plan.endDate).isBefore(now, 'day');
      const isCompleted = completedPlanIds.value.has(plan.id);
      return {
        ...plan,
        dishes: plan.dishes
          .map(id => dishMap.value[id])
          .filter(Boolean) as Dish[],
        isCompleted,
        isExpired,
      };
    });
  });

  // 计算属性：当前规划（未过期且未完成）
  const currentPlans = computed(() => 
    enrichedPlans.value.filter(p => !p.isExpired && !p.isCompleted)
  );

  // 计算属性：历史规划（已过期或已完成）
  const historyPlans = computed(() => 
    enrichedPlans.value.filter(p => p.isExpired || p.isCompleted)
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
      // API 不支持按 ID 列表过滤，改为并行获取单个菜品详情
      const promises = Array.from(dishIds).map(id => getDishById(id));
      const results = await Promise.allSettled(promises);

      const newDishMap: Record<string, Dish> = {};
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.code === 200 && result.value.data) {
          newDishMap[result.value.data.id] = result.value.data;
        } else if (result.status === 'rejected') {
          console.error(`Failed to fetch dish:`, result.reason);
        }
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
      const newPlan = response.data;
      
      // 更新本地列表
      allPlans.value = [newPlan, ...allPlans.value];
      // 获取新规划的菜品详情
      await fetchAllDishDetails([newPlan]);
      
      return newPlan;
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
      const updatedPlan = response.data;
      
      // 更新本地列表
      const index = allPlans.value.findIndex(p => p.id === updatedPlan.id);
      if (index !== -1) {
        allPlans.value[index] = updatedPlan;
      } else {
        // 如果 ID 变了（例如因为日期变化导致创建了新规划），移除旧的添加新的
        allPlans.value = allPlans.value.filter(p => p.id !== planId);
        allPlans.value = [updatedPlan, ...allPlans.value];
      }
      
      // 获取更新后规划的菜品详情
      await fetchAllDishDetails([updatedPlan]);
      
      return updatedPlan;
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

  // 执行规划（标记为已完成，移至历史）
  const executePlan = async (planId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const plan = allPlans.value.find(p => p.id === planId);
      if (!plan) {
        throw new Error('规划不存在');
      }
      
      // 标记为已完成
      completedPlanIds.value.add(planId);
      // 持久化到本地存储
      saveCompletedPlanIds();
    } catch (err) {
      error.value = err instanceof Error ? err.message : '执行规划失败';
      console.error('执行规划失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 保存已完成规划ID到本地存储
  const saveCompletedPlanIds = () => {
    try {
      uni.setStorageSync('completedPlanIds', Array.from(completedPlanIds.value));
    } catch (e) {
      console.error('保存已完成规划失败:', e);
    }
  };

  // 从本地存储加载已完成规划ID
  const loadCompletedPlanIds = () => {
    try {
      const ids = uni.getStorageSync('completedPlanIds');
      if (ids && Array.isArray(ids)) {
        completedPlanIds.value = new Set(ids);
      }
    } catch (e) {
      console.error('加载已完成规划失败:', e);
    }
  };

  // 初始化时加载
  loadCompletedPlanIds();

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
    executePlan,
    setSelectedPlan,
    getPlanById,
  };
});