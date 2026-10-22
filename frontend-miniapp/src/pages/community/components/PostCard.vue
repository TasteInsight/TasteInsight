<template>
  <view class="post-item">
    <view class="post-heading">
      <button
        class="campus-button post-author"
        role="button"
        tabindex="0"
        :aria-label="t('social.profileLabel', { name: post.userNickname })"
        @click="profileButton.activate"
        @keydown="profileButton.handleKeydown"
        @keyup="profileButton.handleKeyup"
        @blur="profileButton.clearPress"
      >
        <UserAvatar :src="post.userAvatar" :label="post.userNickname" />
        <view class="post-author-text"
          ><text class="post-name">{{ post.userNickname }}</text
          ><text class="campus-hint post-date">{{ formatDate(post.createdAt) }}</text></view
        >
      </button>
      <button
        v-if="detail"
        class="campus-button post-menu"
        role="button"
        tabindex="0"
        :aria-label="t('social.managePost')"
        @click="manageButton.activate"
        @keydown="manageButton.handleKeydown"
        @keyup="manageButton.handleKeyup"
        @blur="manageButton.clearPress"
      >
        <image src="/static/icons/more-horizontal.png" class="post-more-icon" mode="aspectFit" />
      </button>
    </view>
    <text v-if="detail" class="post-content" selectable>{{ post.content }}</text>
    <button
      v-else
      class="campus-button post-content post-content-link list-row-action"
      hover-class="list-row-pressed"
      role="button"
      tabindex="0"
      :aria-label="t('social.viewPostDetails')"
      @click="detailButton.activate"
      @keydown="detailButton.handleKeydown"
      @keyup="detailButton.handleKeyup"
      @blur="detailButton.clearPress"
    >
      {{ post.content }}
    </button>
    <view
      v-if="post.images.length"
      class="post-images"
      :class="{ 'post-images-single': post.images.length === 1 }"
    >
      <button
        v-for="(url, index) in post.images"
        :key="url"
        class="post-image-button"
        role="button"
        tabindex="0"
        :aria-label="t('social.previewPhoto', { number: index + 1 })"
        @click="imageButtons[index].activate"
        @keydown="imageButtons[index].handleKeydown"
        @keyup="imageButtons[index].handleKeyup"
        @blur="imageButtons[index].clearPress"
      >
        <image :src="url" class="post-image" mode="aspectFill" />
      </button>
    </view>
    <view class="post-actions">
      <button
        v-if="post.status === 'approved'"
        class="campus-button post-action"
        role="button"
        :tabindex="pending[post.id] ? -1 : 0"
        :class="{ 'post-liked': isLiked(post) }"
        :aria-label="isLiked(post) ? t('social.unlike') : t('social.likePost')"
        :aria-pressed="isLiked(post)"
        :disabled="!!pending[post.id]"
        @click="likeButton.activate"
        @keydown="likeButton.handleKeydown"
        @keyup="likeButton.handleKeyup"
        @blur="likeButton.clearPress"
      >
        <text class="iconfont icon-heart-outline" aria-hidden="true" /><text>{{
          likeCount(post) || t('social.like')
        }}</text>
      </button>
      <button
        class="campus-button post-action"
        role="button"
        tabindex="0"
        :aria-label="t('social.viewPostReplies')"
        @click="replyButton.activate"
        @keydown="replyButton.handleKeydown"
        @keyup="replyButton.handleKeyup"
        @blur="replyButton.clearPress"
      >
        <text class="iconfont icon-comment-outline" aria-hidden="true" /><text>{{
          post.commentCount || t('social.reply')
        }}</text>
      </button>
    </view>
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import dayjs from 'dayjs';
import { computed } from 'vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { setPostLike, type Post } from '@/api/modules/social';
import { useContentLike } from '@/pages/dish/composables/use-content-like';
import { useButtonActivation } from '@/composables/use-button-activation';
const props = withDefaults(defineProps<{ post: Post; detail?: boolean }>(), { detail: false });
const emit = defineEmits<{ (event: 'manage'): void; (event: 'reply'): void }>();
const { pending, isLiked, likeCount, toggleLike } = useContentLike(() => [props.post], setPostLike);
const formatDate = (date: string) => dayjs(date).format('MM-DD HH:mm');
const openProfile = () =>
  uni.navigateTo({ url: `/pages/profile/public?id=${encodeURIComponent(props.post.userId)}` });
const openDetail = () =>
  uni.navigateTo({ url: `/pages/community/detail?id=${encodeURIComponent(props.post.id)}` });
const preview = (index: number) =>
  uni.previewImage({ urls: props.post.images, current: props.post.images[index] });
const profileButton = useButtonActivation(openProfile);
const manageButton = useButtonActivation(() => emit('manage'));
const detailButton = useButtonActivation(openDetail);
const replyButton = useButtonActivation(() => (props.detail ? emit('reply') : openDetail()));
const likeButton = useButtonActivation(
  () => {
    void toggleLike(props.post);
  },
  () => !!pending.value[props.post.id]
);
const imageButtons = computed(() =>
  props.post.images.map((_, index) => useButtonActivation(() => preview(index)))
);
</script>
<style scoped>
@import '../community.css';
.post-item {
  padding: 24px 0 12px;
  border-bottom: 1px solid #e5e7eb;
}
.post-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.post-author {
  justify-content: flex-start;
  gap: 12px;
  min-width: 0;
  padding: 0;
  color: #1f2937;
  text-align: left;
}
.post-author-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.post-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.post-date {
  font-size: 12px;
}
.post-menu {
  padding: 0;
  width: 44px;
  flex-shrink: 0;
}
.post-more-icon {
  width: 20px;
  height: 20px;
}
.post-content {
  display: block;
  margin-top: 16px;
  padding-block: 0;
  color: #1f2937;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.8;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.post-content-link {
  width: 100%;
  border-radius: 0;
}
.post-images {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 16px;
}
.post-image-button {
  position: relative;
  width: 100%;
  height: 0;
  margin: 0;
  padding: 0 0 100%;
  border-radius: 8px;
  background: #f4f4f5;
  overflow: hidden;
}
.post-image-button::after {
  border: 0;
}
.post-image-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.post-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.post-images-single {
  max-width: 420px;
  grid-template-columns: 1fr;
}
.post-images-single .post-image-button {
  padding-bottom: 70%;
}
.post-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  margin-top: 8px;
}
.post-action {
  min-width: 60px;
  padding: 8px 0;
  color: #667085;
  font-size: 14px;
}
.post-action .iconfont {
  font-size: 20px;
}
.post-liked {
  color: #660874;
}
</style>
