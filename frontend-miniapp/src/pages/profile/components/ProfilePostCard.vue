<template>
  <button
    class="profile-post-card"
    :class="{ 'profile-post-card--text': !cover, 'list-row-action': !cover }"
    hover-class="list-row-pressed"
    role="button"
    tabindex="0"
    :aria-label="'查看动态：' + post.content"
    @click="activate"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
    @blur="clearPress"
  >
    <view v-if="cover" class="profile-post-cover">
      <image :key="cover" :src="cover" mode="aspectFill" @error="failedImages.add(cover)" />
    </view>
    <view class="profile-post-copy">
      <text class="profile-post-excerpt">{{ post.content }}</text>
      <text v-if="post.status === 'rejected'" class="profile-post-note">{{
        post.rejectReason || '未通过审核，可在动态详情中修改。'
      }}</text>
      <view class="profile-post-meta">
        <text>{{ date }}</text>
        <view v-if="post.likeCount || post.commentCount" class="profile-post-stats">
          <text v-if="post.likeCount">{{ post.likeCount }} 赞</text>
          <text v-if="post.commentCount">{{ post.commentCount }} 回复</text>
        </view>
      </view>
    </view>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import dayjs from 'dayjs';
import type { Post } from '@/api/modules/social';
import { useButtonActivation } from '@/composables/use-button-activation';

const props = defineProps<{ post: Post }>();
const failedImages = ref(new Set<string>());
const cover = computed(() => props.post.images.find(image => !failedImages.value.has(image)) || '');
const date = computed(() => {
  const created = dayjs(props.post.createdAt);
  return created.format(created.year() === dayjs().year() ? 'MM-DD' : 'YYYY-MM-DD');
});
watch(
  () => [props.post.id, props.post.images],
  () => {
    failedImages.value = new Set();
  }
);
const { activate, handleKeydown, handleKeyup, clearPress } = useButtonActivation(() =>
  uni.navigateTo({ url: '/pages/community/detail?id=' + encodeURIComponent(props.post.id) })
);
</script>

<style scoped>
.profile-post-card {
  display: block;
  box-sizing: border-box;
  align-self: start;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid #eaecf0;
  border-radius: 12px;
  background: #fff;
  color: #1f2937;
  font-family: inherit;
  text-align: left;
  line-height: 1.6;
}
.profile-post-card::after {
  border: 0;
}
.profile-post-card:not(.profile-post-card--text):focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.profile-post-card:not(.profile-post-card--text):active,
.profile-post-card.list-row-pressed:not(.profile-post-card--text) {
  background: #f7f8fa;
}
.profile-post-cover {
  position: relative;
  height: 0;
  padding-top: 75%;
  background: #f4f4f5;
}
.profile-post-cover image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.profile-post-copy {
  padding: 10px 12px 12px;
}
.profile-post-excerpt {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.profile-post-meta,
.profile-post-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.profile-post-note {
  display: block;
  margin-top: 6px;
  color: #b42318;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.profile-post-meta {
  justify-content: space-between;
  margin-top: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}
.profile-post-card--text {
  grid-column: 1 / -1;
  border-width: 0 0 1px;
  border-radius: 0;
}
.profile-post-card--text .profile-post-copy {
  padding: 12px 0 14px;
}
.profile-post-card--text .profile-post-excerpt {
  -webkit-line-clamp: 3;
  font-size: 15px;
}
@media (hover: hover) {
  .profile-post-card:not(.profile-post-card--text):hover {
    background: #f7f8fa;
  }
}
</style>
