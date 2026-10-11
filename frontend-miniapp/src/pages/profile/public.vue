<template>
  <view class="campus-page public-profile" :aria-busy="loading">
    <view v-if="error" class="campus-error" role="alert"
      ><text>{{ error }}</text
      ><button
        class="campus-button"
        role="button"
        :tabindex="loading ? -1 : 0"
        :disabled="loading"
        @click="profileRetryButton.activate"
        @keydown="profileRetryButton.handleKeydown"
        @keyup="profileRetryButton.handleKeyup"
        @blur="profileRetryButton.clearPress"
      >
        重新加载
      </button></view
    >
    <template v-if="profile">
      <view class="public-header"
        ><UserAvatar :src="profile.avatar" :size="64" :label="profile.nickname" /><view
          class="public-identity"
          ><text class="public-name">{{ profile.nickname }}</text
          ><text v-if="profile.isVerifiedStudent" class="public-verified"
            ><UiIcon name="shield" :size="15" tone="primary" />已认证学生</text
          ></view
        ></view
      >
      <text v-if="profile.bio" class="public-bio">{{ profile.bio }}</text>
      <view class="campus-tabs public-tabs" role="tablist" aria-label="主页内容"
        ><button
          class="campus-button campus-tab"
          :class="{ 'campus-selected': tab === 'posts' }"
          role="tab"
          tabindex="0"
          :aria-selected="tab === 'posts'"
          @click="postsTabButton.activate"
          @keydown="postsTabButton.handleKeydown"
          @keyup="postsTabButton.handleKeyup"
          @blur="postsTabButton.clearPress"
        >
          动态</button
        ><button
          class="campus-button campus-tab"
          :class="{ 'campus-selected': tab === 'plans' }"
          role="tab"
          tabindex="0"
          :aria-selected="tab === 'plans'"
          @click="plansTabButton.activate"
          @keydown="plansTabButton.handleKeydown"
          @keyup="plansTabButton.handleKeyup"
          @blur="plansTabButton.clearPress"
        >
          公开计划
        </button></view
      >
      <template v-if="tab === 'posts'">
        <EmptyState
          v-if="postsReady && !posts.length && !postsError"
          title="还没有公开动态"
          icon="chat"
        />
        <PostCard v-for="post in posts" :key="post.id" :post="post" />
        <view v-if="postsError" class="campus-error" role="alert"
          ><text>{{ postsError }}</text
          ><button
            class="campus-button"
            role="button"
            :tabindex="postsLoading ? -1 : 0"
            :disabled="postsLoading"
            @click="postsRetryButton.activate"
            @keydown="postsRetryButton.handleKeydown"
            @keyup="postsRetryButton.handleKeyup"
            @blur="postsRetryButton.clearPress"
          >
            重试
          </button></view
        >
        <button
          v-else-if="postsMore && posts.length"
          class="campus-button campus-more"
          role="button"
          :tabindex="postsLoading ? -1 : 0"
          :disabled="postsLoading"
          @click="postsMoreButton.activate"
          @keydown="postsMoreButton.handleKeydown"
          @keyup="postsMoreButton.handleKeyup"
          @blur="postsMoreButton.clearPress"
        >
          {{ postsLoading ? '加载中…' : '加载更多动态' }}
        </button>
      </template>
      <template v-else>
        <EmptyState
          v-if="plansReady && !plans.length && !plansError"
          title="还没有公开计划"
          icon="calendar"
        />
        <view v-for="plan in plans" :key="plan.id" class="public-plan"
          ><view class="public-plan-heading"
            ><text class="public-plan-date"
              >{{ plan.startDate
              }}{{ plan.endDate !== plan.startDate ? ' 至 ' + plan.endDate : '' }}</text
            ><text class="campus-hint">{{ mealNames[plan.mealTime] }}</text></view
          ><button
            v-for="dish in plan.dishes"
            :key="dish.id"
            class="campus-button public-dish"
            role="button"
            tabindex="0"
            @click="dishButtons[plan.id][dish.id].activate"
            @keydown="dishButtons[plan.id][dish.id].handleKeydown"
            @keyup="dishButtons[plan.id][dish.id].handleKeyup"
            @blur="dishButtons[plan.id][dish.id].clearPress"
          >
            <image
              v-if="dish.images[0] && !failedImages[dish.images[0]]"
              :src="dish.images[0]"
              mode="aspectFill"
              @error="failedImages[dish.images[0]] = true"
            /><view class="public-dish-text"
              ><text>{{ dish.name }}</text
              ><text class="campus-hint">{{ dish.canteenName }} · {{ dish.windowName }}</text></view
            ><UiIcon name="chevron-right" :size="16" /></button
        ></view>
        <view v-if="plansError" class="campus-error" role="alert"
          ><text>{{ plansError }}</text
          ><button
            class="campus-button"
            role="button"
            :tabindex="plansLoading ? -1 : 0"
            :disabled="plansLoading"
            @click="plansRetryButton.activate"
            @keydown="plansRetryButton.handleKeydown"
            @keyup="plansRetryButton.handleKeyup"
            @blur="plansRetryButton.clearPress"
          >
            重试
          </button></view
        >
        <button
          v-else-if="plansMore && plans.length"
          class="campus-button campus-more"
          role="button"
          :tabindex="plansLoading ? -1 : 0"
          :disabled="plansLoading"
          @click="plansMoreButton.activate"
          @keydown="plansMoreButton.handleKeydown"
          @keyup="plansMoreButton.handleKeyup"
          @blur="plansMoreButton.clearPress"
        >
          {{ plansLoading ? '加载中…' : '加载更多安排' }}
        </button>
      </template>
    </template>
  </view>
