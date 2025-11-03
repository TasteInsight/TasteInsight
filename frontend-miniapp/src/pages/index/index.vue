<template>
  <view class="home-container">
    <!-- 1. 搜索栏 -->
    <SearchBar />

    <!-- 2. 食堂列表 -->
    <CanteenList />

    <!-- 3. 筛选条 -->
    <FilterBar />

    <!-- 4. 推荐列表 -->
    <view class="section-title">今日推荐</view>
    
    <!-- 加载状态：可以使用骨架屏组件替代 -->
    <view v-if="loading" class="loading-state">
      <uni-load-more status="loading" :show-text="false"></uni-load-more>
    </view>

  
    <!-- 空数据状态 -->
    <view v-else-if="dishes.length === 0" class="empty-state">
      <text>今天好像没有推荐菜品哦</text>
    </view>
    
    <!-- 数据列表 -->
    <view v-else class="recommend-list">
      <RecommendItem 
        v-for="dish in dishes" 
        :key="dish.id" 
        :dish="dish"
      />
    </view>

  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import SearchBar from './components/SearchBar.vue';
import CanteenList from './components/CanteenList.vue';
import FilterBar from './components/FilterBar.vue';
import RecommendItem from './components/RecommendItem.vue';
import { useRecommendDishes } from './composables/use-recommend-dishes';

// 消费 Composable，获取所需的一切
const { dishes, loading, fetchDishes } = useRecommendDishes();

// 生命周期函数：页面加载时获取数据
onMounted(() => {
  fetchDishes();
});

// uniapp 生命周期：下拉刷新
onPullDownRefresh(async () => {
  await fetchDishes();
  uni.stopPullDownRefresh();
});

// uniapp 生命周期：上拉加载更多
onReachBottom(() => {
  // TODO: 在 useRecommendDishes 中实现加载下一页的逻辑
  console.log('触底了，可以加载下一页');
});

</script>

<style lang="scss" scoped>
.home-container {
  padding: 0 16px;
  background-color: #fff;
  min-height: 100vh;
}
.section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 8px;
}
.loading-state, .empty-state {
  padding: 80px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #999;
  font-size: 14px;
}
</style>