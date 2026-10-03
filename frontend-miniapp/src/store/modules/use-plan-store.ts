// @/stores/use-plan-store.ts
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useUserStore } from './use-user-store';
import {
  getMealPlans,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
} from '@/api/modules/meal-plan';
import { getDishById } from '@/api/modules/dish';
import type { MealPlan, MealPlanRequest, Dish } from '@/types/api';
import dayjs from 'dayjs';

export type EnrichedMealPlan = Omit<MealPlan, 'dishes'> & {
  dishes: Dish[];
  isCompleted: boolean; // 是否已完成（手动执行为已完成，自动过期为未完成）
  isExpired: boolean; // 是否已过期
};

export const usePlanStore = defineStore('plan', () => {
  const userStore = useUserStore();
  // 状态
  const loading = ref(false);
  const error = ref<string | null>(null);
  const allPlans = ref<MealPlan[]>([]);
  const dishMap = ref<Record<string, Dish>>({});
  const selectedPlan = ref<EnrichedMealPlan | null>(null);
  const completedPlanIds = ref<Set<string>>(new Set()); // 已手动执行完成的规划ID

  // 餐时排序顺序
  const mealTimeOrder = ['breakfast', 'lunch', 'dinner', 'nightsnack'];

  // 规划排序函数
  const sortPlans = (plans: EnrichedMealPlan[]) => {
    return [...plans].sort((a, b) => {
      const dateA = dayjs(a.startDate);
      const dateB = dayjs(b.startDate);

      // 首先按日期升序排序
      if (dateA.isBefore(dateB, 'day')) {
        return -1;
      }
      if (dateA.isAfter(dateB, 'day')) {
        return 1;
      }

      // 日期相同，按餐时顺序排序
      const orderA =
        mealTimeOrder.indexOf(a.mealTime) === -1
          ? mealTimeOrder.length
          : mealTimeOrder.indexOf(a.mealTime);
      const orderB =
        mealTimeOrder.indexOf(b.mealTime) === -1
          ? mealTimeOrder.length
          : mealTimeOrder.indexOf(b.mealTime);
      return orderA - orderB;
    });
  };

  // 计算属性：富化后的规划列表
  const enrichedPlans = computed<EnrichedMealPlan[]>(() => {
    const now = dayjs();
    return allPlans.value.map(plan => {
      const isExpired = dayjs(plan.endDate).isBefore(now, 'day');
      const isCompleted = completedPlanIds.value.has(plan.id);
      return {
        ...plan,
        dishes: plan.dishes.map(id => dishMap.value[id]).filter(Boolean) as Dish[],
        isCompleted,
        isExpired,
      };
    });
  });

  // 计算属性：当前规划（未过期且未完成）
  const currentPlans = computed(() =>
    sortPlans(enrichedPlans.value.filter(p => !p.isExpired && !p.isCompleted))
  );

  // 计算属性：历史规划（已过期或已完成）
  const historyPlans = computed(() =>
    sortPlans(enrichedPlans.value.filter(p => p.isExpired || p.isCompleted))
  );

  // 获取所有规划
  const fetchPlans = async () => {
    const sessionVersion = userStore.sessionVersion;
    loading.value = true;
    error.value = null;
    try {
      const response = await getMealPlans();
      if (userStore.sessionVersion !== sessionVersion) return;
      allPlans.value = response.data.items || [];
      const legacyCompletedIds = uni.getStorageSync('completedPlanIds');
      if (Array.isArray(legacyCompletedIds)) {
        const ownedPlanIds = new Set(allPlans.value.map(plan => plan.id));
        const restored = legacyCompletedIds.filter(id => ownedPlanIds.has(id));
        if (restored.length) {
          restored.forEach(id => completedPlanIds.value.add(id));
          saveCompletedPlanIds();
        }
      }

      // 批量获取菜品详情
      await fetchAllDishDetails(allPlans.value, sessionVersion);
    } catch (err) {
      if (userStore.sessionVersion !== sessionVersion) return;
      error.value = err instanceof Error ? err.message : '获取规划列表失败';
      console.error('获取规划失败:', err);
      throw err;
    } finally {
      if (userStore.sessionVersion === sessionVersion) loading.value = false;
    }
  };

  // 批量获取菜品详情
  const fetchAllDishDetails = async (plans: MealPlan[], sessionVersion: number) => {
    const dishIds = new Set<string>();
    plans.forEach(plan => {
      plan.dishes.forEach(id => dishIds.add(id));
    });

    if (dishIds.size === 0) return;

    try {
      // API 不支持按 ID 列表过滤，改为并行获取单个菜品详情
      const promises = Array.from(dishIds).map(id => getDishById(id));
      const results = await Promise.allSettled(promises);
      if (userStore.sessionVersion !== sessionVersion) return;

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
      if (userStore.sessionVersion !== sessionVersion) return;
      console.error('批量获取菜品详情失败:', err);
    }
  };

  // 创建规划
  const createPlan = async (planData: MealPlanRequest) => {
    const sessionVersion = userStore.sessionVersion;
    loading.value = true;
    error.value = null;
    try {
      const response = await createMealPlan(planData);
      if (userStore.sessionVersion !== sessionVersion) throw new Error('登录会话已变更');
      const newPlan = response.data;

      // 更新本地列表
      allPlans.value = [newPlan, ...allPlans.value];
      // 获取新规划的菜品详情
      await fetchAllDishDetails([newPlan], sessionVersion);
      if (userStore.sessionVersion !== sessionVersion) throw new Error('登录会话已变更');

      return newPlan;
    } catch (err) {
      if (userStore.sessionVersion !== sessionVersion) throw err;
      error.value = err instanceof Error ? err.message : '创建规划失败';
      console.error('创建规划失败:', err);
      throw err;
    } finally {
      if (userStore.sessionVersion === sessionVersion) loading.value = false;
    }
  };

  // 更新规划
  const updatePlanById = async (planId: string, planData: MealPlanRequest) => {
    const sessionVersion = userStore.sessionVersion;
    loading.value = true;
    error.value = null;
    try {
      const response = await updateMealPlan(planData, planId);
      if (userStore.sessionVersion !== sessionVersion) throw new Error('登录会话已变更');
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
      await fetchAllDishDetails([updatedPlan], sessionVersion);
      if (userStore.sessionVersion !== sessionVersion) throw new Error('登录会话已变更');

      return updatedPlan;
    } catch (err) {
      if (userStore.sessionVersion !== sessionVersion) throw err;
      error.value = err instanceof Error ? err.message : '更新规划失败';
      console.error('更新规划失败:', err);
      throw err;
    } finally {
      if (userStore.sessionVersion === sessionVersion) loading.value = false;
    }
  };

  // 删除规划
  const removePlan = async (planId: string) => {
    const sessionVersion = userStore.sessionVersion;
    loading.value = true;
    error.value = null;
    try {
      await deleteMealPlan(planId);
      if (userStore.sessionVersion !== sessionVersion) return;
      allPlans.value = allPlans.value.filter(p => p.id !== planId);
    } catch (err) {
      if (userStore.sessionVersion !== sessionVersion) return;
      error.value = err instanceof Error ? err.message : '删除规划失败';
      console.error('删除规划失败:', err);
      throw err;
    } finally {
      if (userStore.sessionVersion === sessionVersion) loading.value = false;
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
    const owner = userStore.userInfo?.id;
    if (!owner) return;
    try {
      uni.setStorageSync(`completedPlanIds:${owner}`, Array.from(completedPlanIds.value));
    } catch (e) {
      console.error('保存已完成规划失败:', e);
    }
  };

  // 从本地存储加载已完成规划ID
  const loadCompletedPlanIds = () => {
    const owner = userStore.userInfo?.id;
    if (!owner) return;
    try {
      const ids = uni.getStorageSync(`completedPlanIds:${owner}`);
      if (ids && Array.isArray(ids)) {
        completedPlanIds.value = new Set(ids);
      }
    } catch (e) {
      console.error('加载已完成规划失败:', e);
    }
  };

  watch(
    [() => userStore.sessionVersion, () => userStore.isLoggedIn ? userStore.userInfo?.id : null],
    () => {
      allPlans.value = [];
      dishMap.value = {};
      selectedPlan.value = null;
      completedPlanIds.value = new Set();
      loading.value = false;
      error.value = null;
      if (userStore.isLoggedIn) loadCompletedPlanIds();
    },
    { immediate: true, flush: 'sync' }
  );

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
    updatePlan: updatePlanById,
    removePlan,
    executePlan,
    setSelectedPlan,
    getPlanById,
  };
});
