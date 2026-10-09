<template>
  <view class="planning-page page-content" :aria-busy="loading">
    <!-- #ifdef MP-WEIXIN -->
    <!-- 微信小程序专用：统一在父组件管理 page-container 拦截返回事件 -->
    <!-- 详情弹窗 -->
    <page-container
      v-if="shouldRenderDetailHelper"
      :show="showDetailDialog"
      :overlay="false"
      :duration="300"
      :disable-scroll="false"
      custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="closeDetailDialog"
    />

    <!-- 编辑弹窗 -->
    <page-container
      v-if="shouldRenderEditHelper"
      :show="showEditDialog"
      :overlay="false"
      :duration="300"
      :disable-scroll="false"
      custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="requestEditClose(true)"
    />

    <!-- 新建弹窗 -->
    <page-container
      v-if="shouldRenderCreateHelper"
      :show="showCreateDialog"
      :overlay="false"
      :duration="300"
      :disable-scroll="false"
      custom-style="position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none;"
      @leave="requestCreateClose(true)"
    />

    <!-- #endif -->

    <!-- 标签页 -->
    <view class="planning-tabs" role="tablist" aria-label="规划分类">
      <button
        class="planning-button planning-tab"
        :class="{ 'planning-tab--selected': activeTab === 'current' }"
        role="tab"
        :aria-selected="activeTab === 'current'"
        @tap="switchTab('current')"
      >
        <text class="text-sm">当前规划{{ initialized ? ' (' + currentPlans.length + ')' : '' }}</text>
      </button>
      <button
        class="planning-button planning-tab"
        :class="{ 'planning-tab--selected': activeTab === 'history' }"
        role="tab"
        :aria-selected="activeTab === 'history'"
        @tap="switchTab('history')"
      >
        <text class="text-sm">历史规划{{ initialized ? ' (' + historyPlans.length + ')' : '' }}</text>
      </button>
    </view>

    <!-- 错误状态 -->
    <view v-if="error" class="flex flex-col items-center justify-center py-20 px-5" role="status">
      <text class="text-black mb-4">{{ error }}</text>
      <button @tap="refreshPlans" class="planning-button planning-primary">
        <text class="text-white">重试</text>
      </button>
    </view>

    <!-- 空状态 -->
    <view
      v-else-if="initialized && displayPlans.length === 0"
      class="flex flex-col items-center justify-center py-20 px-5"
    >
      <text class="text-gray-600 text-base mb-3">{{
        activeTab === 'current' ? '暂无当前规划' : '暂无历史规划'
      }}</text>
      <text v-if="activeTab === 'current'" class="planning-empty-hint"
        >先选喜欢的菜，再安排一餐。</text
      >
      <button
        v-if="activeTab === 'current'"
        @tap="createNewPlan"
        class="planning-button planning-primary"
      >
        <text class="text-gray-100">创建第一个规划</text>
      </button>
    </view>

    <!-- 规划列表（使用页面原生滚动，避免 scroll-view 未设置高度导致无法滚动） -->
    <view v-if="displayPlans.length" class="planning-list">
      <view class="flex flex-col items-center w-full">
        <PlanCard
          v-for="plan in displayPlans"
          :key="plan.id"
          :plan="plan"
          :is-history="activeTab === 'history'"
          @view="viewPlanDetail(plan)"
          @edit="editPlan(plan)"
          @delete="deletePlan(plan.id)"
          @execute="handleExecutePlan(plan)"
          class="w-full"
        />
        <view class="h-5"></view>
      </view>
    </view>

    <!-- 详情对话框 -->
    <PlanDetailDialog
      :visible="showDetailDialog"
      :plan="selectedPlan"
      @close="closeDetailDialog"
    />

    <!-- 编辑对话框 -->
    <PlanEditDialog
      ref="editDialogRef"
      :visible="showEditDialog"
      :plan="selectedPlan"
      :submitting="submitting"
      @close="closeEditDialog"
      @submit="submitEdit"
    />

    <!-- 创建对话框 -->
    <PlanEditDialog
      ref="createDialogRef"
      :visible="showCreateDialog"
      :plan="null"
      :submitting="submitting"
      @close="closeCreateDialog"
      @submit="submitCreate"
    />

    <!-- 浮动新建按钮 -->
    <button
      v-if="activeTab === 'current' && !showCreateDialog && !showEditDialog && !showDetailDialog"
      class="planning-button planning-new"
      aria-label="新建规划"
      @tap="createNewPlan"
    >
      <uni-icons type="plus" size="22" color="#ffffff" aria-hidden="true" />
      <text>新建规划</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, isRef, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { onHide, onPullDownRefresh, onBackPress } from '@dcloudio/uni-app';
import { useMenuPlanning } from './composables/use-menu-planning';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import PlanCard from './components/PlanCard.vue';
import PlanDetailDialog from './components/PlanDetailDialog.vue';
import PlanEditDialog from '@/components/meal-plan/PlanEditDialog.vue';

