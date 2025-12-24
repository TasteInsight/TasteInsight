<template>
  <view 
    class="flex items-center bg-gray-100 border border-gray-200 rounded-full px-4 h-10 my-4 cursor-pointer"
    @click="handleClick"
  >
    <uni-icons type="search" size="18" color="#999"></uni-icons>
    <view class="flex-1 text-sm text-gray-500 ml-2">
      搜索食堂或菜品
    </view>
  </view>
</template>

<script setup lang="ts">
const handleClick = () => {
  uni.navigateTo({
    url: '/pages/search/index'
  });
};
</script>

