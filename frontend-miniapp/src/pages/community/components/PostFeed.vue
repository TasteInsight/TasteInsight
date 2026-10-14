<template>
  <view class="campus-page" :aria-busy="loading">
    <view class="campus-heading">
      <view class="campus-tabs" role="tablist" aria-label="动态范围"
        ><button
          class="campus-button campus-tab"
          :class="{ 'campus-selected': !mine }"
          role="tab"
          tabindex="0"
          :aria-selected="!mine"
          @click="latestAction.activate"
          @keydown="latestAction.handleKeydown"
          @keyup="latestAction.handleKeyup"
          @blur="latestAction.clearPress"
        >
          最新</button
        ><button
          class="campus-button campus-tab"
          :class="{ 'campus-selected': mine }"
          role="tab"
          tabindex="0"
          :aria-selected="mine"
          @click="mineAction.activate"
          @keydown="mineAction.handleKeydown"
          @keyup="mineAction.handleKeyup"
          @blur="mineAction.clearPress"
        >
          我的
        </button></view
      >
      <IconButton name="edit" label="发动态" title="发动态" @click="compose" />
    </view>
    <template v-if="loading && !posts.length"
      ><view v-for="item in 3" :key="item" class="campus-skeleton" aria-hidden="true"
        ><view class="campus-skeleton-line" /><view class="campus-skeleton-line" /><view
          class="campus-skeleton-line" /></view
    ></template>
    <EmptyState
      v-else-if="initialized && !posts.length && !error"
      :title="mine ? '还没有发布动态' : '还没有校园动态'"
      icon="chat"
    />
    <PostCard v-for="post in posts" :key="post.id" :post="post" />
    <view v-if="error" class="campus-error error-feedback" role="alert"
      ><text class="error-feedback__message">{{ error }}</text
      ><button
        class="error-feedback__action"
        hover-class="error-feedback__action--pressed"
        @click="retry"
      >
        重新加载
      </button></view
    >
    <button
      v-else-if="hasMore && posts.length"
      class="campus-button campus-more"
      :disabled="loading"
      @click="load(true)"
    >
      {{ loading ? '加载中…' : '加载更多' }}
    </button>
  </view>
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';
import { usePostFeed } from '../composables/use-post-feed';
import PostCard from './PostCard.vue';
import IconButton from '@/components/IconButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useButtonActivation } from '@/composables/use-button-activation';
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });
const user = useUserStore();
const mine = ref(false);
const latestAction = useButtonActivation(() => switchFeed(false));
const mineAction = useButtonActivation(() => switchFeed(true));

const { posts, loading, initialized, error, hasMore, load, retry, reset, invalidate } = usePostFeed(
  () => ({ mine: mine.value })
);
function switchFeed(value: boolean) {
  if (value && !user.isLoggedIn) {
    uni.navigateTo({ url: '/pages/login/index' });
    return;
  }
  if (mine.value === value) return;
  mine.value = value;
  reset();
  void load();
}
function compose() {
  if (requireStudent()) uni.navigateTo({ url: '/pages/community/editor' });
}
watch(
  () => user.sessionVersion,
  session => {
    mine.value = false;
    void nextTick(() => {
      if (props.active && session === user.sessionVersion) void load();
    });
  },
  { flush: 'sync' }
);
watch(
  () => props.active,
  active => {
    if (active) void load();
    else invalidate();
  },
  { immediate: true, flush: 'sync' }
);
defineExpose({
  refresh: () => load(),
  loadMore: () => {
    if (!error.value) return load(true);
  },
});
</script>
<style scoped>
@import '../community.css';
.campus-page {
  padding-top: 4px;
}
.campus-heading {
  margin-bottom: 4px;
}
.campus-tabs {
  border-bottom: 0;
  gap: 20px;
}
.campus-tab {
  min-height: 44px;
  padding: 0;
  font-size: 14px;
  line-height: 44px;
}
</style>
