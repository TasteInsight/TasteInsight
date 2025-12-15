<template>
  <view class="review-list">
    <!-- 加载状态 -->
    <view v-if="loading && reviews.length === 0" class="text-center py-8 text-gray-500">
      加载中...
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
        <!-- 用户信息 -->
        <view class="flex items-start">
          <!-- 左侧头像 - 阻止冒泡 -->
          <img 
            :src="review.userAvatar || '/default-avatar.png'" 
            class="w-10 h-10 rounded-full mr-3 flex-shrink-0"
            @tap.stop
          />
          
          <!-- 右侧内容 -->
          <view class="flex-1">
            <!-- 昵称 - 阻止冒泡 -->
            <view class="font-bold text-purple-900 text-sm" @tap.stop>{{ review.userNickname }}</view>
            
            <!-- 星级评分 -->
            <view class="flex items-center mt-1">
              <text 
                v-for="star in 5" 
                :key="star"
                class="star-icon text-base"
                :class="star <= review.rating ? 'text-yellow-500' : 'text-gray-300'"
              >{{ star <= review.rating ? '★' : '☆' }}</text>
            </view>
            
            <!-- 评论内容 -->
            <view class="text-sm text-gray-700 leading-relaxed mt-2">{{ review.content }}</view>

            <!-- 评价图片 -->
            <view v-if="review.images && review.images.length > 0" class="flex flex-wrap gap-2 mt-2">
              <image 
                v-for="(img, idx) in review.images" 
                :key="idx" 
                :src="img" 
                class="w-20 h-20 rounded object-cover border border-gray-100"
                mode="aspectFill"
                @tap.stop="previewReviewImage(review.images, idx)"
              />
            </view>
            
            
            
            <!-- 时间 -->
            <view class="flex justify-between items-center mt-2">
              <view class="text-xs text-gray-400">{{ formatDate(review.createdAt) }}</view>
            </view>
          </view>
        </view>

        <!-- 评论列表 -->
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
        <view 
          v-if="hasMore && !loading"
          class="inline-block text-gray-500 text-sm font-medium hover:text-gray-700 cursor-pointer py-2 px-4"
          @tap.stop="loadMore"
        >
          加载更多 ↓
        </view>
        <view v-else-if="loading" class="text-gray-400 text-sm">
          加载中...
        </view>
        <view v-else class="text-gray-400 text-sm">
          没有更多评价了
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="text-center py-8 text-gray-400">
      <text class="iconfont icon-comment-outline text-4xl mb-2" ></text>
      <view class="text-sm">暂无评价，快来抢沙发吧~</view>
    </view>

    <!-- 错误状态 -->
    <view v-if="error" class="text-center py-4 text-red-500 text-sm">
      {{ error }}
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
import { ref } from 'vue';
import type { Review, Comment } from '@/types/api';
import dayjs from 'dayjs';
import CommentList from './CommentList.vue';
import LongPressMenu from './LongPressMenu.vue';
import { useUserStore } from '@/store/modules/use-user-store';

const userStore = useUserStore();

interface Props {
  dishId: string;
  reviews: Review[];
  loading: boolean;
  error: string;
  hasMore: boolean;
  reviewComments: Record<string, { items: Comment[], total: number, loading: boolean }>;
  fetchComments: (reviewId: string) => Promise<void>;
}

interface Emits {
  (e: 'viewAllComments', reviewId: string): void;
  (e: 'loadMore'): void;
  (e: 'report', reviewId: string): void;
  (e: 'delete', reviewId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 长按菜单状态
const menuVisible = ref(false);
const currentReview = ref<Review | null>(null);
const canDeleteCurrent = ref(false);

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
    current: urls[current]
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
  closeMenu();
  
  uni.showModal({
    title: '提示',
    content: '确定要删除这条评价吗？',
    success: (res) => {
      if (res.confirm) {
        emit('delete', reviewId);
      }
    }
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
.review-list {
  min-height: 200px;
}

.star-icon {
  display: inline-block;
  line-height: 1;
  margin-right: 2px;
}
</style>
