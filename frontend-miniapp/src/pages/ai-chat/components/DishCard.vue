<template>
  <view
    class="dish-recommendation"
    role="button"
    tabindex="0"
    :aria-label="`查看菜品：${dish.dish.name}`"
    @click="goToDishDetail"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
    @blur="pressed = false"
  >
    <view class="dish-recommendation-main">
      <view class="dish-recommendation-info">
        <view class="dish-recommendation-heading"
          ><text class="dish-recommendation-name">{{ dish.dish.name }}</text
          ><view
            class="dish-recommendation-rating"
            :class="{ 'dish-recommendation-rating-rated': numericRating > 0 }"
            ><image
              v-if="numericRating > 0"
              class="dish-rating-star"
              src="/static/icons/star.png"
              aria-hidden="true"
            /><text>{{ formattedRating }}</text></view
          ></view
        >
        <text class="dish-recommendation-location">{{
          [dish.canteenName, dish.windowName].filter(Boolean).join(' · ')
        }}</text>
        <view v-if="dish.dish.tags?.length" class="dish-recommendation-tags"
          ><TagBadge v-for="tag in dish.dish.tags" :key="tag" :label="tag"
        /></view>
      </view>
      <image
        v-if="dish.dish.image && failedImage !== dish.dish.image"
        :src="dish.dish.image"
        class="dish-recommendation-image"
        mode="aspectFill"
        @error="failedImage = dish.dish.image"
      />
    </view>
    <text v-if="dish.recommendReason" class="dish-recommendation-reason">{{
      dish.recommendReason
    }}</text>
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import TagBadge from '@/components/TagBadge.vue';
import type { ComponentDishCard } from '@/types/api';
const props = defineProps<{ dish: ComponentDishCard }>();
const failedImage = ref('');
const pressed = ref(false);
const numericRating = computed(() => {
  const rating = Number.parseFloat(props.dish.dish.rating);
  return Number.isFinite(rating) && rating > 0 ? rating : 0;
});
const formattedRating = computed(() =>
  numericRating.value > 0 ? numericRating.value.toFixed(1) : '暂无评分'
);
const goToDishDetail = () => {
  if (props.dish.dish.id) uni.navigateTo({ url: `/pages/dish/index?id=${props.dish.dish.id}` });
};
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    pressed.value = true;
  }
};
const handleKeyup = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (pressed.value) {
    pressed.value = false;
    goToDishDetail();
  }
};
</script>
<style scoped>
.dish-recommendation {
  box-sizing: border-box;
  width: 100%;
  padding: 16px 14px;
  margin-bottom: 0;
  background: #fff;
  cursor: pointer;
  overflow-wrap: anywhere;
  transition: background-color 140ms ease-out;
}
.dish-recommendation-main {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.dish-recommendation-image {
  flex-shrink: 0;
  width: 84px;
  height: 84px;
  border-radius: 10px;
}
.dish-recommendation-info {
  flex: 1;
  min-width: 0;
}
.dish-recommendation-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 10px;
  row-gap: 2px;
}
.dish-recommendation-name {
  display: block;
  color: #1f2937;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.5;
}
.dish-recommendation-location,
.dish-recommendation-rating {
  display: block;
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}
.dish-recommendation-rating {
  margin-top: 0;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.dish-recommendation-rating-rated {
  color: var(--color-rating, #946200);
}
.dish-rating-star {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.dish-recommendation-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.dish-recommendation-reason {
  display: block;
  margin-top: 12px;
  color: #667085;
  font-size: 16px;
  line-height: 1.65;
}
.dish-recommendation:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.dish-recommendation:active {
  background: #f7f8fa;
}
@media (hover: hover) {
  .dish-recommendation:hover {
    background: #f7f8fa;
  }
}
</style>
