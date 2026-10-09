<template>
  <button
    class="dish-card"
    hover-class="dish-card--pressed"
    :aria-label="`查看${dish.name}`"
    @click="selectDish"
  >
    <view class="dish-card__body">
      <text class="dish-card__name">{{ dish.name }}</text>
      <text class="dish-card__location">{{ location }}</text>
      <view v-if="dish.tags?.length" class="dish-card__tags">
        <TagBadge v-for="tag in dish.tags.slice(0, 2)" :key="tag" :label="tag" />
      </view>
      <view class="dish-card__footer">
        <text class="dish-card__price"
          >¥{{ dish.price.toFixed(1)
          }}<text v-if="dish.priceUnit" class="dish-card__unit">/{{ dish.priceUnit }}</text></text
        >
        <view class="dish-card__reputation">
          <text v-if="dish.averageRating > 0" class="dish-card__star" aria-hidden="true">★</text>
          <text class="dish-card__rating" :class="{ 'dish-card__rating--unrated': dish.averageRating <= 0 }">{{
            dish.averageRating > 0 ? `${dish.averageRating.toFixed(1)} 分` : '暂无评分'
          }}</text>
          <text
            v-if="dish.reviewCount !== undefined && dish.reviewCount !== null"
            class="dish-card__reviews"
            >{{ dish.reviewCount }} 条评价</text
          >
        </view>
      </view>
    </view>
    <view v-if="imageSource && !imageFailed" class="dish-card__photo">
      <image
        :key="imageSource"
        :src="imageSource"
        :alt="dish.name"
        class="dish-card__image"
        mode="aspectFill"
        @error="imageFailed = true"
      />
    </view>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Dish } from '@/types/api';
import TagBadge from './TagBadge.vue';

const props = defineProps<{ dish: Dish }>();
const emit = defineEmits<{ (event: 'select', id: string): void }>();
const imageFailed = ref(false);
const imageSource = computed(() => props.dish.images?.[0] || '');
const location = computed(
  () => [props.dish.canteenName, props.dish.windowName].filter(Boolean).join(' · ') || '位置待补充'
);

watch(
  () => [props.dish.id, imageSource.value],
  () => {
    imageFailed.value = false;
  }
);

const selectDish = () => emit('select', props.dish.id);
</script>

<style scoped>
.dish-card {
  display: flex;
  align-items: flex-start;
  width: 100%;
  margin: 0;
  padding: 18px 0;
  border: 0;
  border-bottom: 1px solid #eaecf0;
  border-radius: 0;
  background: #ffffff;
  color: #1f2937;
  font-family: inherit;
  line-height: 1.45;
  text-align: left;
  box-sizing: border-box;
}
.dish-card::after {
  border: 0;
}
.dish-card--pressed,
.dish-card:active {
  background: #f7f8fa;
}
.dish-card:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.dish-card__photo {
  flex: 0 0 84px;
  width: 84px;
  height: 84px;
  margin-left: 12px;
  overflow: hidden;
  border-radius: 12px;
  background: #f4f4f5;
}
.dish-card__image {
  display: block;
  width: 100%;
  height: 100%;
}
.dish-card__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.dish-card__name {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.dish-card__location {
  display: block;
  margin-top: 5px;
  color: #667085;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.dish-card__tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 6px;
  gap: 6px;
}
.dish-card__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 5px 10px;
  margin-top: 10px;
}
.dish-card__price {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-price, #2f6b50);
  font-variant-numeric: tabular-nums;
}
.dish-card__unit {
  margin-left: 2px;
  color: #667085;
  font-size: 12px;
  font-weight: 400;
}
.dish-card__reputation {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 4px;
  align-items: baseline;
}
.dish-card__rating {
  color: var(--color-rating, #946200);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dish-card__rating--unrated {
  color: var(--color-text-muted, #667085);
  font-weight: 400;
}
.dish-card__reviews {
  color: #667085;
  font-size: 12px;
}
.dish-card__star {
  color: var(--color-rating, #946200);
  font-size: 12px;
}
</style>
