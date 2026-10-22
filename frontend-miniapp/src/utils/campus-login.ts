import { t } from '@/i18n';
import type { CampusLoginStart, CampusLoginTicket } from '@/api/modules/auth';

const STORAGE_KEY = 'campusLoginPendingAttempt';
export type PendingCampusLogin = Omit<CampusLoginStart, 'authorizationUrl'>;
const validCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export function clearCampusLoginPending() {
  uni.removeStorageSync(STORAGE_KEY);
}
export function saveCampusLoginPending(start: CampusLoginStart): PendingCampusLogin {
  const pending = {
    attemptId: start.attemptId,
    expiresAt: start.expiresAt,
    loginVerifier: start.loginVerifier,
  };
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(pending));
  return pending;
}
export function readCampusLoginPending(): PendingCampusLogin | null {
  const raw = uni.getStorageSync(STORAGE_KEY);
  if (!raw) return null;
  try {
    const pending: PendingCampusLogin = JSON.parse(raw);
    if (
      typeof pending.attemptId === 'string' &&
      pending.attemptId &&
      validCode(pending.loginVerifier) &&
      Date.parse(pending.expiresAt) > Date.now()
    )
      return pending;
  } catch {
    /* Discard invalid persisted state. */
  }
  clearCampusLoginPending();
  return null;
}
export function campusLoginTicket(code: string): CampusLoginTicket {
  const pending = readCampusLoginPending();
  if (!pending) throw new Error(t('account.common.thisSignInRequestExpired'));
  const handoffCode = code.trim();
  if (!validCode(handoffCode)) throw new Error(t('account.common.pasteTheFullConfirmationCode'));
  return { attemptId: pending.attemptId, loginVerifier: pending.loginVerifier, handoffCode };
}
export function campusLoginMessage(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  popup: Window | null,
  apiOrigin: string
): string | null {
  if (!popup || event.source !== popup || event.origin !== apiOrigin) return null;
  const pending = readCampusLoginPending();
  const data = event.data;
  return pending &&
    data?.type === 'tasteinsight:campus-login' &&
    data.attemptId === pending.attemptId &&
    validCode(data.handoffCode)
    ? data.handoffCode
    : null;
}
