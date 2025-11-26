<!-- @/components/SearchBar.vue -->
<template>
  <view 
    class="bg-white rounded-2xl h-12 border border-gray-300 flex items-center px-4 my-4 cursor-pointer"
    @click="handleClick"
  >
    <text class="iconify" data-icon="mdi:magnify" style="color:#999; margin-right:8px;"></text>
    <text style="color:#999; margin-right:8px; font-size: 20px;">🔍</text>
    <text class="text-gray-500 text-sm">搜索食堂或菜品</text>
  </view>
</template>

<script setup lang="ts">
const handleClick = () => {
  uni.navigateTo({
    url: '/pages/search/index'
  });
};
</script>

