import { computed, ref } from 'vue';
import { i18n, t } from '@/i18n';

export function useLocalizedMessage() {
  const message = ref('');
  return computed({
    get: () => (i18n.global.te(message.value) ? t(message.value) : message.value),
    set: (value: string) => {
      message.value = value;
    },
  });
}
