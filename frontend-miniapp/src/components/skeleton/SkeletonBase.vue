<template>
  <view 
    class="skeleton-item rounded"
    :class="[
      animated ? 'skeleton-animated' : '',
      roundedFull ? 'rounded-full' : '',
      className
    ]"
    :style="{ width: width, height: height }"
  ></view>
</template>

<script setup lang="ts">
interface Props {
  width?: string;
  height?: string;
  animated?: boolean;
  roundedFull?: boolean;
  className?: string;
}

withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '1rem',
  animated: true,
  roundedFull: false,
  className: '',
});
</script>

<style scoped>
.skeleton-item {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
}

.skeleton-animated {
  animation: skeleton-loading 1.5s infinite ease-in-out;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
