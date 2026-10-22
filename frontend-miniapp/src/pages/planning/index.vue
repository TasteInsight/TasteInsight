<template>
  <view
    class="planning-page page-content page-state-layout"
    :class="{ 'planning-page--state': !userStore.isLoggedIn }"
    :aria-busy="loading"
  >
    <LoginGate :title="t('social.plansLogin')" icon="calendar">
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

      <view class="planning-tabs" role="tablist" :aria-label="t('social.planViews')">
        <button
          v-for="option in viewOptions"
          :key="option.value"
          class="planning-button planning-tab"
          :class="{ 'planning-tab--selected': viewMode === option.value }"
          role="tab"
          :aria-selected="viewMode === option.value"
          @click="setViewMode(option.value)"
        >
          {{ option.label }}
        </button>
      </view>
      <template v-if="!error || initialized">
        <view class="planning-controls">
          <PlanCalendar
            v-if="viewMode !== 'list'"
            :mode="viewMode"
            :plans="calendarPlans"
            :today="today"
            :selected-date="selectedDate"
            @select="selectDate"
          />
          <UiPicker
            v-else
            mode="selector"
            :range="listCategoryLabels"
            :value="activeTab === 'current' ? 0 : 1"
            :aria-label="t('social.planCategories')"
            @change="changeListCategory"
            ><button
              class="planning-button planning-filter"
              :aria-label="t('social.selectListScope')"
            >
              <text
                >{{ activeTab === 'current' ? t('social.currentPlans') : t('social.pastPlans')
                }}{{ initialized ? ' (' + displayPlans.length + ')' : '' }}</text
              >
              <uni-icons type="down" size="14" color="#667085" aria-hidden="true" /></button
          ></UiPicker>
        </view>

        <view v-if="viewMode === 'month' || viewMode === 'week'" class="planning-agenda-heading">
          <text class="planning-agenda-title">{{ selectedDateLabel }}</text>
          <text v-if="initialized && displayPlans.length" class="planning-agenda-count">{{
            t('social.planCount', { count: displayPlans.length })
          }}</text>
        </view>
      </template>

      <AsyncState
        :loading="loading"
        :initialized="initialized"
        :has-content="!!displayPlans.length"
        :error="error"
        :loading-title="t('social.loadingPlans')"
        :empty-title="
          viewMode === 'day'
            ? ''
            : viewMode === 'list'
              ? activeTab === 'current'
                ? t('social.noCurrentPlans')
                : t('social.noPastPlans')
              : t('social.noPlansForDate')
        "
        empty-icon="calendar"
        :retry-text="t('social.retry')"
        @retry="refreshPlans"
      />

      <!-- 规划列表（使用页面原生滚动，避免 scroll-view 未设置高度导致无法滚动） -->
      <view
        v-if="displayPlans.length || (viewMode === 'day' && initialized && !error)"
        class="planning-list"
      >
        <view v-for="group in planGroups" :key="group.key" class="planning-meal-group">
          <text v-if="viewMode === 'day'" class="planning-meal-title">{{ group.label }}</text>
          <text v-if="!group.plans.length" class="planning-meal-empty">{{
            t('social.notPlanned')
          }}</text>
          <PlanCard
            v-for="plan in group.plans"
            :key="plan.id"
            :plan="plan"
            :is-history="viewMode === 'list' && activeTab === 'history'"
            :occurrence-date="viewMode === 'list' ? '' : selectedDate"
            :show-schedule="viewMode !== 'day'"
            :today="today"
            :can-publish="canContribute"
            @view="viewPlanDetail(plan)"
            @edit="editPlan(plan)"
            @delete="deletePlan(plan.id)"
            @execute="handleExecutePlan(plan)"
            @privacy="togglePublicPlan(plan)"
            @invite="openInvite(plan)"
            class="w-full"
          />
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
        :initial-date="viewMode === 'list' ? today : selectedDate"
        :submitting="submitting"
        @close="closeCreateDialog"
        @submit="submitCreate"
      />

      <!-- #ifndef MP-WEIXIN -->
      <DiningInviteSheet
        :visible="!!invitingPlan"
        :plan="invitingPlan"
        :initial-date="selectedDate"
        @close="invitingPlan = null"
        @saved="invitingPlan = null"
      />
      <!-- #endif -->

      <!-- 浮动新建按钮 -->
      <FloatingActionButton
        v-if="
          (viewMode !== 'list' || activeTab === 'current') &&
          !showCreateDialog &&
          !showEditDialog &&
          !showDetailDialog
        "
        :label="t('social.createPlan')"
        icon="plus"
        @click="createNewPlan"
      />
    </LoginGate>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { ref, computed, watch, isRef, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { onHide, onShow, onPullDownRefresh, onBackPress } from '@dcloudio/uni-app';
import { useMenuPlanning, type PlanningViewMode } from './composables/use-menu-planning';
import type { EnrichedMealPlan } from '@/store/modules/use-plan-store';
import PlanCard from './components/PlanCard.vue';
import PlanDetailDialog from './components/PlanDetailDialog.vue';
import PlanEditDialog from '@/components/meal-plan/PlanEditDialog.vue';
import PlanCalendar from './components/PlanCalendar.vue';
import UiPicker from '@/components/UiPicker.vue';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
import FloatingActionButton from '@/components/FloatingActionButton.vue';
import { useUserStore } from '@/store/modules/use-user-store';
// #ifndef MP-WEIXIN
import DiningInviteSheet from './components/DiningInviteSheet.vue';
import { usePlanStore } from '@/store/modules/use-plan-store';
// #endif

const userStore = useUserStore();
const viewOptions = computed<{ value: PlanningViewMode; label: string }[]>(() => [
  { value: 'month', label: t('social.month') },
  { value: 'week', label: t('social.week') },
  { value: 'day', label: t('social.day') },
  { value: 'list', label: t('social.list') },
]);
const listCategoryLabels = computed(() => [t('social.currentPlans'), t('social.pastPlans')]);
const canContribute = computed(() => userStore.userInfo?.capabilities?.canContribute === true);
// #ifndef MP-WEIXIN
const planStore = usePlanStore();
const invitingPlan = ref<EnrichedMealPlan | null>(null);
let socialViewVersion = 0;
let socialDisposed = false;
const captureSocialView = () => {
  const version = socialViewVersion;
  const session = userStore.sessionVersion;
  return () =>
    !socialDisposed && version === socialViewVersion && session === userStore.sessionVersion;
};
watch(
  () => userStore.sessionVersion,
  () => {
    invitingPlan.value = null;
  },
  { flush: 'sync' }
);
const openInvite = (plan: EnrichedMealPlan) => {
  invitingPlan.value = plan;
};
async function togglePublicPlan(plan: EnrichedMealPlan) {
  const isCurrent = captureSocialView();
  const makePublic = !plan.isPublic;
  const confirmed = await new Promise<boolean>(resolve =>
    uni.showModal({
      title: makePublic ? t('social.makePlanPublic') : t('social.makePrivate'),
      content: !makePublic
        ? t('social.privatePlanDescription')
        : userStore.userInfo?.settings?.showMealPlans
          ? t('social.publicPlanDescription')
          : t('social.publicPlanSpaceDescription'),
      confirmText: makePublic ? t('social.makePublic') : t('social.makePrivate'),
      success: result => resolve(!!result.confirm),
      fail: () => resolve(false),
    })
  );
  if (!confirmed || !isCurrent()) return;
  try {
    await planStore.updatePlan(plan.id, { isPublic: makePublic });
    if (isCurrent())
      uni.showToast({
        title: !makePublic
          ? t('social.planPrivate')
          : userStore.userInfo?.settings?.showMealPlans
            ? t('social.planPublic')
            : t('social.enablePlanSharing'),
        icon: 'none',
      });
  } catch (cause) {
    if (isCurrent())
      uni.showToast({
        title: cause instanceof Error ? cause.message : t('social.saveFailed'),
        icon: 'none',
      });
  }
}
// #endif

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
  handlePageShow,
  calendarPlans,
  selectedDate,
  selectDate,
  today,
  viewMode,
  setViewMode,
} = useMenuPlanning();

