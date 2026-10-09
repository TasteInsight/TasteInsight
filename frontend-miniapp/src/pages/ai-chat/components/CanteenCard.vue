<template>
  <view
    class="canteen-card"
    role="button"
    tabindex="0"
    :aria-label="`查看食堂：${canteen.name || '食堂'}`"
    @click="goToCanteen"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
    @blur="pressed = false"
  >
    <image
      v-if="canteen.image && failedImage !== canteen.image"
      :src="canteen.image"
      class="canteen-image"
      mode="aspectFill"
      @error="failedImage = canteen.image"
    />
    <view v-else class="canteen-fallback">食堂</view>
    <view class="canteen-info"
      ><text class="canteen-name">{{ canteen.name || '食堂' }}</text
      ><text class="canteen-meta">{{ displayStatus }}</text
      ><text class="canteen-meta">{{
        canteen.averageRating && canteen.averageRating > 0
          ? `${canteen.averageRating.toFixed(1)} 分`
          : '暂无评分'
      }}</text></view
    >
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ComponentCanteenCard } from '@/types/api';
const props = defineProps<{ canteen: ComponentCanteenCard }>();
const failedImage = ref('');
const pressed = ref(false);
const displayStatus = computed(
  () =>
    ({ open: '营业中', closed: '已打烊', unknown: '暂无营业信息' })[
      props.canteen.status || 'unknown'
    ] || props.canteen.status
);
const goToCanteen = () => {
  if (props.canteen.id) uni.navigateTo({ url: `/pages/canteen/index?id=${props.canteen.id}` });
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
    goToCanteen();
  }
};
</script>
<style scoped>
.canteen-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  padding: 16px 0;
  margin-bottom: 0;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}
.canteen-image,
.canteen-fallback {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 10px;
}
.canteen-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f4f5;
  color: #667085;
  font-size: 13px;
}
.canteen-info {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.canteen-name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.5;
}
.canteen-meta {
  display: block;
  margin-top: 4px;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}
.canteen-card:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
</style>
