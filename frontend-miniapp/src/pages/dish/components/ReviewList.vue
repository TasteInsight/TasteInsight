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
            
            <!-- 时间 -->
            <view class="text-xs text-gray-400 mt-2">{{ formatDate(review.createdAt) }}</view>
          </view>
        </view>

        <!-- 评论列表 -->
        <CommentList
          :review-id="review.id"
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
      <text class="iconify text-4xl mb-2" data-icon="mdi:comment-outline"></text>
      <view class="text-sm">暂无评价，快来抢沙发吧~</view>
    </view>

    <!-- 错误状态 -->
    <view v-if="error" class="text-center py-4 text-red-500 text-sm">
      {{ error }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Review } from '@/types/api';
import dayjs from 'dayjs';
import CommentList from './CommentList.vue';

interface Props {
  dishId: string;
  reviews: Review[];
  loading: boolean;
  error: string;
  hasMore: boolean;
}

interface Emits {
  (e: 'viewAllComments', reviewId: string): void;
  (e: 'loadMore'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loadMore = () => {
  if (props.hasMore && !props.loading) {
    emit('loadMore');
  }
};

const formatDate = (dateString: string) => {
  return dayjs(dateString).format('YYYY-MM-DD HH:mm');
};

const handleCommentAdded = () => {
  // 评论添加成功后可以做一些处理，比如显示提示
  console.log('评论添加成功');
};

const handleViewAllComments = (reviewId: string) => {
  emit('viewAllComments', reviewId);
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
