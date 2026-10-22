import { t } from '@/i18n';
// @/composables/use-menu-planning.ts
import { ref, computed, onMounted, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { usePlanStore } from '@/store/modules/use-plan-store';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import type { MealPlanRequest } from '@/types/api';
import { campusToday, coversDate } from '../utils/meal-plan-date';

export type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
export type PlanningViewMode = 'month' | 'week' | 'day' | 'list';

export function useMenuPlanning() {
  const planStore = usePlanStore();
  const userStore = useUserStore();
  const showDetailDialog = ref(false);
  const showEditDialog = ref(false);
  const showCreateDialog = ref(false);
  const activeTab = ref<'current' | 'history'>('current');
  const submitting = ref(false);
  const today = ref(campusToday());
  const selectedDate = ref(today.value);
  const viewMode = ref<PlanningViewMode>('week');
  let midnightTimer: ReturnType<typeof setTimeout> | undefined;
  const handlePageShow = () => {
    today.value = campusToday();
    planStore.refreshClock();
    if (userStore.isLoggedIn && !planStore.initialized && !planStore.loading) void refreshPlans();
    clearTimeout(midnightTimer);
    const nextMidnight = Date.parse(today.value + 'T00:00:00+08:00') + 86400000;
    midnightTimer = setTimeout(handlePageShow, Math.max(1, nextMidnight - Date.now()));
  };
  let dialogVersion = 0;
  let visibilityVersion = 0;
  let disposed = false;
  const invalidateDialog = () => {
    dialogVersion += 1;
    submitting.value = false;
  };
  const captureDialog = () => {
    const version = dialogVersion;
    const session = userStore.sessionVersion;
    return () => !disposed && version === dialogVersion && session === userStore.sessionVersion;
  };
  const captureVisibleOperation = () => {
    const version = visibilityVersion;
    const ownsDialog = captureDialog();
    return () => version === visibilityVersion && ownsDialog();
  };
  const handlePageHide = () => {
    visibilityVersion += 1;
    clearTimeout(midnightTimer);
  };

  // 从 store 获取数据
  const loading = computed(() => planStore.loading);
  const initialized = computed(() => planStore.initialized);
  const error = computed(() => planStore.error);
  const currentPlans = computed(() => planStore.currentPlans);
  const historyPlans = computed(() => planStore.historyPlans);
  const selectedPlan = computed(() => planStore.selectedPlan);

  // 当前显示的规划列表
  const calendarPlans = computed(() => planStore.allPlans);
  const displayPlans = computed(() => {
    if (viewMode.value === 'list')
      return activeTab.value === 'current' ? currentPlans.value : historyPlans.value;
    const mealOrder = ['breakfast', 'lunch', 'dinner', 'nightsnack'];
    return planStore.enrichedPlans
      .filter(plan => coversDate(plan, selectedDate.value))
      .sort((a, b) => mealOrder.indexOf(a.mealTime) - mealOrder.indexOf(b.mealTime))
      .map(plan => ({
        ...plan,
        isCompleted: plan.completedDates?.includes(selectedDate.value) ?? false,
        isExpired: selectedDate.value < today.value,
      }));
  });
  const selectDate = (date: string) => {
    selectedDate.value = date;
  };
  const setViewMode = (mode: PlanningViewMode) => {
    viewMode.value = mode;
  };

  const refreshPlans = async () => {
    if (!userStore.isLoggedIn || planStore.loading) return;
    try {
      await planStore.fetchPlans();
    } catch {
      // 读取错误由 store.error 提供给页面，保留列表和重试入口。
    }
  };

  // 初始化加载
  onMounted(refreshPlans);

  // 查看规划详情
  const viewPlanDetail = (plan: EnrichedMealPlan) => {
    invalidateDialog();
    // ensure only one dialog is open
    showCreateDialog.value = false;
    showEditDialog.value = false;
    planStore.setSelectedPlan(plan);
    showDetailDialog.value = true;
  };

  // 编辑规划
  const editPlan = (plan: EnrichedMealPlan) => {
    if (!plan.dishesReady) return;
    invalidateDialog();
    // ensure only one dialog is open
    showCreateDialog.value = false;
    showDetailDialog.value = false;
    planStore.setSelectedPlan(plan);
    showEditDialog.value = true;
  };

  // 删除规划
  const deletePlan = async (planId: string) => {
    const isCurrent = captureVisibleOperation();
    try {
      const confirmed = await new Promise<boolean>(resolve => {
        uni.showModal({
          title: t('social.deleteConfirmation'),
          content: t('social.deletePlanConfirmation'),
          showCancel: true,
          cancelText: t('social.cancel'),
          confirmText: t('social.confirm'),
          success: (res: any) => {
            resolve(!!res.confirm);
          },
          fail: () => resolve(false),
        });
      });

      if (!confirmed || !isCurrent()) return;

      await planStore.removePlan(planId);
    } catch (err) {
      if (!isCurrent()) return;
      console.error('删除失败:', err);
      uni.showToast({
        title: err instanceof Error ? err.message : t('social.deletePlanFailed'),
        icon: 'none',
      });
    }
  };

  // 创建新规划
  const createNewPlan = () => {
    invalidateDialog();
    // ensure only one dialog is open
    showDetailDialog.value = false;
    showEditDialog.value = false;
    planStore.setSelectedPlan(null);
    showCreateDialog.value = true;
  };

  const savePlan = async (planData: MealPlanRequest, planId?: string) => {
    if (submitting.value || disposed) return;
    submitting.value = true;
    const isCurrent = captureDialog();
    const canShowFeedback = captureVisibleOperation();
    try {
      if (planId) {
        await planStore.updatePlan(planId, planData);
        if (!isCurrent()) return;
        showEditDialog.value = false;
      } else {
        await planStore.createPlan(planData);
        if (!isCurrent()) return;
        showCreateDialog.value = false;
      }
    } catch (err) {
      if (!canShowFeedback()) return;
      console.error('保存规划失败:', err);
      uni.showToast({
        title: err instanceof Error ? err.message : t('social.savePlanFailed'),
        icon: 'none',
      });
      throw err;
    } finally {
      if (isCurrent()) submitting.value = false;
    }
  };

  // 提交创建
  const submitCreate = (planData: MealPlanRequest) => savePlan(planData);

  // 提交编辑
  const submitEdit = async (planData: MealPlanRequest) => {
    if (!selectedPlan.value) return;

    return savePlan(planData, selectedPlan.value.id);
  };

  // 关闭对话框
  const closeDetailDialog = () => {
    invalidateDialog();
    showDetailDialog.value = false;
    planStore.setSelectedPlan(null);
  };

  const closeEditDialog = () => {
    invalidateDialog();
    showEditDialog.value = false;
    planStore.setSelectedPlan(null);
  };

  const closeCreateDialog = () => {
    invalidateDialog();
    showCreateDialog.value = false;
  };

  // 执行规划（将规划移至历史）
  const executePlan = async (planId: string, completed = true) => {
    const isCurrent = captureVisibleOperation();
    try {
      await planStore.executePlan(
        planId,
        viewMode.value === 'list' ? undefined : selectedDate.value,
        completed
      );
      if (!isCurrent()) return;
      // 执行成功后关闭详情弹窗
      showDetailDialog.value = false;
      uni.showToast({
        title: completed ? t('social.markedEaten') : t('social.eatenMarkRemoved'),
        icon: 'success',
      });
    } catch (err) {
      if (!isCurrent()) return;
      console.error('执行规划失败:', err);
      uni.showToast({
        title: t('social.markFailed'),
        icon: 'none',
      });
    }
  };

  // 切换标签页
  const switchTab = (tab: 'current' | 'history') => {
    invalidateDialog();
    // close any open dialogs when switching tabs
    showDetailDialog.value = false;
    showEditDialog.value = false;
    showCreateDialog.value = false;
    planStore.setSelectedPlan(null);
    activeTab.value = tab;
  };

  watch(
    () => userStore.sessionVersion,
    () => {
      invalidateDialog();
      showDetailDialog.value = false;
      showEditDialog.value = false;
      showCreateDialog.value = false;
      submitting.value = false;
      activeTab.value = 'current';
      today.value = campusToday();
      selectedDate.value = today.value;
      viewMode.value = 'week';
    },
    { flush: 'sync' }
  );

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      clearTimeout(midnightTimer);
      invalidateDialog();
    });

  return {
    // 状态
    loading,
    initialized,
    submitting,
    error,
    currentPlans,
    historyPlans,
    selectedPlan,
    displayPlans,
    activeTab,

    // 对话框状态
    showDetailDialog,
    showEditDialog,
    showCreateDialog,

    // 方法
    viewPlanDetail,
    editPlan,
    deletePlan,
    createNewPlan,
    submitCreate,
    submitEdit,
    closeDetailDialog,
    closeEditDialog,
    closeCreateDialog,
    executePlan,
    switchTab,
    refreshPlans,
    handlePageHide,
    handlePageShow,
    calendarPlans,
    selectedDate,
    selectDate,
    today,
    viewMode,
    setViewMode,
  };
}
