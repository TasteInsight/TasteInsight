<template>
  <view class="profile-dish">
    <DishSummaryCard class="profile-dish__summary" :dish="dish" @select="emit('click')" />
    <view v-if="showFavorite" class="profile-dish__actions">
      <button
        class="profile-dish__unfavorite"
        :aria-label="'取消收藏' + dish.name"
        :disabled="favoriteDisabled"
        @click="emit('unfavorite')"
      >
        {{ removing ? '取消中…' : '取消收藏' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import type { Dish } from '@/types/api';

defineProps<{
  dish: Dish;
  showFavorite?: boolean;
  favoriteDisabled?: boolean;
  removing?: boolean;
}>();
const emit = defineEmits<{ (e: 'click'): void; (e: 'unfavorite'): void }>();
</script>

<style scoped>
.profile-dish {
  border-bottom: 1px solid #e5e7eb;
}
.profile-dish__summary {
  border-bottom: 0;
}
.profile-dish__actions {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
}
.profile-dish__unfavorite {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #660874;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
}
.profile-dish__unfavorite::after {
  border: 0;
}
.profile-dish__unfavorite:active {
  background: #f4f4f5;
}
.profile-dish__unfavorite[disabled] {
  color: #98a2b3;
  background: transparent;
}
.profile-dish__unfavorite:focus-visible {
  outline: 2px solid #660874;
  outline-offset: -2px;
}
</style>
