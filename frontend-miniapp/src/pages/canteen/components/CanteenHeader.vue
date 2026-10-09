<template>
  <view class="canteen-header" :aria-busy="loading">
    <view v-if="error" class="canteen-header__feedback" role="alert">
      <text>{{ error }}</text>
      <button class="canteen-header__retry" :disabled="loading" @tap="emit('retry')">
        重新加载
      </button>
    </view>
    <template v-if="canteen">
      <!-- 轮播图 -->
      <swiper
        v-if="validImages.length"
        class="canteen-header__photos"
        circular
        :interval="3000"
        :duration="500"
        indicator-dots
        indicator-active-color="#fff"
      >
        <swiper-item v-for="(img, index) in validImages" :key="img">
          <image
            :src="img"
            :alt="canteen.name"
            mode="aspectFill"
            class="w-full h-full"
            @error="failedImages[img] = true"
            @click="previewImage(index)"
          />
        </swiper-item>
      </swiper>

      <!-- 信息内容 -->
      <view class="px-4 py-4">
        <view class="canteen-header__name">{{ canteen.name }}</view>
        <view v-if="canteen.description" class="text-sm text-gray-500 mt-2">
          {{ canteen.description }}
        </view>
        <view v-if="formattedHours" class="text-xs text-gray-500 mt-2">
          营业时间：{{ formattedHours }}
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Canteen } from '@/types/api';

const props = defineProps<{ canteen: Canteen | null; loading?: boolean; error?: string | null }>();
const emit = defineEmits<{ retry: [] }>();
const failedImages = ref<Record<string, boolean>>({});
const validImages = computed(() =>
  (props.canteen?.images || []).filter(url => url && !failedImages.value[url])
);
watch(
  () => props.canteen?.id,
  () => {
    failedImages.value = {};
  }
);

const formattedHours = computed(() => {
  if (!props.canteen?.openingHours?.length) return '';

  // 以本地日期推导今天是周几，匹配后端 dayOfWeek 字符串（Monday...Sunday）
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[new Date().getDay()];

  const parts = props.canteen.openingHours
    .map(floorHours => {
      const todaySchedule = floorHours.schedule?.find(d => d.dayOfWeek === todayName);
      if (!todaySchedule || todaySchedule.isClosed || !todaySchedule.slots?.length) return null;

      const timeStr = todaySchedule.slots.map(s => `${s.openTime}-${s.closeTime}`).join(', ');

      // 单条 default 配置时不加前缀，避免冗余
      if (
        props.canteen!.openingHours.length === 1 &&
        (floorHours.floorLevel === 'default' || !floorHours.floorLevel)
      ) {
        return timeStr;
      }

      const floorLabel =
        !floorHours.floorLevel || floorHours.floorLevel === 'default'
          ? '通用'
          : `${floorHours.floorLevel}F`;
      return `${floorLabel} ${timeStr}`;
    })
    .filter(Boolean) as string[];

  if (parts.length === 0) return '今日休息';
  return parts.join(' | ');
});

// 图片预览
const previewImage = (index: number) => {
  if (validImages.value.length) {
    uni.previewImage({
      urls: validImages.value,
      current: index,
    });
  }
};
</script>
<style scoped>
.canteen-header {
  background: #fff;
}
.canteen-header__photos {
  width: 100%;
  height: 180px;
}
.canteen-header__name {
  color: #111827;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.canteen-header__feedback {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  color: #667085;
  font-size: 14px;
}
.canteen-header__retry {
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: #fff;
  color: #660874;
  font-size: 14px;
}
.canteen-header__retry::after {
  border: 0;
}
.canteen-header__retry:focus-visible {
  outline: 2px solid #660874;
}
</style>
