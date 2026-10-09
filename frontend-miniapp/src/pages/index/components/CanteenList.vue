<template>
  <button
    class="canteen-entry"
    hover-class="canteen-entry--pressed"
    :aria-label="`浏览${canteen.name}`"
    @click="emit('click')"
  >
    <view class="canteen-entry__photo">
      <image
        v-if="imageSource"
        :key="imageSource"
        :src="imageSource"
        :alt="canteen.name"
        class="canteen-entry__image"
        mode="aspectFill"
        @error="failedImages[imageSource] = true"
      />
      <view v-else class="canteen-entry__placeholder" aria-hidden="true">
        <text class="iconfont icon-store canteen-entry__building"></text>
        <text class="canteen-entry__placeholder-label">暂无照片</text>
      </view>
    </view>
    <text class="canteen-entry__name">{{ canteen.name }}</text>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Canteen } from '@/types/api';

const props = defineProps<{ canteen: Canteen }>();
const emit = defineEmits<{ (e: 'click'): void }>();
const failedImages = ref<Record<string, boolean>>({});
const imageSource = computed(
  () => props.canteen.images?.find(url => url && !failedImages.value[url]) || ''
);

watch(
  () => [props.canteen.id, props.canteen.images?.join('|')],
  () => {
    failedImages.value = {};
  }
);
</script>

<style scoped>
.canteen-entry {
  display: inline-flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  width: 116px;
  margin: 0 12px 0 0;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #1f2937;
  font-family: inherit;
  line-height: 1.4;
  text-align: center;
  white-space: normal;
  box-sizing: border-box;
}
.canteen-entry::after {
  border: 0;
}
.canteen-entry--pressed,
.canteen-entry:active {
  opacity: 0.72;
}
.canteen-entry:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
.canteen-entry__name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  width: 100%;
  max-height: 40px;
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.canteen-entry__photo {
  width: 116px;
  height: 78px;
  overflow: hidden;
  border-radius: 12px;
  background: #f2f3f5;
}
.canteen-entry__image {
  display: block;
  width: 100%;
  height: 100%;
}
.canteen-entry__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  height: 100%;
  color: #8b919c;
}
.canteen-entry__building {
  font-size: 25px;
  line-height: 1.2;
}
.canteen-entry__placeholder-label {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.3;
}
</style>
