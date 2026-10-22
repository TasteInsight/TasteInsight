<template>
  <view class="space-y-4 rounded-2xl bg-white p-6 shadow">
    <text class="text-base font-medium text-gray-900">{{ t('account.settings.signInFirst') }}</text>
    <text class="text-sm text-gray-500">{{ t('account.settings.signInToViewAnd') }}</text>
    <button
      class="h-12 w-full rounded-full bg-ts-purple text-sm font-medium text-white"
      hover-class="bg-purple-800"
      @click="emit('login')"
    >
      {{ t('account.settings.signIn') }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
const emit = defineEmits<{
  (e: 'login'): void;
}>();
</script>
