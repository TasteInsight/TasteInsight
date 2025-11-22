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
        class="border-b border-purple-50 py-5 last:border-b-0"
      >
        <!-- 用户信息 -->
        <view class="flex items-center mb-3">
          <img 
            :src="review.userAvatar || '/default-avatar.png'" 
            class="w-12 h-12 rounded-full mr-3 border-2 border-purple-100"
          />
          <view class="flex-1">
            <view class="font-semibold text-gray-800">{{ review.userNickname }}</view>
            <view class="text-xs text-gray-400 mt-1">{{ formatDate(review.createdAt) }}</view>
          </view>
          <view class="flex items-center bg-purple-50 px-3 py-1 rounded-full">
            <text 
              v-for="star in 5" 
              :key="star"
              class="iconify text-sm"
              :class="star <= review.rating ? 'text-yellow-400' : 'text-gray-300'"
              data-icon="mdi:star"
            ></text>
          </view>
        </view>

        <!-- 评论内容 -->
        <view class="text-sm text-gray-700 leading-relaxed mb-2">{{ review.content }}</view>

        <!-- 评论列表 -->
        <CommentList 
          :review-id="review.id"
          @comment-added="handleCommentAdded"
        />
      </view>

      <!-- 加载更多 -->
      <view class="text-center py-4">
        <button 
          v-if="hasMore && !loading"
          class="text-purple-600 text-sm font-medium hover:text-purple-700"
          @click="loadMore"
        >
          加载更多 ↓
        </button>
        <view v-else-if="loading" class="text-purple-400 text-sm">
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
import { ref, onMounted } from 'vue';
import { getReviewsByDish } from '@/api/modules/review';
import type { Review } from '@/types/api';
import dayjs from 'dayjs';
import CommentList from './CommentList.vue';

interface Props {
  dishId: string;
}

const props = defineProps<Props>();

const reviews = ref<Review[]>([]);
const loading = ref(false);
const error = ref('');
const hasMore = ref(true);
const currentPage = ref(1);
const pageSize = 10;

onMounted(() => {
  fetchReviews();
});

const fetchReviews = async () => {
  if (loading.value) return;

  loading.value = true;
  error.value = '';

  try {
    const response = await getReviewsByDish(props.dishId, {
      page: currentPage.value,
      pageSize,
    });

    if (response.code === 200 && response.data) {
      const newReviews = response.data.items || [];
      
      if (currentPage.value === 1) {
        reviews.value = newReviews;
      } else {
        reviews.value = [...reviews.value, ...newReviews];
      }

      // 判断是否还有更多数据
      hasMore.value = newReviews.length === pageSize;
    } else {
      error.value = response.message || '获取评价失败';
    }
  } catch (err: any) {
    console.error('获取评价失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    loading.value = false;
  }
};

const loadMore = () => {
  if (hasMore.value && !loading.value) {
    currentPage.value++;
    fetchReviews();
  }
};

const formatDate = (dateString: string) => {
  return dayjs(dateString).format('YYYY-MM-DD HH:mm');
};

const handleCommentAdded = () => {
  // 评论添加成功后可以做一些处理，比如显示提示
  console.log('评论添加成功');
};
</script>

<style scoped>
.review-list {
  min-height: 200px;
}
</style>