const selectedDateLabel = computed(() =>
  t('social.selectedDateTitle', {
    p0:
      selectedDate.value.slice(0, 4) !== today.value.slice(0, 4)
        ? selectedDate.value.slice(0, 4) + t('social.yearSeparator')
        : '',
    p1: Number(selectedDate.value.slice(5, 7)),
    p2: Number(selectedDate.value.slice(-2)),
    p3: selectedDate.value === today.value ? t('social.todaySuffix') : '',
  })
);
const planGroups = computed(() =>
  viewMode.value === 'day'
    ? [
        { key: 'breakfast', label: t('social.breakfast') },
        { key: 'lunch', label: t('social.lunch') },
        { key: 'dinner', label: t('social.dinner') },
        { key: 'nightsnack', label: t('social.lateNight') },
      ].map(group => ({
        ...group,
        plans: displayPlans.value.filter(plan => plan.mealTime === group.key),
      }))
    : [{ key: 'all', label: '', plans: displayPlans.value }]
);
function changeListCategory(event: { detail: { value: number | string } }) {
  switchTab(Number(event.detail.value) === 1 ? 'history' : 'current');
}

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
  // #ifndef MP-WEIXIN
  socialViewVersion += 1;
  invitingPlan.value = null;
  // #endif
});
onShow(() => handlePageShow());

// 返回键拦截处理（App/H5 端备用）
onBackPress(() => {
  // #ifndef MP-WEIXIN
  if (invitingPlan.value) {
    invitingPlan.value = null;
    return true;
  }
  // #endif
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
  await executePlan(plan.id, !plan.isCompleted);
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
  // #ifndef MP-WEIXIN
  socialDisposed = true;
  socialViewVersion += 1;
  // #endif
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
.planning-page--state {
  padding-bottom: 0;
}
.planning-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  padding: 0 16px;
}
.planning-controls {
  padding: 8px 20px 12px;
  border-bottom: 1px solid #e5e7eb;
}
.planning-agenda-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 0;
  min-height: 44px;
}
.planning-agenda-title,
.planning-meal-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}
.planning-agenda-count,
.planning-meal-empty {
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}
.planning-button.planning-filter {
  gap: 6px;
  justify-content: flex-start;
  margin: 0;
  padding: 0 8px 0 0;
  text-align: left;
  border: 0;
  border-radius: 8px;
  min-height: 44px;
  background: transparent;
  color: #1f2937;
  font-size: var(--field-font-size);
  line-height: var(--field-line-height);
  font-weight: 600;
}
.planning-button.planning-filter:active {
  background: #f4f4f5;
  opacity: 1;
}
@media (hover: hover) {
  .planning-button.planning-filter:hover {
    background: #f4f4f5;
  }
}
.planning-meal-title {
  display: block;
  padding-top: 20px;
}
.planning-meal-empty {
  display: block;
  padding: 12px 0 20px;
  border-bottom: 1px solid #e5e7eb;
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
  min-height: 44px;
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
.planning-list {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 20px 0;
}
</style>
