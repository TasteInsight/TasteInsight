<template>
  <slot v-if="!required || user.isLoggedIn" />
  <EmptyState
    v-else
    class="page-state-region"
    :title="title"
    :icon="icon"
    action-text="登录"
    @action="openLogin"
  />
</template>

<script setup lang="ts">
import EmptyState from './EmptyState.vue';
import type { UiIconName } from '@/types/ui-icon';
import { useUserStore } from '@/store/modules/use-user-store';
import { openLogin } from '@/utils/login-navigation';

defineOptions({ options: { virtualHost: true } });

withDefaults(defineProps<{ required?: boolean; title: string; icon?: UiIconName }>(), {
  required: true,
  icon: 'user',
});
const user = useUserStore();
</script>
