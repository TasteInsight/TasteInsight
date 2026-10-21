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
    <view v-if="visited.posts" v-show="section === 'posts'" class="campus-panel page-state-content">
      <PostFeed ref="postsPanel" :active="visible && section === 'posts'" />
    </view>
    <view
      v-if="visited.dining"
      v-show="section === 'dining'"
      class="campus-panel page-state-content"
    >
      <DiningInvites ref="diningPanel" :active="visible && section === 'dining'" />
    </view>
    <view v-if="visited.news" v-show="section === 'news'" class="campus-panel page-state-content">
      <NewsFeed ref="newsPanel" :active="visible && section === 'news'" />
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { onShow, onHide, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import PostFeed from './components/PostFeed.vue';
import DiningInvites from '../planning/components/DiningInvites.vue';
import NewsFeed from '../news/components/NewsFeed.vue';
import { takeCampusSection, type CampusSection } from '@/utils/campus-navigation';
import { useButtonActivation } from '@/composables/use-button-activation';

const section = ref<CampusSection>('posts');
const visible = ref(false);
const visited = reactive<Record<CampusSection, boolean>>({
  posts: true,
  dining: false,
  news: false,
});
type CampusPanel = {
  needsInitialLoad: boolean;
  refresh: () => unknown;
  loadMore: () => unknown;
};
const postsPanel = ref<CampusPanel | null>(null);
const diningPanel = ref<CampusPanel | null>(null);
const newsPanel = ref<CampusPanel | null>(null);
const panel = computed(
  () =>
    ({ posts: postsPanel.value, dining: diningPanel.value, news: newsPanel.value })[section.value]
);
const scrollPositions: Record<CampusSection, number> = { posts: 0, dining: 0, news: 0 };
const dirtySections = new Set<CampusSection>();
let scrollTop = 0;
let activationVersion = 0;
async function refreshCurrentSection() {
  if (!dirtySections.has(section.value)) return;
  const target = section.value;
  const activation = activationVersion;
  const needsInitialLoad = panel.value?.needsInitialLoad;
  await nextTick();
  if (!visible.value || activation !== activationVersion) return;
  if (!needsInitialLoad) await panel.value?.refresh();
  if (visible.value && activation === activationVersion) dirtySections.delete(target);
}
function selectSection(value: CampusSection) {
  if (section.value === value) return;
  activationVersion += 1;
  scrollPositions[section.value] = scrollTop;
  section.value = value;
  visited[value] = true;
  void nextTick(() => {
    if (!visible.value || section.value !== value) return;
    scrollTop = scrollPositions[value];
    uni.pageScrollTo({ scrollTop, duration: 0 });
  });
  void refreshCurrentSection();
}
const sections = (
  [
    { key: 'posts', label: '动态' },
    { key: 'dining', label: '约饭' },
    { key: 'news', label: '资讯' },
  ] as { key: CampusSection; label: string }[]
).map(item => ({
  ...item,
  ...useButtonActivation(() => selectSection(item.key)),
}));
onShow(() => {
  const requested = takeCampusSection();
  const switchingSection = requested && requested !== section.value;
  if (requested) selectSection(requested);
  visible.value = true;
  if (!switchingSection) void refreshCurrentSection();
});
onHide(() => {
  visible.value = false;
  activationVersion += 1;
  sections.forEach(item => {
    if (visited[item.key]) dirtySections.add(item.key);
  });
});
onPageScroll(event => {
  if (visible.value) scrollTop = event.scrollTop;
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
  width: 100%;
  max-width: var(--page-content-width);
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
