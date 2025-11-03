<template>
  <view class="search-box" @click="onSearchClick">
    <uni-icons type="search" size="22" color="#999"></uni-icons>
    <text class="placeholder">搜索菜品</text>
  </view>
</template>

<script setup lang="ts">
const onSearchClick = () => {
  // TODO: 跳转到搜索页面
  uni.navigateTo({ url: '/pages/search/index' });
};
</script>

<style lang="scss" scoped>
.search-box {
  background-color: #f5f5f5;
  border-radius: 50px;
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  margin: 16px 0;
}
.placeholder { 
  color: #999; 
  margin-left: 8px;
  font-size: 14px;
}
</style>