<template>
  <view class="space-y-4 rounded-2xl bg-white p-6 shadow">
    <text class="text-base font-medium text-gray-900">请先登录</text>
    <text class="text-sm text-gray-500">登录后可以查看并编辑个人信息。</text>
    <button
      class="h-12 w-full rounded-full bg-ts-purple text-sm font-medium text-white"
      hover-class="bg-purple-800"
      @click="emit('login')"
    >
      去登录
    </button>
  </view>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'login'): void;
}>();
</script>
