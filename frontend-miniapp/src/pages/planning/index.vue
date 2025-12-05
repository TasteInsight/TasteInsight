<template>
  <view class="min-h-screen bg-gray-50 pb-safe">
    <!-- 骨架屏：首次加载时显示 -->
    <PlanningSkeleton v-if="isInitialLoading" />

    <template v-else>
    <!-- 标签页 -->
    <view class="bg-white flex border-b-2 border-gray-100">
      <view 
        :class="['flex-1 py-3 text-center border-b-2', activeTab === 'current' ? 'border-purple-700 text-ts-purple font-semibold' : 'border-transparent text-gray-600']"
        @tap="switchTab('current')"
      >
        <text>当前规划 ({{ currentPlans.length }})</text>
      </view>
      <view 
        :class="['flex-1 py-3 text-center border-b-2', activeTab === 'history' ? 'border-purple-700 text-ts-purple font-semibold' : 'border-transparent text-gray-600']"
        @tap="switchTab('history')"
      >
        <text>历史规划 ({{ historyPlans.length }})</text>
      </view>
    </view>

     <!-- 页面头部 -->
    <view v-if="activeTab === 'current'" class="bg-white px-5 py-4 flex justify-end items-center border-b border-gray-100">
      <view @tap="createNewPlan" class="flex items-center gap-1.5 bg-ts-purple py-2 px-5 rounded-lg border border-ts-purple">
        <text class="text-gray-100 text-xl">+</text>
        <text class="text-gray-100">新建规划</text>
      </view>
    </view>

    <!-- 加载状态（后续加载） -->
    <view v-if="loading && !isInitialLoading" class="flex flex-col items-center justify-center py-20">
      <view class="w-10 h-10 border-4 border-gray-200 border-t-purple-700 rounded-full animate-spin mb-4"></view>
      <text class="text-gray-500">加载中...</text>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="error" class="flex flex-col items-center justify-center py-20 px-5">
      <text class="text-red-500 mb-4">{{ error }}</text>
      <view @tap="refreshPlans" class="py-2 px-6 bg-purple-700 rounded-lg">
        <text class="text-white">重试</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="displayPlans.length === 0" class="flex flex-col items-center justify-center py-20 px-5">
      <text class="text-6xl text-gray-300 mb-4">📅</text>
      <text class="text-gray-400 text-lg mb-5">{{ activeTab === 'current' ? '暂无当前规划' : '暂无历史规划' }}</text>
      <view v-if="activeTab === 'current'" @tap="createNewPlan" class="py-2 px-6 bg-ts-purple rounded-lg border border-ts-purple">
        <text class="text-gray-100">创建第一个规划</text>
      </view>
    </view>

    <!-- 规划列表 -->
    <scroll-view v-else scroll-y class="box-border w-full px-5 pt-5">
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
    </scroll-view>

    <!-- 详情对话框 -->
    <PlanDetailDialog
      :visible="showDetailDialog"
      :plan="selectedPlan"
      @close="closeDetailDialog"
    />

    <!-- 编辑对话框 -->
    <PlanEditDialog
      :visible="showEditDialog"
      :plan="selectedPlan"
      @close="closeEditDialog"
      @submit="submitEdit"
    />

    <!-- 创建对话框 -->
    <PlanEditDialog
      :visible="showCreateDialog"
      :plan="null"
      @close="closeCreateDialog"
      @submit="submitCreate"
    />
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onHide, onPullDownRefresh } from '@dcloudio/uni-app';
import { useMenuPlanning } from './composables/use-menu-planning';
import type { EnrichedMealPlan } from './composables/use-menu-planning';
import PlanCard from './components/PlanCard.vue';
import PlanDetailDialog from './components/PlanDetailDialog.vue';
import PlanEditDialog from './components/PlanEditDialog.vue';
import { PlanningSkeleton } from '@/components/skeleton';

// 初次加载标记
const hasLoaded = ref(false);

const {
  loading,
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
} = useMenuPlanning();

// 首次加载状态：加载中且数据为空
const isInitialLoading = computed(() => {
  return loading.value && !hasLoaded.value;
});

// 监听数据加载完成
import { watch } from 'vue';
watch([currentPlans, historyPlans], () => {
  if (currentPlans.value.length > 0 || historyPlans.value.length > 0 || !loading.value) {
    hasLoaded.value = true;
  }
}, { immediate: true });

// 页面隐藏时关闭所有对话框
onHide(() => {
  closeDetailDialog();
  closeEditDialog();
  closeCreateDialog();
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
</script>

<style>
page {
  background-color: #f8f9fa;
}
</style>