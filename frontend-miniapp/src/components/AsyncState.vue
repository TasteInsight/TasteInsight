<template>
  <view
    v-if="state"
    class="async-state"
    :class="{
      'page-state-region': !hasContent,
      'error-feedback': state === 'error',
      'async-state--refreshing': state === 'refreshing',
    }"
    :role="state === 'error' ? 'alert' : state === 'refreshing' ? 'status' : undefined"
    :aria-busy="loading"
  >
    <template v-if="state === 'error'">
      <text v-if="errorTitle" class="error-feedback__title">{{ errorTitle }}</text>
      <text class="error-feedback__message">{{ error }}</text>
      <button
        class="error-feedback__action"
        hover-class="error-feedback__action--pressed"
        role="button"
        tabindex="0"
        @click="retryButton.activate"
        @keydown="retryButton.handleKeydown"
        @keyup="retryButton.handleKeyup"
        @blur="retryButton.clearPress"
      >
        {{ retryText || t('common.retry') }}
      </button>
    </template>
    <EmptyState
      v-else-if="state === 'loading'"
      :title="loadingTitle || t('common.loading')"
      loading
    />
    <template v-else-if="state === 'empty'">
      <slot name="empty">
        <EmptyState
          :title="emptyTitle"
          :icon="emptyIcon"
          :action-text="emptyActionText"
          @action="emit('action')"
        />
      </slot>
    </template>
    <text v-else>{{ refreshingTitle || t('common.refreshing') }}</text>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';

import { computed } from 'vue';
import EmptyState from './EmptyState.vue';
import type { UiIconName } from '@/types/ui-icon';
import { useButtonActivation } from '@/composables/use-button-activation';

defineOptions({ options: { virtualHost: true } });

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    initialized?: boolean;
    hasContent?: boolean;
    error?: string | null;
    errorTitle?: string;
    loadingTitle?: string;
    refreshingTitle?: string;
    emptyTitle?: string;
    emptyIcon?: UiIconName;
    emptyActionText?: string;
    retryText?: string;
  }>(),
  {
    loading: false,
    initialized: false,
    hasContent: false,
    error: '',
    errorTitle: '',
    loadingTitle: '',
    refreshingTitle: '',
    emptyTitle: '',
    emptyIcon: 'info',
    emptyActionText: '',
    retryText: '',
  }
);
const emit = defineEmits<{ (event: 'retry'): void; (event: 'action'): void }>();
const state = computed(() => {
  if (props.loading) return props.hasContent ? 'refreshing' : 'loading';
  if (props.error) return 'error';
  if (!props.hasContent && props.initialized && props.emptyTitle) return 'empty';
  return '';
});
const retryButton = useButtonActivation(() => emit('retry'));
</script>

<style scoped>
.async-state {
  box-sizing: border-box;
  width: 100%;
}
.async-state--refreshing {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
