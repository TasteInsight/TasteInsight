import { effectScope, reactive, type EffectScope } from 'vue';
import { useSettingsProfile } from '@/pages/settings/composables/use-settings-profile';
import { useUserStore } from '@/store/modules/use-user-store';

jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));

const scopes: EffectScope[] = [];
let store: any;
const storage = new Map<string, unknown>();

function setup() {
  const form = reactive({ nickname: '' });
  const scope = effectScope();
  scopes.push(scope);
  const state = scope.run(() =>
    useSettingsProfile(
      profile => {
        form.nickname = profile?.nickname || '';
      },
      form,
      'personal'
    )
  )!;
  return { state, form, scope };
}

beforeEach(() => {
  jest.useFakeTimers();
  storage.clear();
  store = reactive({
    sessionVersion: 0,
    isLoggedIn: true,
    userInfo: { id: 'a', nickname: '已保存的昵称' },
    fetchProfileAction: jest.fn().mockResolvedValue(undefined),
    updateProfileAction: jest.fn().mockResolvedValue(undefined),
  });
  (useUserStore as unknown as jest.Mock).mockReturnValue(store);
  Object.assign(uni, {
    getStorageSync: jest.fn(key => storage.get(key)),
    setStorageSync: jest.fn((key, value) => storage.set(key, value)),
    removeStorageSync: jest.fn(key => storage.delete(key)),
    showModal: jest.fn(),
    showToast: jest.fn(),
    navigateBack: jest.fn(),
  });
});

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop());
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('rejects saves after initialization fails and opens editing only after a successful retry', async () => {
  store.fetchProfileAction.mockRejectedValueOnce(new Error('读取失败'));
  const { state, form } = setup();
  expect(await state.loadProfile()).toBe(false);
  expect(state.loadError.value).toBe('读取失败');
  expect(await state.saveProfile({ nickname: '覆盖' })).toBe(false);
  expect(store.updateProfileAction).not.toHaveBeenCalled();
  expect(await state.loadProfile()).toBe(true);
  expect(form.nickname).toBe('已保存的昵称');
  expect(state.initialized.value).toBe(true);
  expect(state.dirty.value).toBe(false);
  form.nickname = '新昵称';
  expect(state.dirty.value).toBe(true);
});

it('locks a completed save until navigation and updates its dirty baseline', async () => {
  const { state, form } = setup();
  await state.loadProfile();
  form.nickname = '新昵称';
  expect(await state.saveProfile({ nickname: form.nickname })).toBe(true);
  expect(state.saved.value).toBe(true);
  expect(state.dirty.value).toBe(false);
  expect(await state.saveProfile({ nickname: '重复' })).toBe(false);
  expect(store.updateProfileAction).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000);
  expect(uni.navigateBack).toHaveBeenCalledTimes(1);
});

it('invalidates the baseline and delayed navigation on an account switch', async () => {
  const { state } = setup();
  await state.loadProfile();
  await state.saveProfile({ nickname: '新昵称' });
  store.sessionVersion++;
  store.userInfo = { id: 'b', nickname: '另一个账户' };
  expect(state.initialized.value).toBe(false);
  expect(await state.saveProfile({ nickname: '不能沿用旧基线' })).toBe(false);
  jest.advanceTimersByTime(1000);
  expect(uni.navigateBack).not.toHaveBeenCalled();
});

it('restores an account-owned draft after a page is unloaded', async () => {
  const first = setup();
  await first.state.loadProfile();
  first.form.nickname = '尚未保存';
  first.scope.stop();
  const second = setup();
  await second.state.loadProfile();
  expect(second.form.nickname).toBe('尚未保存');
  expect(second.state.dirty.value).toBe(true);
  store.sessionVersion++;
  store.userInfo = { id: 'b', nickname: '账户B' };
  const nextAccount = setup();
  await nextAccount.state.loadProfile();
  expect(nextAccount.form.nickname).toBe('账户B');
});

it('only confirms changed drafts and preserves changes when leaving is canceled', async () => {
  const { state, form } = setup();
  await state.loadProfile();
  expect(await state.requestLeave()).toBe(true);
  expect(uni.showModal).not.toHaveBeenCalled();
  form.nickname = '未保存';
  (uni.showModal as jest.Mock).mockImplementation(options => options.success({ confirm: false }));
  expect(await state.requestLeave()).toBe(false);
  expect(state.dirty.value).toBe(true);
  expect(form.nickname).toBe('未保存');
  (uni.showModal as jest.Mock).mockImplementation(options => options.success({ confirm: true }));
  expect(await state.requestLeave()).toBe(true);
  expect(state.dirty.value).toBe(false);
});
