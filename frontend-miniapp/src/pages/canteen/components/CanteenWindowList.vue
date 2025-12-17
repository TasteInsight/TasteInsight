<template>
  <view v-if="windows.length > 0" class="px-4 py-4">
    <view class="text-base font-semibold text-gray-800 mb-3 flex items-center">
      <view class="w-1 h-4 bg-ts-purple rounded-full mr-2"></view>
      窗口列表
    </view>
    
    <swiper 
      class="h-[18vw]" 
      :current="currentSwiperIndex" 
      @change="handleSwiperChange"
    >
      <swiper-item v-for="(chunk, index) in windowChunks" :key="index">
        <view class="flex justify-between items-center h-full px-1">
          <view
            v-for="window in chunk"
            :key="window.id"
            class="window-item w-[21vw] h-[16vw] flex flex-col items-center justify-center cursor-pointer relative"
            @tap="() => handleClick(window.id)"
          >
            <!-- 纯文字设计，带动态渐变边框或背景 -->
            <view 
              class="w-full h-full rounded-xl bg-gradient-to-br from-white to-gray-50 border border-gray-100/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center p-2 relative overflow-hidden"
            >
              <!-- 装饰性背景圆 -->
              <view class="absolute -top-4 -right-4 w-12 h-12 bg-purple-50 rounded-full opacity-50"></view>
              
              <!-- 窗口名字 -->
              <span class="text-sm font-semibold text-gray-800 text-center line-clamp-2 leading-tight z-10">{{ window.name }}</span>
              
              <!-- 底部楼层标识 (如果有) -->
              <span v-if="window.floorName" class="text-[10px] text-gray-400 mt-1 z-10">{{ window.floorName }}</span>
            </view>
          </view>
          <!-- 占位符，保持布局整齐 -->
          <view v-if="chunk.length < 4" v-for="i in (4 - chunk.length)" :key="'placeholder-'+i" class="w-[21vw]"></view>
        </view>
      </swiper-item>
    </swiper>

    <!-- 指示点 -->
    <view class="flex justify-center mt-2 space-x-1.5" v-if="windowChunks.length > 1">
      <view
        v-for="(_, index) in windowChunks"
        :key="index"
        class="h-1.5 rounded-full transition-all duration-300"
        :class="currentSwiperIndex === index ? 'w-3 bg-ts-purple' : 'w-1.5 bg-gray-200'"
      ></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Window } from '@/types/api';

const props = defineProps<{ windows: Window[] }>();
const emit = defineEmits<{ (e: 'click', id: string): void }>();

const currentSwiperIndex = ref(0);

// 将窗口列表按每页4个分组
const windowChunks = computed(() => {
  const list = props.windows || [];
  const size = 4;
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
});

const handleSwiperChange = (e: any) => {
  currentSwiperIndex.value = e.detail.current;
};

const handleClick = (id: string) => {
  emit('click', id);
};
</script>

<style scoped>
/* 确保 swiper 内部布局正确 */
:deep(uni-swiper-item) {
  width: 100%;
}
</style>
