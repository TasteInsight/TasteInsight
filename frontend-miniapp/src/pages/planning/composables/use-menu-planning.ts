// @/composables/use-menu-planning.ts
import { ref, computed, onMounted } from 'vue';
import { usePlanStore } from '@/store/modules/use-plan-store';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import type { MealPlanRequest } from '@/types/api';

export type { EnrichedMealPlan } from '@/store/modules/use-plan-store';

export function useMenuPlanning() {
  const planStore = usePlanStore();
  const showDetailDialog = ref(false);
  const showEditDialog = ref(false);
  const showCreateDialog = ref(false);
  const activeTab = ref<'current' | 'history'>('current');

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
    // ensure only one dialog is open
    showCreateDialog.value = false;
    showEditDialog.value = false;
    planStore.setSelectedPlan(plan);
    showDetailDialog.value = true;
  };

  // 编辑规划
  const editPlan = (plan: EnrichedMealPlan) => {
    // ensure only one dialog is open
    showCreateDialog.value = false;
    showDetailDialog.value = false;
    planStore.setSelectedPlan(plan);
    showEditDialog.value = true;
  };

  // 删除规划
  const deletePlan = async (planId: string) => {
    try {
      const confirmed = await new Promise<boolean>((resolve) => {
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

      if (!confirmed) return;

      await planStore.removePlan(planId);
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  // 创建新规划
  const createNewPlan = () => {
    // ensure only one dialog is open
    showDetailDialog.value = false;
    showEditDialog.value = false;
    planStore.setSelectedPlan(null);
    showCreateDialog.value = true;
  };

  // 提交创建
  const submitCreate = async (planData: MealPlanRequest) => {
    try {
      await planStore.createPlan(planData);
      showCreateDialog.value = false;
    } catch (err) {
      console.error('创建失败:', err);
      throw err;
    }
  };

  // 提交编辑
  const submitEdit = async (planData: MealPlanRequest) => {
    if (!selectedPlan.value) return;
    
    try {
      await planStore.updatePlan(selectedPlan.value.id, planData);
      showEditDialog.value = false;
    } catch (err) {
      console.error('更新失败:', err);
      throw err;
    }
  };

  // 关闭对话框
  const closeDetailDialog = () => {
    showDetailDialog.value = false;
    planStore.setSelectedPlan(null);
  };

  const closeEditDialog = () => {
    showEditDialog.value = false;
    planStore.setSelectedPlan(null);
  };

  const closeCreateDialog = () => {
    showCreateDialog.value = false;
  };

  // 执行规划（将规划移至历史）
  const executePlan = async (planId: string) => {
    try {
      await planStore.executePlan(planId);
      // 执行成功后关闭详情弹窗
      showDetailDialog.value = false;
      uni.showToast({
        title: '规划已执行',
        icon: 'success',
      });
    } catch (err) {
      console.error('执行规划失败:', err);
      uni.showToast({
        title: '执行失败',
        icon: 'none',
      });
    }
  };

  // 切换标签页
  const switchTab = (tab: 'current' | 'history') => {
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

  return {
    // 状态
    loading,
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