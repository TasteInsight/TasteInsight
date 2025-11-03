<!-- @/pages/index/components/CanteenList.vue -->
<template>
  <scroll-view scroll-x="true" class="canteen-scroll" :show-scrollbar="false">
    <view class="canteen-list">
      <view class="canteen-card" v-for="canteen in canteenList" :key="canteen.id" @click="goToCanteen(canteen.id)">
        <image :src="canteen.image" class="canteen-image" mode="aspectFit" />
        <text class="canteen-name">{{ canteen.name }}</text>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// API 暂时没有提供食堂列表，我们先根据原型硬编码
// TODO: 后续应从 useCanteenStore 中获取
const canteenList = ref([
  { id: 'zijing', name: '紫荆园', image: '/static/images/canteen-zijing.png' },
  { id: 'taoli', name: '桃李园', image: '/static/images/canteen-taoli.png' },
  { id: 'guanchou', name: '观畴园', image: '/static/images/canteen-guanchou.png' },
]);

const goToCanteen = (id: string) => {
  uni.navigateTo({
    url: `/subPackages/canteen/detail?id=${id}`
  });
}
</script>

<style lang="scss" scoped>
.canteen-scroll {
  white-space: nowrap;
  .canteen-list {
    display: flex;
    padding-bottom: 16px;
  }
}
.canteen-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  margin-right: 12px;
}
.canteen-image {
  width: 48px;
  height: 48px;
}
.canteen-name {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 500;
}
</style>