<template>
  <view class="page-content profile-page">
    <view class="profile-header" :aria-busy="loading">
      <UserHeader
        v-if="userInfo || !isLoggedIn"
        :user-info="userInfo"
        :is-logged-in="isLoggedIn"
        :loading="loading"
        @login="handleLogin"
        @manage="manageProfile"
      />
      <view class="profile-tools">
        <IconButton
          v-if="isLoggedIn"
          name="bell"
          :size="20"
          :label="unreadCount ? '消息，' + unreadCount + ' 条未读' : '消息'"
          @click="navigateTo('/pages/notifications/index')"
        >
          <text v-if="unreadCount" class="profile-unread" aria-hidden="true">{{
            unreadCount > 99 ? '99+' : unreadCount
          }}</text>
        </IconButton>
        <IconButton
          name="settings"
          :size="20"
          label="设置"
          @click="navigateTo('/pages/settings/index')"
        />
      </view>
    </view>
    <view v-if="error" class="profile-error" role="alert">
      <text>{{ error }}</text
      ><button
        class="profile-button profile-retry"
        :disabled="loading"
        @click="profileRetryButton.activate"
        @keydown="profileRetryButton.handleKeydown"
        @keyup="profileRetryButton.handleKeyup"
        @blur="profileRetryButton.clearPress"
        role="button"
        :tabindex="loading ? -1 : 0"
      >
        重新加载
      </button>
    </view>
    <ProfileBioEditor v-if="editingBio && userInfo" ref="bioEditor" @close="editingBio = false" />
    <template v-if="isLoggedIn">
      <view class="profile-utilities" aria-label="个人记录">
        <button
          class="profile-button profile-utility"
          @click="favoritesButton.activate"
          @keydown="favoritesButton.handleKeydown"
          @keyup="favoritesButton.handleKeyup"
          @blur="favoritesButton.clearPress"
          role="button"
          tabindex="0"
        >
          <UiIcon name="bookmark" :size="18" /><text>收藏</text>
        </button>
        <button
          class="profile-button profile-utility"
          @click="historyButton.activate"
          @keydown="historyButton.handleKeydown"
          @keyup="historyButton.handleKeyup"
          @blur="historyButton.clearPress"
          role="button"
          tabindex="0"
        >
          <UiIcon name="history" :size="18" /><text>浏览记录</text>
        </button>
        <button
          class="profile-button profile-utility"
          @click="uploadsButton.activate"
          @keydown="uploadsButton.handleKeydown"
          @keyup="uploadsButton.handleKeyup"
          @blur="uploadsButton.clearPress"
          role="button"
          tabindex="0"
        >
          <UiIcon name="edit" :size="18" /><text>我的上传</text>
        </button>
        <button
          class="profile-button profile-utility profile-manage"
          aria-label="资料管理"
          role="button"
          :tabindex="userInfo ? 0 : -1"
          :disabled="!userInfo"
          @click="manageButton.activate"
          @keydown="manageButton.handleKeydown"
          @keyup="manageButton.handleKeyup"
          @blur="manageButton.clearPress"
        >
          <UiIcon name="edit" :size="16" /><text>资料</text
          ><UiIcon name="chevron-down" :size="13" />
        </button>
      </view>
      <view class="profile-tab-row">
        <view class="profile-tabs" role="tablist" aria-label="我的内容">
          <!-- #ifndef MP-WEIXIN -->
          <button
            class="profile-button profile-tab"
            :class="{ 'profile-tab-active': activeTab === 'posts' }"
            role="tab"
            :aria-selected="activeTab === 'posts'"
            @click="postsTabButton.activate"
            @keydown="postsTabButton.handleKeydown"
            @keyup="postsTabButton.handleKeyup"
            @blur="postsTabButton.clearPress"
            tabindex="0"
          >
            动态
          </button>
          <!-- #endif -->
          <button
            class="profile-button profile-tab"
            :class="{ 'profile-tab-active': activeTab === 'reviews' }"
            role="tab"
            :aria-selected="activeTab === 'reviews'"
            @click="reviewsTabButton.activate"
            @keydown="reviewsTabButton.handleKeydown"
            @keyup="reviewsTabButton.handleKeyup"
            @blur="reviewsTabButton.clearPress"
            tabindex="0"
          >
            评价
          </button>
          <button
            class="profile-button profile-tab"
            :class="{ 'profile-tab-active': activeTab === 'plans' }"
            role="tab"
            :aria-selected="activeTab === 'plans'"
            @click="plansTabButton.activate"
            @keydown="plansTabButton.handleKeydown"
            @keyup="plansTabButton.handleKeyup"
            @blur="plansTabButton.clearPress"
            tabindex="0"
          >
            计划
          </button>
        </view>
        <!-- #ifndef MP-WEIXIN -->
        <IconButton
          v-if="activeTab === 'posts'"
          name="plus"
          label="写动态"
          :size="20"
          tone="primary"
          @click="compose"
        />
        <!-- #endif -->
      </view>
      <!-- #ifndef MP-WEIXIN -->
      <view v-if="activeTab === 'posts'" class="profile-content" :aria-busy="postsLoading">
        <EmptyState
          v-if="postsReady && !posts.length && !postsError"
          title="还没有动态"
          icon="chat"
        />
        <view v-if="posts.length" class="profile-post-grid">
          <ProfilePostCard v-for="post in posts" :key="post.id" :post="post" />
        </view>
        <view v-if="postsError" class="profile-error" role="alert"
          ><text>{{ postsError }}</text
          ><button
            class="profile-button profile-retry"
            :disabled="postsLoading"
            @click="postsRetryButton.activate"
            @keydown="postsRetryButton.handleKeydown"
            @keyup="postsRetryButton.handleKeyup"
            @blur="postsRetryButton.clearPress"
            role="button"
            :tabindex="postsLoading ? -1 : 0"
          >
            重试
          </button></view
        >
        <button
          v-else-if="posts.length && postsMore"
          class="profile-button profile-more"
          :disabled="postsLoading"
          @click="postsMoreButton.activate"
          @keydown="postsMoreButton.handleKeydown"
          @keyup="postsMoreButton.handleKeyup"
          @blur="postsMoreButton.clearPress"
          role="button"
          :tabindex="postsLoading ? -1 : 0"
        >
          {{ postsLoading ? '加载中…' : '加载更多' }}
        </button>
      </view>
      <!-- #endif -->
      <view v-if="activeTab === 'reviews'" class="profile-content" :aria-busy="reviewsLoading">
        <EmptyState
          v-if="reviewsReady && !reviews.length && !reviewsError"
          title="还没有评价"
          icon="star"
          action-text="去选菜"
          @action="openHome"
        />
        <ReviewCard
          v-for="review in reviews"
          :key="review.id"
          :review="review"
          @click="openDish(review.dishId)"
        />
        <view v-if="reviewsError" class="profile-error" role="alert"
          ><text>{{ reviewsError }}</text
          ><button
            class="profile-button profile-retry"
            :disabled="reviewsLoading"
            @click="reviewsRetryButton.activate"
            @keydown="reviewsRetryButton.handleKeydown"
            @keyup="reviewsRetryButton.handleKeyup"
            @blur="reviewsRetryButton.clearPress"
            role="button"
            :tabindex="reviewsLoading ? -1 : 0"
          >
            重试
          </button></view
        >
        <button
          v-else-if="reviews.length && reviewsMore"
          class="profile-button profile-more"
          :disabled="reviewsLoading"
          @click="reviewsMoreButton.activate"
          @keydown="reviewsMoreButton.handleKeydown"
          @keyup="reviewsMoreButton.handleKeyup"
          @blur="reviewsMoreButton.clearPress"
          role="button"
          :tabindex="reviewsLoading ? -1 : 0"
        >
          {{ reviewsLoading ? '加载中…' : '加载更多' }}
        </button>
      </view>
      <ProfilePlans v-if="activeTab === 'plans'" ref="plansPane" :active="visible" />
    </template>
    <!-- #ifdef H5 -->
    <ProfileActionsSheet
      v-if="profileMenu"
      :items="profileMenu.items"
      :can-restore-focus="canRestoreProfileFocus"
      @select="profileMenu.select"
      @close="closeProfileActions"
    />
    <!-- #endif -->
  </view>
