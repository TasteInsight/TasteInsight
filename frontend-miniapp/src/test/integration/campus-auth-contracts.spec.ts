import { createPinia, setActivePinia } from 'pinia';
import { effectScope } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { useUserStore } from '@/store/modules/use-user-store';
import { useLogin } from '@/pages/login/composables/use-login';
import { useCommentPanel } from '@/pages/dish/composables/use-comment';
import { useReport } from '@/pages/dish/composables/use-report';
import { requireStudent } from '@/utils/student-access';
import { phoneLogin, sendPhoneCode } from '@/api/modules/auth';
import { getDishById } from '@/api/modules/dish';

const storage = new Map<string, unknown>();
const requests: any[] = [];
const scopes: ReturnType<typeof effectScope>[] = [];
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  request: jest.fn(),
  showToast: jest.fn(),
  showModal: jest.fn(),
  navigateTo: jest.fn(),
  reLaunch: jest.fn(),
  switchTab: jest.fn(),
};
const path = (request: any) => new URL(request.url).pathname;
const latest = (url: string) => requests.filter(request => path(request) === url).slice(-1)[0];
const ok = (data: unknown) => ({ statusCode: 200, data: { code: 200, data } });
const unauthorized = { statusCode: 401, data: { code: 401, message: '验证码无效或已过期' } };
function inScope<T>(run: () => T): T {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(run)!;
}
function signIn(canContribute?: boolean) {
  const user = useUserStore();
  user.token = 'member-access';
  user.refreshToken = 'member-refresh';
  user.userInfo = {
    id: 'member',
    nickname: '学生',
    capabilities: { canContribute },
  } as any;
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  storage.clear();
  requests.length = 0;
  (global as any).uni = uniMock;
  uniMock.request.mockImplementation(options => {
    requests.push(options);
    return { abort: jest.fn() };
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop());
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('a guest cannot contribute even with a stale verified profile in local state', async () => {
  const user = signIn(true);
  user.token = null;
  const panel = inScope(() => useCommentPanel(() => 'review'));
  panel.replyContent.value = '回复';
  expect(await panel.submitReply()).toBe(false);
  expect(uniMock.navigateTo).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/login/index' })
  );
  expect(uniMock.showModal).not.toHaveBeenCalled();
  expect(requests).toEqual([]);
});

test.each([undefined, false])(
  'a signed-in account with capability %s is routed to identity verification',
  async capability => {
    signIn(capability);
    const panel = inScope(() => useCommentPanel(() => 'review'));
    panel.replyContent.value = '回复';
    expect(await panel.submitReply()).toBe(false);
    expect(panel.replyContent.value).toBe('回复');
    expect(requests).toEqual([]);
    const modal = uniMock.showModal.mock.calls[0][0];
    modal.success({ confirm: false });
    expect(uniMock.navigateTo).not.toHaveBeenCalled();
    modal.success({ confirm: true });
    expect(uniMock.navigateTo).toHaveBeenCalledWith({ url: '/pages/profile/identity' });
  }
);

test('a verified account posts through the real authenticated comment contract', async () => {
  signIn(true);
  expect(requireStudent()).toBe(true);
  const panel = inScope(() => useCommentPanel(() => 'review'));
  panel.replyContent.value = '  回复  ';
  const saved = panel.submitReply();
  await flushPromises();
  expect(latest('/comments')).toMatchObject({
    method: 'POST',
    header: { Authorization: 'Bearer member-access' },
    data: { reviewId: 'review', content: '回复' },
  });
  const comment = {
    id: 'saved',
    reviewId: 'review',
    content: '回复',
    createdAt: '2026-10-09T00:00:00Z',
  };
  latest('/comments').success(ok(comment));
  await flushPromises();
  latest('/comments/review').success(
    ok({
      items: [comment],
      canReply: true,
      meta: { page: 1, totalPages: 1 },
    })
  );
  expect(await saved).toBe(true);
  expect(panel.replyContent.value).toBe('');
  expect(uniMock.showModal).not.toHaveBeenCalled();
});

test('the report composer uses the same guest, unverified and verified gate', () => {
  const report = inScope(() => useReport());
  report.openReportModal('review', 'review');
  expect(report.isReportVisible.value).toBe(false);
  signIn(false);
  report.openReportModal('review', 'review');
  expect(report.isReportVisible.value).toBe(false);
  signIn(true);
  report.openReportModal('review', 'review');
  expect(report.isReportVisible.value).toBe(true);
  expect(requests).toEqual([]);
});

test('auth:none phone authentication failure never refreshes or clears an existing session', async () => {
  const user = signIn(true);
  const session = user.sessionVersion;
  const login = phoneLogin('challenge', '000000');
  const rejected = expect(login).rejects.toMatchObject({ statusCode: 401 });
  await flushPromises();
  expect(latest('/auth/phone/login')).toMatchObject({
    method: 'POST',
    data: { challengeId: 'challenge', code: '000000' },
  });
  expect(latest('/auth/phone/login').header.Authorization).toBeUndefined();
  latest('/auth/phone/login').success(unauthorized);
  await rejected;
  expect(requests).toHaveLength(1);
  expect(user.token).toBe('member-access');
  expect(user.sessionVersion).toBe(session);
  expect(uniMock.reLaunch).not.toHaveBeenCalled();
});

test('phone challenge requests normalize a domestic phone number without attaching a session', async () => {
  signIn(true);
  const sent = sendPhoneCode(' 138-0013-8000 ');
  await flushPromises();
  const request = latest('/auth/phone/challenges');
  expect(request.data).toEqual({ phone: '+8613800138000' });
  expect(request.header.Authorization).toBeUndefined();
  request.success(ok({ challengeId: 'challenge', expiresIn: 300, retryAfter: 60 }));
  await sent;
});

test('an optional public read falls back to anonymous after failed refresh without forcing login', async () => {
  const user = signIn(true);
  const read = getDishById('public');
  await flushPromises();
  latest('/dishes/public').success(unauthorized);
  expect(latest('/auth/refresh').header.Authorization).toBe('Bearer member-refresh');
  latest('/auth/refresh').success(unauthorized);
  await flushPromises();
  expect(requests.map(path)).toEqual(['/dishes/public', '/auth/refresh', '/dishes/public']);
  expect(latest('/dishes/public').header.Authorization).toBeUndefined();
  latest('/dishes/public').success(ok({ id: 'public', name: '公开菜品' }));
  await expect(read).resolves.toMatchObject({ data: { id: 'public' } });
  expect(user.isLoggedIn).toBe(false);
  expect(uniMock.reLaunch).not.toHaveBeenCalled();
  expect(uniMock.navigateTo).not.toHaveBeenCalled();
});

test('anonymous fallback stops after one failed retry without a login redirect', async () => {
  const read = getDishById('public');
  const rejected = expect(read).rejects.toMatchObject({ statusCode: 401 });
  await flushPromises();
  latest('/dishes/public').success(unauthorized);
  await flushPromises();
  latest('/dishes/public').success(unauthorized);
  await rejected;
  expect(requests).toHaveLength(2);
  expect(uniMock.reLaunch).not.toHaveBeenCalled();
});

test('a late optional refresh failure cannot log out or retry under a newer login', async () => {
  const user = signIn(true);
  const read = getDishById('public');
  const rejected = expect(read).rejects.toThrow('登录会话已变更');
  await flushPromises();
  latest('/dishes/public').success(unauthorized);
  const refresh = latest('/auth/refresh');
  user.logoutAction();
  user.token = 'new-account';
  refresh.success(unauthorized);
  await rejected;
  expect(requests).toHaveLength(2);
  expect(user.token).toBe('new-account');
  expect(uniMock.reLaunch).not.toHaveBeenCalled();
});

test('phone login accepts an internal user ID without OpenID and consumes the login form once', async () => {
  const login = inScope(() => useLogin());
  const first = login.phoneLogin('challenge', '123456');
  const duplicate = login.phoneLogin('challenge', '123456');
  await flushPromises();
  expect(requests.map(path)).toEqual(['/auth/phone/login']);
  latest('/auth/phone/login').success(
    ok({
      token: { accessToken: 'phone-access', refreshToken: 'phone-refresh' },
      user: { id: 'phone-user', nickname: '手机号账号' },
    })
  );
  await flushPromises();
  expect(latest('/user/profile').header.Authorization).toBe('Bearer phone-access');
  latest('/user/profile').success(
    ok({
      id: 'phone-user',
      nickname: '手机号账号',
      capabilities: { canContribute: false },
    })
  );
  await Promise.all([first, duplicate]);
  expect(useUserStore().isLoggedIn).toBe(true);
  expect(useUserStore().userInfo).toMatchObject({ id: 'phone-user' });
  expect(useUserStore().userInfo?.openId).toBeUndefined();
  expect(login.submitted.value).toBe(true);
  await login.phoneLogin('challenge', '123456');
  expect(requests.filter(request => path(request) === '/auth/phone/login')).toHaveLength(1);
  jest.advanceTimersByTime(500);
  expect(uniMock.switchTab).toHaveBeenCalledTimes(1);
  expect(uniMock.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
});
