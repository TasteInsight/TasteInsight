<template>
  <view class="recommendation-observed-card"
    ><DishSummaryCard :dish="dish" @select="goToDetail"
  /></view>
</template>

<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, onScopeDispose, watch } from 'vue';
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { createRecommendationFeedback } from '@/composables/use-recommendation-feedback';
import type { Dish } from '@/types/api';

const props = withDefaults(
  defineProps<{ dish: Dish; deliveryId?: string; active?: boolean; sessionVersion?: number }>(),
  { active: false }
);
const userStore = useUserStore();
const instance = getCurrentInstance();
let disposed = false;
let observer: ReturnType<typeof uni.createIntersectionObserver> | undefined;
const feedback = createRecommendationFeedback(
  () => !disposed && userStore.isLoggedIn && props.sessionVersion === userStore.sessionVersion
);
let observationRun = 0;
function disconnect() {
  observationRun += 1;
  observer?.disconnect();
  observer = undefined;
}
async function observe() {
  disconnect();
  const run = observationRun;
  if (
    !props.active ||
    !props.deliveryId ||
    !userStore.isLoggedIn ||
    props.sessionVersion !== userStore.sessionVersion
  )
    return;
  await nextTick();
  if (disposed || run !== observationRun) return;
  observer = uni.createIntersectionObserver(instance?.proxy, { thresholds: [0, 0.5] });
  observer.relativeToViewport().observe('.recommendation-observed-card', entry => {
    if (
      props.active &&
      run === observationRun &&
      entry.intersectionRatio >= 0.5 &&
      props.deliveryId
    )
      feedback.send({
        deliveryId: props.deliveryId,
        dishId: props.dish.id,
        eventType: 'impression',
      });
  });
}
watch(
  () => [props.deliveryId, props.dish.id, props.sessionVersion, userStore.sessionVersion],
  () => {
    feedback.reset();
    void observe();
  }
);
watch(
  () => props.active,
  () => {
    void observe();
  }
);
onMounted(observe);
onScopeDispose(() => {
  disposed = true;
  disconnect();
  feedback.reset();
});
const goToDetail = (id: string) => {
  const deliveryId =
    props.sessionVersion === userStore.sessionVersion && userStore.isLoggedIn
      ? props.deliveryId
      : undefined;
  if (deliveryId) feedback.send({ deliveryId, dishId: id, eventType: 'click' });
  const source = deliveryId
    ? `&deliveryId=${encodeURIComponent(deliveryId)}&recommendationSession=${userStore.sessionVersion}`
    : '';
  uni.navigateTo({ url: `/pages/dish/index?id=${encodeURIComponent(id)}${source}` });
};
</script>
