<template>
  <view class="campus-page public-profile page-content page-state-layout" :aria-busy="loading">
    <AsyncState
      :loading="loading"
      :has-content="!!profile"
      :error="error"
      :loading-title="t('account.profile.loadingProfile2')"
      @retry="loadProfile"
    />
    <template v-if="profile">
      <view class="public-header"
        ><UserAvatar :src="profile.avatar" :size="64" :label="profile.nickname" /><view
          class="public-identity"
          ><text class="public-name">{{ profile.nickname }}</text
          ><text v-if="profile.isVerifiedStudent" class="public-verified"
            ><UiIcon name="shield" :size="15" tone="primary" />{{
              t('account.profile.verifiedStudent2')
            }}</text
          ></view
        ></view
      >
      <text v-if="profile.bio" class="public-bio">{{ profile.bio }}</text>
      <view
        class="campus-tabs public-tabs"
        role="tablist"
        :aria-label="t('account.profile.profileContent')"
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
          {{ t('account.profile.posts') }}</button
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
          {{ t('account.profile.publicPlans') }}
        </button></view
      >
      <template v-if="tab === 'posts'">
        <AsyncState
          :loading="postsLoading"
          :initialized="postsReady"
          :has-content="!!posts.length"
          :error="postsError"
          :loading-title="t('account.profile.loadingPosts')"
          :empty-title="t('account.profile.noPublicPostsYet')"
          empty-icon="chat"
          @retry="retryPosts"
        />
        <PostCard v-for="post in posts" :key="post.id" :post="post" />
        <button
          v-if="postsMore && posts.length && !postsError"
          class="campus-button campus-more"
          role="button"
          :tabindex="postsLoading ? -1 : 0"
          :disabled="postsLoading"
          @click="postsMoreButton.activate"
          @keydown="postsMoreButton.handleKeydown"
          @keyup="postsMoreButton.handleKeyup"
          @blur="postsMoreButton.clearPress"
        >
          {{ t('account.profile.loadMorePosts') }}
        </button>
      </template>
      <template v-else>
        <AsyncState
          :loading="plansLoading"
          :initialized="plansReady"
          :has-content="!!plans.length"
          :error="plansError"
          :loading-title="t('account.profile.loadingPlans')"
          :empty-title="t('account.profile.noPublicPlansYet')"
          empty-icon="calendar"
          @retry="loadPlans(plansFailedAppend)"
        />
        <view v-for="plan in plans" :key="plan.id" class="public-plan"
          ><view class="public-plan-heading"
            ><text class="public-plan-date"
              >{{ plan.startDate
              }}{{
                plan.endDate !== plan.startDate ? t('account.profile.to') + plan.endDate : ''
              }}</text
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
              ><view class="public-dish-heading"
                ><text class="public-dish-name">{{ dish.name }}</text
                ><TagBadge
                  v-if="dish.status === 'offline'"
                  :label="t('account.profile.unavailable')"
                  tone="neutral" /></view
              ><text class="campus-hint">{{ dish.canteenName }} · {{ dish.windowName }}</text
              ><DishNutrition :dish="dish" /></view
            ><UiIcon name="chevron-right" :size="16" /></button
        ></view>
        <button
          v-if="plansMore && plans.length && !plansError"
          class="campus-button campus-more"
          role="button"
          :tabindex="plansLoading ? -1 : 0"
          :disabled="plansLoading"
          @click="plansMoreButton.activate"
          @keydown="plansMoreButton.handleKeydown"
          @keyup="plansMoreButton.handleKeyup"
          @blur="plansMoreButton.clearPress"
        >
          {{ t('account.profile.loadMoreMeals') }}
        </button>
      </template>
    </template>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue';
import { onLoad, onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import UserAvatar from '@/components/UserAvatar.vue';
import UiIcon from '@/components/UiIcon.vue';
import DishNutrition from '@/components/DishNutrition.vue';
import TagBadge from '@/components/TagBadge.vue';
import AsyncState from '@/components/AsyncState.vue';
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
const mealNames = computed(() => ({
  breakfast: t('account.profile.breakfast'),
  lunch: t('account.profile.lunch'),
  dinner: t('account.profile.dinner'),
  nightsnack: t('account.profile.lateNightSnack'),
}));
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
    error.value = t('account.profile.userNotFound');
    return;
  }
  const current = capture();
  const request = ++profileRequest;
  loading.value = true;
  error.value = '';
  try {
    const response = await getPublicProfile(id.value);
    if (!current() || request !== profileRequest) return;
    if (response.code !== 200)
      throw new Error(response.message || t('account.profile.unableToLoadProfile'));
    profile.value = response.data;
    loading.value = false;
    if (tab.value === 'posts') await loadPosts();
    else await loadPlans();
  } catch (cause) {
    if (current() && request === profileRequest) {
      error.value =
        cause instanceof Error ? cause.message : t('account.profile.unableToLoadProfileTry');
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
    if (response.code !== 200)
      throw new Error(response.message || t('account.profile.unableToLoadMealSchedule'));
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
      plansError.value =
        cause instanceof Error ? cause.message : t('account.profile.unableToLoadMealSchedule2');
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
const postsTabButton = useButtonActivation(() => setTab('posts'));
const plansTabButton = useButtonActivation(() => setTab('plans'));
const postsMoreButton = useButtonActivation(
  () => {
    void loadPosts(true);
  },
  () => postsLoading.value
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
.public-dish-heading {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.public-dish-name {
  min-width: 0;
}
.public-dish-heading .tag-badge {
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
