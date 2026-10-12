import type { CampusOAuthStart } from '@/api/modules/auth';

const STORAGE_KEY = 'campusOAuthPendingAttempt';
export type PendingCampusOAuth = Omit<CampusOAuthStart, 'authorizationUrl'> & { ownerId: string };

export function clearCampusOAuthPending(): void {
  uni.removeStorageSync(STORAGE_KEY);
}

export function saveCampusOAuthPending(
  ownerId: string,
  start: CampusOAuthStart
): PendingCampusOAuth {
  if (!ownerId || start.account.id !== ownerId) throw new Error('账号已变更，请重新发起认证');
  const pending = {
    ownerId,
    attemptId: start.attemptId,
    expiresAt: start.expiresAt,
    account: start.account,
  };
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(pending));
  return pending;
}

export function readCampusOAuthPending(ownerId?: string): PendingCampusOAuth | null {
  const raw = uni.getStorageSync(STORAGE_KEY);
  if (!raw) return null;
  try {
    const pending: PendingCampusOAuth = JSON.parse(raw);
    if (
      ownerId &&
      pending.ownerId === ownerId &&
      pending.account.id === ownerId &&
      typeof pending.attemptId === 'string' &&
      pending.attemptId &&
      Date.parse(pending.expiresAt) > Date.now()
    )
      return pending;
  } catch {
    /* Discard invalid persisted state. */
  }
  clearCampusOAuthPending();
  return null;
}

export function campusOAuthCompletion(ownerId: string | undefined, handoffCode: string) {
  const pending = readCampusOAuthPending(ownerId);
  if (!pending) throw new Error('本次认证已过期或账号已变更，请重新发起认证');
  const code = handoffCode.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) throw new Error('请粘贴校方认证完成页面的完整确认码');
  return { attemptId: pending.attemptId, handoffCode: code };
}

export function campusOAuthMessage(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  popup: Window | null,
  apiOrigin: string,
  ownerId?: string
): string | null {
  if (!popup || event.source !== popup || event.origin !== apiOrigin) return null;
  const pending = readCampusOAuthPending(ownerId);
  const data = event.data;
  if (
    !pending ||
    !data ||
    data.type !== 'tasteinsight:campus-oauth' ||
    data.attemptId !== pending.attemptId ||
    typeof data.handoffCode !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.handoffCode)
  )
    return null;
  return data.handoffCode;
}