// 弹窗引用
const editDialogRef = ref<InstanceType<typeof PlanEditDialog> | null>(null);
const createDialogRef = ref<InstanceType<typeof PlanEditDialog> | null>(null);

const {
  loading,
  initialized,
  submitting,
  error,
  currentPlans,
  historyPlans,
  selectedPlan,
  displayPlans,
  activeTab,
  showDetailDialog,
  showEditDialog,
  showCreateDialog,
  viewPlanDetail,
  editPlan,
  deletePlan,
  createNewPlan,
  submitCreate,
  submitEdit,
  closeDetailDialog,
  closeEditDialog,
  closeCreateDialog,
  switchTab,
  refreshPlans,
  executePlan,
  handlePageHide,
} = useMenuPlanning();

// 微信小程序 page-container：延迟销毁以避免关闭弹窗后出现滚动锁定
const shouldRenderDetailHelper = ref(false);
const shouldRenderEditHelper = ref(false);
const shouldRenderCreateHelper = ref(false);

const requestEditClose = async (rearm = false) => {
  const closed = await editDialogRef.value?.requestClose();
  if (closed === false && rearm && showEditDialog.value) {
    shouldRenderEditHelper.value = false;
    await nextTick();
    if (showEditDialog.value) shouldRenderEditHelper.value = true;
  }
};
const requestCreateClose = async (rearm = false) => {
  const closed = await createDialogRef.value?.requestClose();
  if (closed === false && rearm && showCreateDialog.value) {
    shouldRenderCreateHelper.value = false;
    await nextTick();
    if (showCreateDialog.value) shouldRenderCreateHelper.value = true;
  }
};

if (isRef(showDetailDialog)) {
  watch(showDetailDialog, (val: boolean) => {
    if (val) {
      shouldRenderDetailHelper.value = true;
    } else {
      setTimeout(() => {
        shouldRenderDetailHelper.value = false;
      }, 300);
    }
  });
}

if (isRef(showEditDialog)) {
  watch(showEditDialog, (val: boolean) => {
    if (val) {
      shouldRenderEditHelper.value = true;
    } else {
      setTimeout(() => {
        if (!showEditDialog.value) shouldRenderEditHelper.value = false;
      }, 300);
    }
  });
}

if (isRef(showCreateDialog)) {
  watch(showCreateDialog, (val: boolean) => {
    if (val) {
      shouldRenderCreateHelper.value = true;
    } else {
      setTimeout(() => {
        if (!showCreateDialog.value) shouldRenderCreateHelper.value = false;
      }, 300);
    }
  });
}

// 页面暂时隐藏时保留未保存的规划。
onHide(() => {
  handlePageHide();
  if (showDetailDialog.value) closeDetailDialog();
});

// 返回键拦截处理（App/H5 端备用）
onBackPress(() => {
  if (showCreateDialog.value) {
    void requestCreateClose();
    return true;
  }
  if (showEditDialog.value) {
    void requestEditClose();
    return true;
  }
  // 关闭详情对话框
  if (showDetailDialog.value) {
    closeDetailDialog();
    return true;
  }

  return false; // 允许默认返回行为
});

const handleExecutePlan = async (plan: EnrichedMealPlan) => {
  await executePlan(plan.id);
};

// 下拉刷新处理
const onRefresh = async () => {
  try {
    await refreshPlans();
  } catch (error) {
    console.error('刷新规划数据失败:', error);
  } finally {
    uni.stopPullDownRefresh();
  }
};

onPullDownRefresh(onRefresh);

// 监听来自其它页面的全局刷新事件（例如 AI 页面应用了新规划）
onMounted(() => {
  try {
    uni.$on && uni.$on('meal-plan:changed', refreshPlans);
  } catch (e) {
    console.debug('uni.$on not available:', e);
  }
});

onBeforeUnmount(() => {
  try {
    uni.$off && uni.$off('meal-plan:changed', refreshPlans);
  } catch (e) {
    console.debug('uni.$off not available:', e);
  }
});
</script>

<style scoped>
.planning-page {
  position: relative;
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
  background: #fff;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.planning-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}
.planning-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
  background: #fff;
  color: #667085;
  font-size: 14px;
  line-height: 1.5;
}
.planning-button::after {
  border: 0;
}
.planning-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.planning-button:active {
  opacity: 0.72;
}
.planning-tab {
  flex: 1;
  min-height: 52px;
  padding: 0 4px;
  border-bottom: 2px solid transparent;
  border-radius: 0;
}
.planning-tab--selected {
  border-color: #660874;
  color: #660874;
  font-weight: 600;
}
.planning-primary {
  background: #660874;
  color: #fff;
}
.planning-empty-hint {
  color: #667085;
  font-size: 14px;
  margin-bottom: 20px;
}
.planning-list {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 20px 0;
}
.planning-new {
  position: fixed;
  right: 20px;
  bottom: calc(var(--window-bottom, 0px) + 20px + env(safe-area-inset-bottom));
  z-index: 30;
  gap: 8px;
  min-height: 48px;
  background: #660874;
  color: #fff;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.14);
}
</style>
