<template>
  <view class="recommendation-card" @click="goToDishDetail(recommendation.dish.id)">
    <view class="flex">
      <image :src="recommendation.dish.images?.[0]" class="dish-image" mode="aspectFill" />
      <view class="flex-grow ml-3">
        <view class="dish-name">{{ localizedDishName(recommendation.dish) }}</view>
        <view class="dish-location"
          >{{ recommendation.dish.canteenName }} {{ recommendation.dish.windowName }}</view
        >
        <view class="flex items-center mt-1">
          <text class="rating-icon">★</text>
          <text class="rating-text">{{
            recommendation.dish.averageRating === 0
              ? t('social.notAvailable')
              : recommendation.dish.averageRating.toFixed(1)
          }}</text>
        </view>
        <view class="ai-reason">
          <text class="text-xs text-gray-500">{{ t('social.recommendationReason') }} </text>
          <text class="text-xs text-primary">{{ recommendation.reason }}</text>
        </view>
      </view>
    </view>

    <!-- 反馈按钮 -->
    <view class="feedback-actions">
      <button class="feedback-btn like" @click.stop="submitFeedback('like')">
        <text class="iconfont icon-thumb-up-outline"></text> {{ t('social.liked') }}
      </button>
      <button class="feedback-btn dislike" @click.stop="submitFeedback('dislike')">
        <text class="iconfont icon-thumb-down-outline"></text> {{ t('social.disliked') }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { localizedDishName } from '@/utils/dish-localization';
import { t } from '@/i18n';
import { useChatStore } from '@/store/modules/use-chat-store';
import type { RecommendationItem } from '@/types/api';

const props = defineProps<{
  recommendation: RecommendationItem;
}>();

const chatStore = useChatStore();

const goToDishDetail = (id: string) => {
  uni.navigateTo({
    url: `/pages/dish/index?id=${id}`,
  });
};

const submitFeedback = (feedback: 'like' | 'dislike') => {
  chatStore.submitFeedback({
    dishId: props.recommendation.dish.id,
    feedback: feedback,
  });
};
</script>

<style scoped>
.recommendation-card {
  background: white;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
}

.dish-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  flex-shrink: 0;
}

.dish-name {
  font-weight: 500;
  font-size: 16px;
}

.dish-location {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}

.rating-icon,
.rating-text {
  color: #ffa726; /* text-rating */
  font-size: 14px;
  margin-right: 4px;
}

.ai-reason {
  margin-top: 6px;
  font-size: 12px;
}

.ai-reason .text-primary {
  color: #82318e;
}

.feedback-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}

.feedback-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 15px;
  margin-left: 8px;
  background: #f5f5f5;
  color: #666;
  border: none;
}
</style>