</template>
<script setup lang="ts">
import { nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { onShow, onHide, onPullDownRefresh, onReachBottom, onBackPress } from '@dcloudio/uni-app';
import UiIcon from '@/components/UiIcon.vue';
import IconButton from '@/components/IconButton.vue';
import { useButtonActivation } from '@/composables/use-button-activation';
import EmptyState from '@/components/EmptyState.vue';
import UserHeader from './components/UserHeader.vue';
import ProfileBioEditor from './components/ProfileBioEditor.vue';
import ProfilePlans from './components/ProfilePlans.vue';
// #ifdef H5
import ProfileActionsSheet from './components/ProfileActionsSheet.vue';
// #endif
import ReviewCard from './my-reviews/components/ReviewCard.vue';
import { useProfile } from './composables/use-profile';
import { useMyReviews } from './my-reviews/composables/use-my-reviews';
import { getUnreadNotificationCount } from '@/api/modules/notifications';
import { useUserStore } from '@/store/modules/use-user-store';
// #ifndef MP-WEIXIN
import ProfilePostCard from './components/ProfilePostCard.vue';
import { usePostFeed } from '@/pages/community/composables/use-post-feed';
import { requireStudent } from '@/utils/student-access';
// #endif
const user = useUserStore();
const {
  userInfo,
  isLoggedIn,
  loading,
  error,
  fetchProfile,
  invalidate: invalidateProfile,
} = useProfile();
type ProfileTab = 'posts' | 'reviews' | 'plans';
const activeTab = ref<ProfileTab>('reviews');
const editingBio = ref(false);
const bioEditor = ref<InstanceType<typeof ProfileBioEditor> | null>(null);
const plansPane = ref<InstanceType<typeof ProfilePlans> | null>(null);
// #ifdef H5
type ProfileMenu = { items: string[]; select: (index: number) => void };
const profileMenu = shallowRef<ProfileMenu | null>(null);
const closeProfileActions = () => {
  profileMenu.value = null;
};
const canRestoreProfileFocus = () => active && visible.value;
// #endif
const {
  reviews,
  loading: reviewsLoading,
  initialized: reviewsReady,
  error: reviewsError,
  hasMore: reviewsMore,
  refresh: refreshReviews,
  loadMore: loadMoreReviews,
  retry: retryReviews,
  invalidate: invalidateReviews,
} = useMyReviews();
// #ifndef MP-WEIXIN
activeTab.value = 'posts';
const {
  posts,
  loading: postsLoading,
  initialized: postsReady,
  error: postsError,
  hasMore: postsMore,
  load: loadPosts,
  retry: retryPosts,
  invalidate: invalidatePosts,
} = usePostFeed(() => ({ mine: true }));
function compose() {
  if (requireStudent()) navigateTo('/pages/community/editor');
}
const postsTabButton = useButtonActivation(() => {
  void setTab('posts');
});
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
// #endif
const unreadCount = ref(0);
let unreadVersion = 0;
let pageVersion = 0;
let active = true;
const visible = ref(true);
async function loadUnread() {
  const version = ++unreadVersion;
  const session = user.sessionVersion;
  if (!isLoggedIn.value) {
    unreadCount.value = 0;
    return;
  }
  try {
    const response = await getUnreadNotificationCount();
    if (
      active &&
      visible.value &&
      version === unreadVersion &&
      session === user.sessionVersion &&
      response.code === 200
    )
      unreadCount.value = response.data.unreadCount;
  } catch {
    if (active && visible.value && version === unreadVersion && session === user.sessionVersion)
      unreadCount.value = 0;
  }
}
async function loadContent() {
  if (!isLoggedIn.value) return;
  // #ifndef MP-WEIXIN
  if (activeTab.value === 'posts') return loadPosts();
  // #endif
  if (activeTab.value === 'reviews') return refreshReviews();
  if (activeTab.value === 'plans') return plansPane.value?.refresh();
}
async function refreshPage() {
  const session = user.sessionVersion;
  const version = ++pageVersion;
  void loadUnread();
  await fetchProfile();
  if (active && visible.value && version === pageVersion && session === user.sessionVersion)
    await loadContent();
}
async function setTab(value: ProfileTab) {
  if (activeTab.value === value) return;
  activeTab.value = value;
  await nextTick();
  if (!active || !visible.value || !isLoggedIn.value) return;
  // #ifndef MP-WEIXIN
  if (value === 'posts' && postsReady.value) return;
  // #endif
  if (value === 'reviews' && reviewsReady.value) return;
  await loadContent();
}
watch(
  () => user.sessionVersion,
  session => {
    pageVersion++;
    unreadVersion++;
    unreadCount.value = 0;
    editingBio.value = false;
    // #ifdef H5
    closeProfileActions();
    // #endif
    void nextTick(() => {
      if (active && visible.value && session === user.sessionVersion) void refreshPage();
    });
  },
  { flush: 'sync' }
);
onShow(() => {
  visible.value = true;
  void refreshPage();
});
onHide(() => {
  visible.value = false;
  // #ifdef H5
  closeProfileActions();
  // #endif
  pageVersion++;
  unreadVersion++;
  invalidateProfile();
  invalidateReviews();
  // #ifndef MP-WEIXIN
  invalidatePosts();
  // #endif
});
onScopeDispose(() => {
  active = false;
  pageVersion++;
  unreadVersion++;
});
onPullDownRefresh(async () => {
  try {
    await refreshPage();
  } finally {
    uni.stopPullDownRefresh();
  }
});
onReachBottom(() => {
  // #ifndef MP-WEIXIN
  if (activeTab.value === 'posts' && !postsError.value) void loadPosts(true);
  // #endif
  if (activeTab.value === 'reviews' && !reviewsError.value) void loadMoreReviews();
});
onBackPress(() => {
  // #ifdef H5
  if (profileMenu.value) {
    closeProfileActions();
    return true;
  }
  // #endif
  if (!editingBio.value) return false;
  void bioEditor.value?.cancel();
  return true;
});
function navigateTo(path: string) {
  uni.navigateTo({ url: path, fail: () => uni.showToast({ title: '页面跳转失败', icon: 'none' }) });
}
function manageProfile() {
  if (!active || !visible.value || !isLoggedIn.value || !userInfo.value) return;
  const session = user.sessionVersion;
  const actions = [
    { label: '头像与昵称', run: () => navigateTo('/pages/settings/components/personal') },
    {
      label: '个人简介',
      run: () => {
        editingBio.value = true;
      },
    },
    { label: '账号与校园身份', run: () => navigateTo('/pages/profile/identity') },
  ];
  // #ifndef MP-WEIXIN
  const ownerId = userInfo.value.id;
  actions.push({
    label: '访客预览',
    run: () => navigateTo('/pages/profile/public?id=' + encodeURIComponent(ownerId)),
  });
  // #endif
  const select = (index: number) => {
    if (active && visible.value && session === user.sessionVersion) actions[index]?.run();
  };
  // #ifdef H5
  const menu: ProfileMenu = {
    items: actions.map(action => action.label),
    select: index => {
      if (profileMenu.value !== menu) return;
      closeProfileActions();
      select(index);
    },
  };
  profileMenu.value = menu;
  return;
  // #endif
  // #ifndef H5
  uni.showActionSheet({
    itemList: actions.map(action => action.label),
    success: result => {
      select(result.tapIndex);
    },
  });
  // #endif
}
const manageButton = useButtonActivation(manageProfile, () => !userInfo.value);
const handleLogin = () => navigateTo('/pages/login/index');
const openDish = (id: string) => navigateTo('/pages/dish/index?id=' + encodeURIComponent(id));
const openHome = () => uni.switchTab({ url: '/pages/index/index' });
const favoritesButton = useButtonActivation(() => navigateTo('/pages/profile/my-favorites/index'));
const historyButton = useButtonActivation(() => navigateTo('/pages/profile/history/index'));
const uploadsButton = useButtonActivation(() => navigateTo('/pages/profile/my-uploads/index'));
const profileRetryButton = useButtonActivation(
  () => {
    void refreshPage();
  },
  () => loading.value
);
const reviewsTabButton = useButtonActivation(() => {
  void setTab('reviews');
});
const plansTabButton = useButtonActivation(() => {
  void setTab('plans');
});
const reviewsRetryButton = useButtonActivation(
  () => {
    void retryReviews();
  },
  () => reviewsLoading.value
);
const reviewsMoreButton = useButtonActivation(
  () => {
    void loadMoreReviews();
  },
  () => reviewsLoading.value
);
</script>
<style scoped>
.profile-page {
  box-sizing: border-box;
  max-width: 680px;
  margin: 0 auto;
  padding: 8px 20px 32px;
  background: #fff;
  color: #1f2937;
}
.profile-tools {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
}
.profile-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  margin: 0;
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: #fff;
  color: #475467;
  font-size: 14px;
  line-height: 1.5;
}
.profile-button::after {
  border: 0;
}
.profile-button:not(.profile-tab):active {
  background: #f4f4f5;
}
.profile-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.profile-button[disabled] {
  opacity: 0.5;
}
.profile-unread {
  position: absolute;
  right: -2px;
  top: 0;
  min-width: 16px;
  padding: 1px 3px;
  border-radius: 10px;
  background: #660874;
  color: #fff;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.profile-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 64px;
}
.profile-utilities {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  min-height: 44px;
  margin: 8px 0;
}
.profile-utility {
  justify-content: flex-start;
  padding: 8px 0;
  gap: 6px;
  font-size: 13px;
}
.profile-manage {
  margin-left: auto;
}
.profile-tab-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  border-bottom: 1px solid #e5e7eb;
}
.profile-tabs {
  display: flex;
  gap: 24px;
}
.profile-tab {
  position: relative;
  min-width: 44px;
  padding: 8px 0;
  border-radius: 0;
  color: #667085;
}
.profile-tab:active {
  opacity: 0.72;
}
.profile-tab-active {
  color: #660874;
  font-weight: 600;
}
.profile-tab-active::before {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: #660874;
  content: '';
}
.profile-content {
  min-height: 168px;
}
.profile-post-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-top: 12px;
}
.profile-retry,
.profile-more {
  color: #660874;
}
.profile-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 0;
  color: #b42318;
  font-size: 14px;
}
.profile-more {
  display: flex;
  margin: 16px auto 0;
}
@media (max-width: 340px) {
  .profile-page {
    padding-right: 16px;
    padding-left: 16px;
  }
  .profile-utilities {
    gap: 12px;
  }
}
</style>
