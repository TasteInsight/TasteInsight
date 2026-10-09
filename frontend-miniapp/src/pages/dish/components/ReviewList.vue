<template>
  <view class="review-list" :aria-busy="loading">
    <view v-if="error && reviews.length === 0" class="review-error">
      <text>{{ error }}</text
      ><button class="discussion-action review-action" @tap="emit('retry')">重试</button>
    </view>

    <!-- 评论列表 -->
    <view v-else-if="reviews.length > 0">
      <view
        v-for="review in reviews"
        :key="review.id"
        class="border-b border-gray-100 py-4 last:border-b-0 review-item"
        @tap="handleViewAllComments(review.id)"
        @longpress="(e: any) => handleLongPress(e, review)"
      >
        <view class="review-heading">
          <UserAvatar :src="review.userAvatar" :label="review.userNickname" @tap.stop />
          <text class="discussion-author review-name">{{ review.userNickname }}</text>
          <button
            class="discussion-action review-action"
            :aria-label="'管理 ' + review.userNickname + ' 的评价'"
            aria-haspopup="dialog"
            role="button"
            tabindex="0"
            @tap.stop="handleLongPress($event, review)"
            @keydown.enter.stop.prevent="handleLongPress($event, review)"
            @keydown.space.stop.prevent="handleLongPress($event, review)"
          >
            <image
              class="discussion-more-icon"
              src="/static/icons/more-horizontal.png"
              mode="aspectFit"
              aria-hidden="true"
            />
          </button>
        </view>

        <TasteProfile :taste="review.ratingDetails" collapsible class="review-rating">
          <template #summary>
            <view class="review-stars" :aria-label="'总体评分 ' + review.rating + ' 星'">
              <text
                v-for="star in 5"
                :key="star"
                class="star-icon text-base"
                :class="star <= review.rating ? 'text-yellow-500' : 'text-gray-300'"
                aria-hidden="true"
                >{{ star <= review.rating ? '★' : '☆' }}</text
              >
            </view>
          </template>
        </TasteProfile>

        <view class="discussion-body review-text">{{ review.content }}</view>

        <view v-if="visibleImages(review).length > 0" class="flex flex-wrap gap-2 mt-2">
          <image
            v-for="(img, idx) in visibleImages(review)"
            :key="img"
            :src="img"
            class="w-20 h-20 rounded object-cover border border-gray-100"
            mode="aspectFill"
            @error="failedImages.push(img)"
            @tap.stop="previewReviewImage(visibleImages(review), idx)"
          />
        </view>

        <view class="flex justify-between items-center mt-2">
          <view class="discussion-meta review-date">{{ formatDate(review.createdAt) }}</view>
          <button
            class="discussion-action review-action"
            @tap.stop="handleViewAllComments(review.id)"
          >
            回复
          </button>
        </view>

        <CommentList
          :review-id="review.id"
          :comments-data="reviewComments[review.id]"
          :fetch-comments="fetchComments"
          @comment-added="handleCommentAdded"
          @view-all-comments="handleViewAllComments(review.id)"
        />
      </view>

      <!-- 加载更多 -->
      <view class="text-center py-4">
        <view v-if="error" class="review-error"
          ><text>{{ error }}</text
          ><button class="discussion-action review-action" @tap="emit('retry')">重试</button></view
        >
        <button
          v-else-if="hasMore && !loading"
          class="discussion-action review-action review-load-more"
          @tap.stop="loadMore"
        >
          加载更多 ↓
        </button>
        <view v-else-if="loading" class="text-gray-400 text-sm"> 加载中... </view>
        <view v-else class="text-gray-400 text-sm"> 没有更多评价了 </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="initialized && !loading" class="text-center py-8 text-gray-400">
      <text class="iconfont icon-comment-outline text-4xl mb-2"></text>
      <view class="text-sm">暂无评价，快来抢沙发吧~</view>
    </view>

    <!-- 长按菜单 -->
    <LongPressMenu
      :visible="menuVisible"
      :can-delete="canDeleteCurrent"
      @close="closeMenu"
      @delete="confirmDelete"
      @report="handleReportFromMenu"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import type { Review, Comment } from '@/types/api';
import dayjs from 'dayjs';
import CommentList from './CommentList.vue';
import LongPressMenu from './LongPressMenu.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import TasteProfile from './TasteProfile.vue';
import { useUserStore } from '@/store/modules/use-user-store';

const userStore = useUserStore();

interface Props {
  dishId: string;
  reviews: Review[];
  loading: boolean;
  initialized?: boolean;
  error: string;
  hasMore: boolean;
  reviewComments: Record<string, { items: Comment[]; total: number; loading: boolean }>;
  fetchComments: (reviewId: string) => Promise<void>;
}

interface Emits {
  (e: 'viewAllComments', reviewId: string): void;
  (e: 'loadMore'): void;
  (e: 'retry'): void;
  (e: 'report', reviewId: string): void;
  (e: 'delete', reviewId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 长按菜单状态
const menuVisible = ref(false);
const currentReview = ref<Review | null>(null);
const canDeleteCurrent = ref(false);
let active = true;
onUnmounted(() => {
  active = false;
});
const failedImages = ref<string[]>([]);
const visibleImages = (review: Review) =>
  (review.images || []).filter(image => !failedImages.value.includes(image));

const loadMore = () => {
  if (props.hasMore && !props.loading) {
    emit('loadMore');
  }
};

const formatDate = (dateString: string) => {
  return dayjs(dateString).format('YYYY-MM-DD HH:mm');
};

const previewReviewImage = (urls: string[], current: number) => {
  uni.previewImage({
    urls,
    current: urls[current],
  });
};

const handleCommentAdded = () => {
  console.log('评论添加成功');
};

const handleViewAllComments = (reviewId: string) => {
  if (!menuVisible.value) {
    emit('viewAllComments', reviewId);
  }
};

// 长按处理
const handleLongPress = (_e: any, review: Review) => {
  currentReview.value = review;
  canDeleteCurrent.value = userStore.userInfo?.id === review.userId;
  menuVisible.value = true;
};

const closeMenu = () => {
  menuVisible.value = false;
  currentReview.value = null;
};

const confirmDelete = () => {
  if (!currentReview.value || !canDeleteCurrent.value) {
    closeMenu();
    return;
  }

  const reviewId = currentReview.value.id;
  const session = userStore.sessionVersion;
  const owner = userStore.userInfo?.id;
  closeMenu();

  uni.showModal({
    title: '提示',
    content: '确定要删除这条评价吗？',
    success: res => {
      if (
        res.confirm &&
        active &&
        session === userStore.sessionVersion &&
        owner === userStore.userInfo?.id
      ) {
        emit('delete', reviewId);
      }
    },
  });
};

const handleReportFromMenu = () => {
  if (!currentReview.value) {
    closeMenu();
    return;
  }

  const reviewId = currentReview.value.id;
  closeMenu();
  emit('report', reviewId);
};
</script>

<style scoped>
@import './discussion.css';
.review-list {
  min-height: 200px;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
}

.star-icon {
  display: inline-block;
  line-height: 1;
  margin-right: 2px;
}
.review-stars {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.review-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.review-name {
  flex: 1;
  min-width: 0;
}
.review-load-more {
  margin: 0 auto;
}
.review-text {
  margin-top: 12px;
}
.review-rating {
  margin-top: 4px;
}
.review-error {
  padding: 16px 0;
  color: #b42318;
  font-size: 14px;
  text-align: center;
}
</style>
