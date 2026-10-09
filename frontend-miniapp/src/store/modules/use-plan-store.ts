// @/stores/use-plan-store.ts
import { defineStore } from 'pinia';
import { ref, computed, watch, toRaw } from 'vue';
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
  dishesReady: boolean;
  isCompleted: boolean; // 是否已完成（手动执行为已完成，自动过期为未完成）
  isExpired: boolean; // 是否已过期
};

export const usePlanStore = defineStore('plan', () => {
  const userStore = useUserStore();
  // 状态
  const loading = ref(false);
  const initialized = ref(false);
  const error = ref<string | null>(null);
  const allPlans = ref<MealPlan[]>([]);
  const dishMap = ref<Record<string, Dish>>({});
  const selectedPlan = ref<EnrichedMealPlan | null>(null);
  const completedPlanIds = ref<Set<string>>(new Set()); // 已手动执行完成的规划ID
  let listRequest = 0;
  let writeRevision = 0;
  const pendingPlanWrites = new Map<string, Promise<unknown>>();
  const pendingCreates = new Set<Set<string>>();

  const recordPlanWrite = (planId: string) => {
    writeRevision += 1;
    pendingCreates.forEach(changedIds => changedIds.add(planId));
  };

  const assertSession = (sessionVersion: number) => {
    if (userStore.sessionVersion !== sessionVersion) throw new Error('登录会话已变更');
  };

  // 同一规划的更新和删除按提交顺序到达服务端，独立规划可以并行保存。
  const serializePlanWrite = <T>(planId: string, sessionVersion: number, write: () => Promise<T>) => {
    const previous = pendingPlanWrites.get(planId) || Promise.resolve();
    const pending = previous.catch(() => {}).then(() => {
      assertSession(sessionVersion);
      return write();
    });
    pendingPlanWrites.set(planId, pending);
    return pending.finally(() => {
      if (pendingPlanWrites.get(planId) === pending) pendingPlanWrites.delete(planId);
    });
  };

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
        dishesReady: plan.dishes.every(id => !!dishMap.value[id]),
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
    const request = ++listRequest;
    const isCurrent = () => userStore.sessionVersion === sessionVersion && request === listRequest;
    loading.value = true;
    error.value = null;
    try {
      while (isCurrent()) {
        const revision = writeRevision;
        try {
          const response = await getMealPlans();
          if (!isCurrent()) return;
          // 读取期间已完成写入时，重新读取权威列表，避免旧快照覆盖成功保存。
          if (revision !== writeRevision) continue;
          const plans = response.data.items || [];
          const details = await loadDishDetails(plans);
          if (!isCurrent()) return;
          if (revision !== writeRevision) continue;
          dishMap.value = { ...dishMap.value, ...details };
          allPlans.value = plans;
          const legacyCompletedIds = uni.getStorageSync('completedPlanIds');
          if (Array.isArray(legacyCompletedIds)) {
            const ownedPlanIds = new Set(allPlans.value.map(plan => plan.id));
            const restored = legacyCompletedIds.filter(id => ownedPlanIds.has(id));
            if (restored.length) {
              restored.forEach(id => completedPlanIds.value.add(id));
              saveCompletedPlanIds();
            }
          }

          initialized.value = true;
          error.value = null;
          return;
        } catch (err) {
          if (!isCurrent()) return;
          if (revision !== writeRevision) continue;
          error.value = err instanceof Error ? err.message : '获取规划列表失败';
          console.error('获取规划失败:', err);
          throw err;
        }
      }
    } finally {
      if (isCurrent()) loading.value = false;
    }
  };

  // 批量获取菜品详情
  const loadDishDetails = async (plans: MealPlan[]): Promise<Record<string, Dish>> => {
    const dishIds = new Set<string>();
    plans.forEach(plan => {
      plan.dishes.forEach(id => dishIds.add(id));
    });

    const ids = Array.from(dishIds);
    const results = await Promise.all(ids.map(id => getDishById(id)));
    const details: Record<string, Dish> = {};
    results.forEach((result, index) => {
      if (result.code !== 200 || !result.data || result.data.id !== ids[index]) {
        throw new Error(result.message || '规划菜品资料暂时无法读取，请重试。');
      }
      details[ids[index]] = result.data;
    });
    return details;
  };

  const refreshSavedPlanDetails = async (plan: MealPlan, sessionVersion: number) => {
    const isCurrent = () => userStore.sessionVersion === sessionVersion &&
      allPlans.value.some(saved => toRaw(saved) === toRaw(plan));
    try {
      const details = await loadDishDetails([plan]);
      if (!isCurrent()) return;
      dishMap.value = { ...dishMap.value, ...details };
    } catch (err) {
      if (!isCurrent()) return;
      // 写入已经提交；读取失败只提供同步重试，避免重复创建或保存。
      error.value = `规划已保存，菜品资料读取失败，请重试。${err instanceof Error ? err.message : ''}`;
      console.error('读取已保存规划的菜品资料失败:', err);
    }
  };

  // 创建规划
  const createPlan = async (planData: MealPlanRequest) => {
    const sessionVersion = userStore.sessionVersion;
    const changedIds = new Set<string>();
    pendingCreates.add(changedIds);
    let newPlan: MealPlan;
    try {
      const response = await createMealPlan({ ...planData, dishes: planData.dishes?.slice() });
      assertSession(sessionVersion);
      newPlan = response.data;
      // 创建响应是初始快照；列表可能已读到该记录，且已完成后续修改或删除。
      if (!changedIds.has(newPlan.id) && !allPlans.value.some(plan => plan.id === newPlan.id)) {
        allPlans.value = [newPlan, ...allPlans.value];
      }
      recordPlanWrite(newPlan.id);
    } finally {
      pendingCreates.delete(changedIds);
    }
    await refreshSavedPlanDetails(newPlan, sessionVersion);
    assertSession(sessionVersion);
    return newPlan;
  };

  // 更新规划
  const updatePlanById = async (planId: string, planData: MealPlanRequest) => {
    const sessionVersion = userStore.sessionVersion;
    const payload = { ...planData, dishes: planData.dishes?.slice() };
    const updatedPlan = await serializePlanWrite(planId, sessionVersion, async () => {
      const response = await updateMealPlan(payload, planId);
      assertSession(sessionVersion);
      const updatedPlan = response.data;
      const index = allPlans.value.findIndex(p => p.id === planId);
      if (index !== -1) {
        allPlans.value[index] = updatedPlan;
      } else {
        allPlans.value = [updatedPlan, ...allPlans.value];
      }
      recordPlanWrite(planId);
      return updatedPlan;
    });
    assertSession(sessionVersion);
    await refreshSavedPlanDetails(updatedPlan, sessionVersion);
    assertSession(sessionVersion);
    return updatedPlan;
  };

  // 删除规划
  const removePlan = async (planId: string) => {
    const sessionVersion = userStore.sessionVersion;
    await serializePlanWrite(planId, sessionVersion, async () => {
      await deleteMealPlan(planId);
      assertSession(sessionVersion);
      allPlans.value = allPlans.value.filter(p => p.id !== planId);
      recordPlanWrite(planId);
    });
  };

  // 设置选中的规划
  const setSelectedPlan = (plan: EnrichedMealPlan | null) => {
    selectedPlan.value = plan;
  };

  // 执行规划（标记为已完成，移至历史）
  const executePlan = async (planId: string) => {
    const plan = allPlans.value.find(p => p.id === planId);
    if (!plan) {
      throw new Error('规划不存在');
    }

    completedPlanIds.value.add(planId);
    saveCompletedPlanIds();
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
      listRequest += 1;
      pendingPlanWrites.clear();
      pendingCreates.clear();
      allPlans.value = [];
      dishMap.value = {};
      selectedPlan.value = null;
      completedPlanIds.value = new Set();
      loading.value = false;
      initialized.value = false;
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
    initialized,
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
