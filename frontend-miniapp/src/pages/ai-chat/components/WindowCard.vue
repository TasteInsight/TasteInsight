<template>
  <view
    class="window-card list-row-action"
    hover-class="list-row-pressed"
    :hover-stay-time="80"
    role="button"
    tabindex="0"
    :aria-label="t('social.viewWindow', { p0: window.name })"
    @click="goToWindow"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
    @blur="pressed = false"
  >
    <image
      v-if="window.image && failedImage !== window.image"
      :src="window.image"
      class="window-image"
      mode="aspectFill"
      @error="failedImage = window.image"
    />
    <view v-else class="window-fallback">{{ t('social.window') }}</view>
    <view class="window-info"
      ><text class="window-name">{{ window.name }}</text
      ><text v-if="window.canteenName" class="window-meta">{{ window.canteenName }}</text
      ><text class="window-meta"
        >{{ displayStatus }} ·
        {{
          window.rating && window.rating > 0
            ? t('social.windowRatingValue', { p0: window.rating.toFixed(1) })
            : t('social.noRating')
        }}</text
      ></view
    >
  </view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed, ref } from 'vue';
import type { ComponentWindowCard } from '@/types/api';
const props = defineProps<{ window: ComponentWindowCard }>();
const failedImage = ref('');
const pressed = ref(false);
const displayStatus = computed(
  () =>
    ({ open: t('social.open'), closed: t('social.closed'), unknown: t('social.hoursUnavailable') })[
      props.window.status || 'unknown'
    ] || props.window.status
);
const goToWindow = () => {
  if (props.window.id) uni.navigateTo({ url: `/pages/window/index?id=${props.window.id}` });
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
    goToWindow();
  }
};
</script>
<style scoped>
.window-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  padding-block: 16px;
  margin-bottom: 0;
  background: #fff;
}
.window-image,
.window-fallback {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 10px;
}
.window-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f4f5;
  color: #667085;
  font-size: 13px;
}
.window-info {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.window-name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.5;
}
.window-meta {
  display: block;
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}
</style>
