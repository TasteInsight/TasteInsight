import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProfile } from '@/pages/profile/composables/use-profile';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';

jest.mock('@/api/modules/user');

const updateUserProfileMock = updateUserProfile as jest.Mock;

describe('use-profile composable', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    // global uni mocks
    (global as any).uni = {
      showToast: jest.fn(),
      showModal: jest.fn(),
      reLaunch: jest.fn(),
      setStorageSync: jest.fn(),
      getStorageSync: jest.fn().mockReturnValue(null),
      removeStorageSync: jest.fn(),
    } as any;
    // silence Vue onMounted warnings when composable is used outside setup in unit tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  test('fetchProfile success and failure', async () => {
    const userStore = useUserStore();
    userStore.fetchProfileAction = jest.fn().mockResolvedValue(undefined);

    const p = useProfile();
    await p.fetchProfile();
    expect(userStore.fetchProfileAction).toHaveBeenCalled();
    expect(p.loading.value).toBe(false);
    expect(p.error.value).toBeNull();

    // failure - fetchProfileAction rejects; fetchProfile handles and sets error (does not rethrow)
    userStore.fetchProfileAction = jest.fn().mockRejectedValue(new Error('boom'));
    await p.fetchProfile();
    expect(p.error.value).toBe('boom');
  });

  test('updateProfile success and failure paths', async () => {
    const userStore = useUserStore();
    userStore.updateLocalUserInfo = jest.fn();

    // success
    updateUserProfileMock.mockResolvedValue({ data: { id: 'u1', nickname: 'N' } });
    const p = useProfile();
    const ok = await p.updateProfile({} as any);
    expect(ok).toBe(true);
    expect(userStore.updateLocalUserInfo).toHaveBeenCalledWith({ id: 'u1', nickname: 'N' });
    expect((global as any).uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));

    // failure
    updateUserProfileMock.mockRejectedValue(new Error('api fail'));
    const p2 = useProfile();
    const ok2 = await p2.updateProfile({} as any);
    expect(ok2).toBe(false);
    expect(p2.error.value).toBe('api fail');
    expect((global as any).uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
  });

  test('handleLogout confirm and cancel flows', async () => {
    const userStore = useUserStore();
    userStore.logoutAction = jest.fn();

    // cancel flow
    (global as any).uni.showModal = jest.fn().mockImplementation(({ success }: any) => success({ confirm: false }));
    const p = useProfile();
    p.handleLogout();
    expect(userStore.logoutAction).not.toHaveBeenCalled();

    // confirm flow
    (global as any).uni.showModal = jest.fn().mockImplementation(({ success }: any) => success({ confirm: true }));
    jest.useFakeTimers();
    p.handleLogout();
    expect(userStore.logoutAction).toHaveBeenCalled();
    expect((global as any).uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
    // run timers to trigger reLaunch
    jest.advanceTimersByTime(500);
    expect((global as any).uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
    jest.useRealTimers();
  });

  test('onMounted fetch when logged in', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const userStore = useUserStore();
    // mark logged in
    (userStore as any).token = 'tok';

    userStore.fetchProfileAction = jest.fn().mockResolvedValue(undefined);

    mount({
      template: '<div />',
      setup() {
        useProfile();
        return {};
      }
    }, { global: { plugins: [pinia] } });

    // allow microtasks
    await Promise.resolve();
    expect(userStore.fetchProfileAction).toHaveBeenCalled();
  });
});