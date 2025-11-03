<!-- @/pages/index/components/FilterBar.vue -->
<template>
  <view class="filter-bar">
    <view class="tag active"><span>口味</span></view>
    <view class="tag"><span>价格</span></view>
    <view class="tag"><span>评分</span></view>
  </view>
</template>

<style lang="scss" scoped>
.filter-bar { 
  display: flex;
  flex-wrap: wrap;
  padding: 8px 0;
}
.tag {
  display: inline-flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 20px;
  padding: 6px 14px;
  margin-right: 12px;
  margin-bottom: 8px;
  font-size: 14px;
  
  &.active {
    background-color: #F3E5F5; // 紫色背景，来自原型
    color: #82318E;
    font-weight: 500;
  }
}
</style>