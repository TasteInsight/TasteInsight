<template>
  <button class="canteen-result" @tap="handleClick">
    <view class="canteen-result-photo">
      <image
        v-if="imageSource"
        :key="imageSource"
        :src="imageSource"
        :alt="canteen.name"
        mode="aspectFill"
        class="canteen-result-image"
        @error="failedImages[imageSource] = true"
      />
      <view v-else class="canteen-result-fallback"><text>暂无照片</text></view>
    </view>
    <view class="canteen-result-copy">
      <text class="canteen-result-name">{{ canteen.name }}</text>
      <text v-if="canteen.description" class="canteen-result-description">{{
        canteen.description
      }}</text>
      <text class="canteen-result-rating">{{
        canteen.averageRating ? canteen.averageRating.toFixed(1) + '分' : '暂无评分'
      }}</text>
    </view>
    <uni-icons type="right" size="18" color="#667085" aria-hidden="true" />
  </button>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Canteen } from '@/types/api';
const props = defineProps<{ canteen: Canteen }>();
const failedImages = ref<Record<string, boolean>>({});
const imageSource = computed(
  () => props.canteen.images?.find(url => url && !failedImages.value[url]) || ''
);
watch(
  () => props.canteen.id,
  () => {
    failedImages.value = {};
  }
);
const handleClick = () =>
  uni.navigateTo({ url: '/pages/canteen/index?id=' + encodeURIComponent(props.canteen.id) });
</script>
<style scoped>
.canteen-result {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 16px 0;
  border: 0;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  background: #fff;
  text-align: left;
}
.canteen-result::after {
  border: 0;
}
.canteen-result:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.canteen-result:active {
  opacity: 0.72;
}
.canteen-result-photo {
  width: 76px;
  height: 76px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: #f4f4f5;
}
.canteen-result-image {
  display: block;
  width: 100%;
  height: 100%;
}
.canteen-result-fallback {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #667085;
}
.canteen-result-copy {
  flex: 1;
  min-width: 0;
}
.canteen-result-name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: #111827;
  overflow-wrap: anywhere;
}
.canteen-result-description {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
  color: #667085;
  overflow-wrap: anywhere;
}
.canteen-result-rating {
  display: block;
  margin-top: 5px;
  font-size: 13px;
  line-height: 1.5;
  color: #667085;
}
</style>
