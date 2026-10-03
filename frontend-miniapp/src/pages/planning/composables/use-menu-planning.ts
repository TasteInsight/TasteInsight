// @/composables/use-menu-planning.ts
import { ref, computed, onMounted, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { usePlanStore } from '@/store/modules/use-plan-store';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import type { MealPlanRequest } from '@/types/api';

export type { EnrichedMealPlan } from '@/store/modules/use-plan-store';

export function useMenuPlanning() {
  const planStore = usePlanStore();
  const userStore = useUserStore();
  const showDetailDialog = ref(false);
  const showEditDialog = ref(false);
  const showCreateDialog = ref(false);
  const activeTab = ref<'current' | 'history'>('current');
  const submitting = ref(false);
  let dialogVersion = 0;
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

  // 从 store 获取数据
  const loading = computed(() => planStore.loading);
  const error = computed(() => planStore.error);
  const currentPlans = computed(() => planStore.currentPlans);
  const historyPlans = computed(() => planStore.historyPlans);
  const selectedPlan = computed(() => planStore.selectedPlan);

  // 当前显示的规划列表
  const displayPlans = computed(() =>
    activeTab.value === 'current' ? currentPlans.value : historyPlans.value
  );

  // 初始化加载
  onMounted(async () => {
    await planStore.fetchPlans();
  });

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
    invalidateDialog();
    // ensure only one dialog is open
    showCreateDialog.value = false;
    showDetailDialog.value = false;
    planStore.setSelectedPlan(plan);
    showEditDialog.value = true;
  };

  // 删除规划
  const deletePlan = async (planId: string) => {
    const sessionVersion = userStore.sessionVersion;
    try {
      const confirmed = await new Promise<boolean>(resolve => {
        uni.showModal({
          title: '删除确认',
          content: '确定要删除这个饮食规划吗？',
          showCancel: true,
          cancelText: '取消',
          confirmText: '确定',
          success: (res: any) => {
            resolve(!!res.confirm);
          },
          fail: () => resolve(false),
        });
      });

      if (!confirmed || userStore.sessionVersion !== sessionVersion) return;

      await planStore.removePlan(planId);
    } catch (err) {
      if (userStore.sessionVersion !== sessionVersion) return;
      console.error('删除失败:', err);
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
      if (!isCurrent()) return;
      console.error('保存规划失败:', err);
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
  const executePlan = async (planId: string) => {
    const isCurrent = captureDialog();
    try {
      await planStore.executePlan(planId);
      if (!isCurrent()) return;
      // 执行成功后关闭详情弹窗
      showDetailDialog.value = false;
      uni.showToast({
        title: '规划已执行',
        icon: 'success',
      });
    } catch (err) {
      if (!isCurrent()) return;
      console.error('执行规划失败:', err);
      uni.showToast({
        title: '执行失败',
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

  // 刷新列表
  const refreshPlans = async () => {
    await planStore.fetchPlans();
  };

  watch(() => userStore.sessionVersion, () => {
    invalidateDialog();
    showDetailDialog.value = false;
    showEditDialog.value = false;
    showCreateDialog.value = false;
    submitting.value = false;
    activeTab.value = 'current';
  }, { flush: 'sync' });

  if (getCurrentScope()) onScopeDispose(() => {
    disposed = true;
    invalidateDialog();
  });

  return {
    // 状态
    loading,
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
  };
}
