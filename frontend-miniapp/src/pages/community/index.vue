<template>
  <view class="campus-hub page-content page-state-layout">
    <view class="campus-sections" role="tablist" aria-label="校园内容">
      <button
        v-for="item in sections"
        :key="item.key"
        class="campus-section"
        :class="{ 'campus-section--active': section === item.key }"
        role="tab"
        tabindex="0"
        :aria-selected="section === item.key"
        @click="item.activate"
        @keydown="item.handleKeydown"
        @keyup="item.handleKeyup"
        @blur="item.clearPress"
      >
        {{ item.label }}
      </button>
    </view>
    <view :key="section" class="campus-panel page-state-content">
      <PostFeed v-if="section === 'posts'" ref="panel" :active="visible" />
      <DiningInvites v-else-if="section === 'dining'" ref="panel" :active="visible" />
      <NewsFeed v-else ref="panel" />
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import PostFeed from './components/PostFeed.vue';
import DiningInvites from '../planning/components/DiningInvites.vue';
import NewsFeed from '../news/components/NewsFeed.vue';
import { takeCampusSection, type CampusSection } from '@/utils/campus-navigation';
import { useButtonActivation } from '@/composables/use-button-activation';

const section = ref<CampusSection>('posts');
const visible = ref(false);
const panel = ref<{ refresh: () => unknown; loadMore: () => unknown } | null>(null);
const sections = (
  [
    { key: 'posts', label: '动态' },
    { key: 'dining', label: '约饭' },
    { key: 'news', label: '资讯' },
  ] as { key: CampusSection; label: string }[]
).map(item => ({
  ...item,
  ...useButtonActivation(() => {
    section.value = item.key;
  }),
}));
onShow(() => {
  const requested = takeCampusSection();
  if (requested) section.value = requested;
  visible.value = true;
});
onHide(() => {
  visible.value = false;
});
onReachBottom(() => {
  void panel.value?.loadMore();
});
onPullDownRefresh(async () => {
  try {
    await panel.value?.refresh();
  } finally {
    uni.stopPullDownRefresh();
  }
});
</script>
<style scoped>
.campus-hub {
  background: #fff;
}
.campus-sections {
  width: 100%;
  position: sticky;
  top: var(--window-top, 0px);
  z-index: 2;
  display: flex;
  gap: 24px;
  padding: 0 20px;
  max-width: 720px;
  box-sizing: border-box;
  margin: 0 auto;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.campus-section {
  position: relative;
  min-height: 44px;
  margin: 0;
  padding: 0 4px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #667085;
  font-size: 15px;
  line-height: 44px;
}
.campus-section::after {
  border: 0;
}
.campus-section--active {
  color: #660874;
  font-weight: 600;
}
.campus-section--active::before {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 0;
  height: 2px;
  background: #660874;
}
.campus-section:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -3px;
}
.campus-section:active {
  opacity: 0.72;
}
.campus-panel {
  animation: campus-enter 160ms ease-out;
}
@keyframes campus-enter {
  from {
    opacity: 0.65;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .campus-panel {
    animation: none;
  }
}
</style>