</template>
<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue';
import { onLoad, onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import UserAvatar from '@/components/UserAvatar.vue';
import UiIcon from '@/components/UiIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import PostCard from '@/pages/community/components/PostCard.vue';
import {
  getPublicProfile,
  getPublicMealPlans,
  type PublicProfile,
  type PublicMealPlan,
} from '@/api/modules/social';
import { usePostFeed } from '@/pages/community/composables/use-post-feed';
import { useUserStore } from '@/store/modules/use-user-store';
import { useButtonActivation } from '@/composables/use-button-activation';

const user = useUserStore();
const id = ref('');
const profile = ref<PublicProfile | null>(null);
const loading = ref(false);
const error = ref('');
const tab = ref<'posts' | 'plans'>('posts');
const {
  posts,
  loading: postsLoading,
  initialized: postsReady,
  error: postsError,
  hasMore: postsMore,
  load: loadPosts,
  retry: retryPosts,
  reset: resetPosts,
  invalidate: invalidatePosts,
} = usePostFeed(() => ({ mine: false, authorId: id.value }));
const plans = ref<PublicMealPlan[]>([]);
const plansLoading = ref(false);
const plansReady = ref(false);
const plansError = ref('');
const plansMore = ref(false);
let plansPage = 0;
let plansFailedAppend = false;
const failedImages = ref<Record<string, boolean>>({});
const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', nightsnack: '夜宵' };
let active = true;
let visible = true;
let epoch = 0;
let profileRequest = 0;
let plansRequest = 0;
const capture = () => {
  const session = user.sessionVersion;
  const version = epoch;
  return () => active && visible && version === epoch && session === user.sessionVersion;
};
async function loadProfile() {
  if (!id.value) {
    error.value = '用户不存在';
    return;
  }
  const current = capture();
  const request = ++profileRequest;
  loading.value = true;
  error.value = '';
  try {
    const response = await getPublicProfile(id.value);
    if (!current() || request !== profileRequest) return;
    if (response.code !== 200) throw new Error(response.message || '主页加载失败');
    profile.value = response.data;
    if (tab.value === 'posts') await loadPosts();
    else await loadPlans();
  } catch (cause) {
    if (current() && request === profileRequest) {
      profile.value = null;
      error.value = cause instanceof Error ? cause.message : '主页加载失败，请重试';
    }
  } finally {
    if (current() && request === profileRequest) loading.value = false;
  }
}
async function loadPlans(append = false) {
  if (append && (plansLoading.value || !plansMore.value)) return;
  const current = capture();
  const request = ++plansRequest;
  const nextPage = append ? plansPage + 1 : 1;
  plansLoading.value = true;
  plansError.value = '';
  try {
    const response = await getPublicMealPlans(id.value, { page: nextPage, pageSize: 20 });
    if (!current() || request !== plansRequest) return;
    if (response.code !== 200) throw new Error(response.message || '饮食安排加载失败');
    const incoming = new Set(response.data.items.map(item => item.id));
    plans.value = [
      ...(append ? plans.value.filter(item => !incoming.has(item.id)) : []),
      ...response.data.items,
    ];
    plansPage = nextPage;
    plansMore.value = response.data.items.length === 20;
    plansReady.value = true;
  } catch (cause) {
    if (current() && request === plansRequest) {
      plansFailedAppend = append;
      plansError.value = cause instanceof Error ? cause.message : '饮食安排加载失败，请重试';
    }
  } finally {
    if (current() && request === plansRequest) plansLoading.value = false;
  }
}
function setTab(value: 'posts' | 'plans') {
  if (tab.value === value) return;
  tab.value = value;
  if (value === 'plans' && !plansReady.value) void loadPlans();
  else if (value === 'posts' && !postsReady.value) void loadPosts();
}
function openDish(dishId: string) {
  uni.navigateTo({ url: `/pages/dish/index?id=${encodeURIComponent(dishId)}` });
}
const profileRetryButton = useButtonActivation(
  () => {
    void loadProfile();
  },
  () => loading.value
);
const postsTabButton = useButtonActivation(() => setTab('posts'));
const plansTabButton = useButtonActivation(() => setTab('plans'));
const postsRetryButton = useButtonActivation(
  () => {
    void retryPosts();
  },
  () => postsLoading.value
);
const postsMoreButton = useButtonActivation(
  () => {
    void loadPosts(true);
  },
  () => postsLoading.value
);
const plansRetryButton = useButtonActivation(
  () => {
    void loadPlans(plansFailedAppend);
  },
  () => plansLoading.value
);
const plansMoreButton = useButtonActivation(
  () => {
    void loadPlans(true);
  },
  () => plansLoading.value
);
const dishButtons = computed(() =>
  Object.fromEntries(
    plans.value.map(plan => [
      plan.id,
      Object.fromEntries(
        plan.dishes.map(dish => [dish.id, useButtonActivation(() => openDish(dish.id))])
      ),
    ])
  )
);
watch(
  () => user.sessionVersion,
  session => {
    epoch++;
    profile.value = null;
    resetPosts();
    plans.value = [];
    plansReady.value = false;
    plansLoading.value = false;
    plansMore.value = false;
    loading.value = false;
    failedImages.value = {};
    void nextTick(() => {
      if (active && visible && session === user.sessionVersion) void loadProfile();
    });
  },
  { flush: 'sync' }
);
onLoad(options => {
  id.value = String(options?.id || user.userInfo?.id || '');
});
onShow(() => {
  visible = true;
  void loadProfile();
});
onHide(() => {
  visible = false;
  epoch++;
  invalidatePosts();
  loading.value = false;
  plansLoading.value = false;
});
onScopeDispose(() => {
  active = false;
  epoch++;
});
onPullDownRefresh(async () => {
  try {
    await loadProfile();
  } finally {
    uni.stopPullDownRefresh();
  }
});
onReachBottom(() => {
  if (tab.value === 'posts' && !postsError.value) void loadPosts(true);
  else if (tab.value === 'plans' && !plansError.value) void loadPlans(true);
});
</script>
<style scoped>
@import '../community/community.css';
.public-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.public-identity {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}
.public-name {
  color: #111827;
  font-size: 20px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.public-verified {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #660874;
  font-size: 13px;
}
.public-bio {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.65;
}
.public-tabs {
  margin-top: 24px;
}
.public-plan {
  padding: 20px 0;
  border-bottom: 1px solid #e5e7eb;
}
.public-plan-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 10px;
}
.public-plan-date {
  font-size: 15px;
  font-weight: 600;
}
.public-dish {
  display: flex;
  width: 100%;
  gap: 12px;
  padding: 10px 0;
  color: #1f2937;
  text-align: left;
}
.public-dish image {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  flex-shrink: 0;
}
.public-dish-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
