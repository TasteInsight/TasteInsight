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
        class="border-b border-gray-100 py-4 last:border-b-0"
      >
        <!-- 用户信息 -->
        <view class="flex items-start">
          <!-- 左侧头像 -->
          <img 
            :src="review.userAvatar || '/default-avatar.png'" 
            class="w-10 h-10 rounded-full mr-3 flex-shrink-0"
          />
          
          <!-- 右侧内容 -->
          <view class="flex-1">
            <!-- 昵称 -->
            <view class="font-medium text-red-600 text-sm">{{ review.userNickname }}</view>
            
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
        <button 
          v-if="hasMore && !loading"
          class="text-red-600 text-sm font-medium hover:text-red-700"
          @click="loadMore"
        >
          加载更多 ↓
        </button>
        <view v-else-if="loading" class="text-red-400 text-sm">
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

interface Emits {
  (e: 'viewAllComments', reviewId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

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
