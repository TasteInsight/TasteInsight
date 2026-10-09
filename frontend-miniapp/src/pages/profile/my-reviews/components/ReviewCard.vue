<template>
  <button
    class="my-review"
    :aria-label="'查看' + review.dishName + '的评价'"
    @click="$emit('click')"
  >
    <view class="my-review-heading">
      <view class="my-review-title-block">
        <text class="my-review-title">{{ review.dishName }}</text>
        <view class="my-review-meta">
          <view class="my-review-stars" :aria-label="'评分' + review.rating + '星'"
            ><text
              v-for="star in 5"
              :key="star"
              class="iconfont icon-star"
              :class="{ 'star-filled': star <= review.rating }"
              aria-hidden="true"
            ></text
          ></view>
        </view>
      </view>
      <image
        v-if="dishImage"
        :src="dishImage"
        class="my-review-dish-image"
        mode="aspectFill"
        @error="failedImages.add(dishImage)"
      />
    </view>
    <text v-if="review.content" class="my-review-content">{{ review.content }}</text>
    <view v-if="validImages.length" class="my-review-images">
      <image
        v-for="img in validImages.slice(0, 3)"
        :key="img"
        :src="img"
        class="my-review-image"
        mode="aspectFill"
        @error="failedImages.add(img)"
      />
    </view>
    <view class="my-review-footer"
      ><text>{{ formattedDate }}</text
      ><text class="my-review-detail"
        >查看详情<text class="iconfont icon-chevronright" aria-hidden="true"></text></text
    ></view>
  </button>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { MyReviewItem } from '@/types/api';
import dayjs from 'dayjs';
const props = defineProps<{ review: MyReviewItem }>();
defineEmits<{ (e: 'click'): void }>();
const failedImages = ref(new Set<string>());
watch(
  () => [props.review.id, props.review.dishImage, props.review.images],
  () => {
    failedImages.value = new Set();
  }
);
const formattedDate = computed(() => dayjs(props.review.createdAt).format('YYYY-MM-DD HH:mm'));
const dishImage = computed(() =>
  props.review.dishImage?.trim() && !failedImages.value.has(props.review.dishImage)
    ? props.review.dishImage
    : ''
);
const validImages = computed(() =>
  (props.review.images || []).filter(img => img?.trim() && !failedImages.value.has(img))
);
</script>
<style scoped>
.my-review {
  box-sizing: border-box;
  display: block;
  width: 100%;
  margin: 0;
  padding: 20px 0;
  border: 0;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  background: #fff;
  color: #1f2937;
  text-align: left;
  font-family: inherit;
  line-height: 1.5;
}
.my-review::after {
  border: 0;
}
.my-review:active {
  background: #f9fafb;
}
.my-review:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.my-review-heading {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.my-review-title-block {
  min-width: 0;
  flex: 1;
}
.my-review-title {
  display: block;
  color: #111827;
  font-size: 16px;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.my-review-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.my-review-stars {
  display: flex;
  gap: 2px;
  color: #d0d5dd;
  font-size: 14px;
}
.star-filled {
  color: #d99a12;
}
.my-review-content {
  display: block;
  margin-top: 14px;
  font-size: 16px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.my-review-dish-image {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 10px;
}
.my-review-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.my-review-image {
  width: 72px;
  height: 72px;
  border-radius: 10px;
}
.my-review-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  color: #667085;
  font-size: 12px;
}
.my-review-detail {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
