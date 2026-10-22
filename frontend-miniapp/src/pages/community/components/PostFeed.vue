<template>
  <view class="campus-page page-state-content" :aria-busy="loading">
    <view class="campus-heading">
      <view class="campus-tabs" role="tablist" :aria-label="t('social.postScope')"
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
          {{ t('social.latest') }}</button
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
          {{ t('social.mine') }}
        </button></view
      >
      <IconButton
        name="edit"
        :label="t('social.createPost')"
        :title="t('social.createPost')"
        @click="compose"
      />
    </view>
    <LoginGate :required="mine" :title="t('social.myPostsLogin')" icon="chat">
      <AsyncState
        :loading="loading"
        :initialized="initialized"
        :has-content="posts.length > 0"
        :error="error"
        :loading-title="t('social.loadingPosts')"
        :empty-title="mine ? t('social.noOwnPosts') : t('social.noCampusPosts')"
        empty-icon="chat"
        @retry="retry"
      />
      <PostCard v-for="post in posts" :key="post.id" :post="post" />
      <button
        v-if="!error && hasMore && posts.length"
        class="campus-button campus-more"
        :disabled="loading"
        @click="load(true)"
      >
        {{ loading ? t('social.loadingMore') : t('social.loadMore') }}
      </button>
    </LoginGate>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed, ref, watch } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';
import { usePostFeed } from '../composables/use-post-feed';
import PostCard from './PostCard.vue';
import IconButton from '@/components/IconButton.vue';
import AsyncState from '@/components/AsyncState.vue';
import LoginGate from '@/components/LoginGate.vue';
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
  if (mine.value === value) return;
  mine.value = value;
  reset();
  if (props.active) void load();
}
function compose() {
  if (requireStudent()) uni.navigateTo({ url: '/pages/community/editor' });
}
function loadInitial() {
  if (props.active && !initialized.value && !loading.value) void load();
}
watch(() => [user.sessionVersion, user.isLoggedIn], loadInitial, { flush: 'post' });
watch(
  () => props.active,
  active => {
    if (active) loadInitial();
    else invalidate();
  },
  { immediate: true, flush: 'sync' }
);
defineExpose({
  needsInitialLoad: computed(() => !initialized.value),
  refresh: () => {
    if (props.active && !loading.value) return load();
  },
  loadMore: () => {
    if (props.active && !error.value) return load(true);
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
