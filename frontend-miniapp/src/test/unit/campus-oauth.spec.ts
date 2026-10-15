import { createPinia, setActivePinia } from 'pinia';
import {
  campusOAuthCompletion,
  campusOAuthMessage,
  clearCampusOAuthPending,
  readCampusOAuthPending,
  saveCampusOAuthPending,
} from '@/utils/campus-oauth';
import { useUserStore } from '@/store/modules/use-user-store';

jest.mock('@/api/modules/user', () => ({
  wechatLogin: jest.fn(),
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
}));
jest.mock('@/api/modules/auth', () => ({ phoneLogin: jest.fn() }));

const storage = new Map<string, string>();
const start = () => ({
  attemptId: 'attempt-a',
  authorizationUrl: 'https://school.example/authorize?state=state',
  expiresAt: new Date(Date.now() + 900000).toISOString(),
  account: { id: 'alice', nickname: '同学' },
});
const code = 'a'.repeat(43);
beforeEach(() => {
  storage.clear();
  (uni.getStorageSync as jest.Mock).mockImplementation(key => storage.get(key));
  (uni.setStorageSync as jest.Mock).mockImplementation((key, value) => storage.set(key, value));
  (uni.removeStorageSync as jest.Mock).mockImplementation(key => storage.delete(key));
  setActivePinia(createPinia());
});

test('persists only the owner-bound pending attempt, never the authorization URL or handoff', () => {
  saveCampusOAuthPending('alice', start());
  expect(readCampusOAuthPending('alice')).toMatchObject({
    ownerId: 'alice',
    attemptId: 'attempt-a',
  });
  expect(JSON.stringify([...storage.values()])).not.toContain('authorizationUrl');
  expect(campusOAuthCompletion('alice', ` ${code} `)).toEqual({
    attemptId: 'attempt-a',
    handoffCode: code,
    purpose: 'VERIFICATION',
  });
});
test('a copied authorization URL or handoff alone cannot establish a pending attempt', () => {
  expect(() => campusOAuthCompletion('alice', code)).toThrow('重新发起认证');
  expect(() => saveCampusOAuthPending('bob', start())).toThrow('账号已变更');
  expect(storage.size).toBe(0);
});
test('discards expired, invalid and other-owner pending data', () => {
  saveCampusOAuthPending('alice', start());
  expect(readCampusOAuthPending('bob')).toBeNull();
  expect(storage.size).toBe(0);
  saveCampusOAuthPending('alice', { ...start(), expiresAt: new Date(0).toISOString() });
  expect(readCampusOAuthPending('alice')).toBeNull();
  storage.set('campusOAuthPendingAttempt', 'broken-json');
  expect(readCampusOAuthPending('alice')).toBeNull();
  expect(() => campusOAuthCompletion('alice', code)).toThrow();
});
test('requires API origin, exact popup source, matching local attempt and owner before accepting a message', () => {
  const popup = {} as Window;
  saveCampusOAuthPending('alice', start());
  const event = {
    origin: 'https://api.example',
    source: popup,
    data: { type: 'tasteinsight:campus-oauth', attemptId: 'attempt-a', handoffCode: code },
  };
  expect(campusOAuthMessage(event, popup, 'https://api.example', 'alice')).toBe(code);
  expect(
    campusOAuthMessage(
      { ...event, origin: 'https://attacker.example' },
      popup,
      'https://api.example',
      'alice'
    )
  ).toBeNull();
  expect(
    campusOAuthMessage({ ...event, source: {} as Window }, popup, 'https://api.example', 'alice')
  ).toBeNull();
  expect(
    campusOAuthMessage(
      { ...event, data: { ...event.data, attemptId: 'copied-attempt' } },
      popup,
      'https://api.example',
      'alice'
    )
  ).toBeNull();
  expect(campusOAuthMessage(event, popup, 'https://api.example', 'bob')).toBeNull();
  expect(campusOAuthMessage(event, popup, 'https://api.example', 'alice')).toBeNull();
});
test('logout clears pending state even when the identity page is not mounted', () => {
  const store = useUserStore();
  store.token = 'session';
  store.userInfo = { id: 'alice' } as any;
  saveCampusOAuthPending('alice', start());
  store.logoutAction();
  expect(readCampusOAuthPending('alice')).toBeNull();
  expect(storage.size).toBe(0);
});
test('cancellation clears the local attempt and malformed codes are rejected before the API call', () => {
  saveCampusOAuthPending('alice', start());
  expect(() => campusOAuthCompletion('alice', '123456')).toThrow('完整确认码');
  clearCampusOAuthPending();
  expect(() => campusOAuthCompletion('alice', code)).toThrow('重新发起认证');
});

test('keeps login-binding confirmation separate from campus-verification messages', () => {
  const popup = {} as Window;
  saveCampusOAuthPending('alice', { ...start(), purpose: 'LOGIN_BIND' });
  const event = {
    origin: 'https://api.example',
    source: popup,
    data: { type: 'tasteinsight:campus-oauth', attemptId: 'attempt-a', handoffCode: code },
  };
  expect(campusOAuthMessage(event, popup, 'https://api.example', 'alice')).toBeNull();
  expect(
    campusOAuthMessage(
      { ...event, data: { ...event.data, purpose: 'LOGIN_BIND' } },
      popup,
      'https://api.example',
      'alice'
    )
  ).toBe(code);
  expect(campusOAuthCompletion('alice', code)).toMatchObject({ purpose: 'LOGIN_BIND' });
});
