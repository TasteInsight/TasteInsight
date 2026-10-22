import { t } from '@/i18n';
import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue';
import type { ApiResponse } from '@/types/api';
import type { VerificationChallenge } from '@/api/modules/auth';
import { useUserStore } from '@/store/modules/use-user-store';

export function useVerificationCode(
  send: (target: string) => Promise<ApiResponse<VerificationChallenge>>
) {
  const user = useUserStore();
  const target = ref('');
  const code = ref('');
  const challengeId = ref('');
  const sending = ref(false);
  const retryAt = ref(0);
  const expiresAt = ref(0);
  const now = ref(Date.now());
  const error = ref('');
  let requestVersion = 0;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const remaining = computed(() => Math.max(0, Math.ceil((retryAt.value - now.value) / 1000)));
  const canVerify = computed(
    () =>
      !sending.value &&
      !!challengeId.value &&
      /^\d{6}$/.test(code.value) &&
      now.value < expiresAt.value
  );

  function resetChallenge() {
    requestVersion++;
    sending.value = false;
    code.value = '';
    challengeId.value = '';
    error.value = '';
    retryAt.value = 0;
    expiresAt.value = 0;
    if (timer) clearInterval(timer);
  }

  watch(target, resetChallenge, { flush: 'sync' });
  watch(
    () => user.sessionVersion,
    () => {
      target.value = '';
      resetChallenge();
    },
    { flush: 'sync' }
  );

  async function sendCode() {
    if (disposed || sending.value || remaining.value > 0 || !target.value.trim()) return;
    const version = ++requestVersion;
    sending.value = true;
    error.value = '';
    try {
      const result = await send(target.value.trim());
      if (disposed || version !== requestVersion) return;
      if (result.code !== 200 || !result.data)
        throw new Error(result.message || t('common.errors.code'));
      now.value = Date.now();
      challengeId.value = result.data.challengeId;
      code.value = '';
      expiresAt.value = now.value + result.data.expiresIn * 1000;
      retryAt.value = now.value + result.data.retryAfter * 1000;
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        now.value = Date.now();
        if (now.value >= expiresAt.value && now.value >= retryAt.value && timer)
          clearInterval(timer);
      }, 1000);
    } catch (cause) {
      if (!disposed && version === requestVersion)
        error.value = cause instanceof Error ? cause.message : t('common.errors.codeRetry');
    } finally {
      if (!disposed && version === requestVersion) sending.value = false;
    }
  }

  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      requestVersion++;
      if (timer) clearInterval(timer);
    });
  return { target, code, challengeId, sending, remaining, canVerify, error, sendCode };
}
