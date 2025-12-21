import { createPinia, setActivePinia } from 'pinia';

jest.mock('@/api/modules/user', () => ({
  wechatLogin: jest.fn(),
  getUserProfile: jest.fn(),
}));

const mockGetStorageSync = jest.fn();
const mockSetStorageSync = jest.fn();
const mockRemoveStorageSync = jest.fn();
const mockShowToast = jest.fn();

function setupUniMock() {
  (global as any).uni = {
    getStorageSync: mockGetStorageSync,
    setStorageSync: mockSetStorageSync,
    removeStorageSync: mockRemoveStorageSync,
    showToast: mockShowToast,
  };
}

// Ensure `uni` exists before loading the store module.
setupUniMock();

const { useUserStore } = require('@/store/modules/use-user-store');
const { getUserProfile, wechatLogin } = require('@/api/modules/user');

describe('useUserStore (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: empty storage
    mockGetStorageSync.mockImplementation(() => '');

    setActivePinia(createPinia());
  });

  function getStore() {
    return useUserStore();
  }

  it('initializes `userInfo` as null when stored JSON is invalid', () => {
    mockGetStorageSync.mockImplementation((key: string) => {
      if (key === 'userInfo') return '{bad json';
      return '';
    });

    const store = getStore();
    expect(store.userInfo).toBeNull();
    expect(store.nickname).toBe('游客');
  });

  it('loginAction: user missing id/openId -> fetch profile; fetch fails -> cleans up and throws 用户信息不完整', async () => {
    const store = getStore();

    (wechatLogin as jest.Mock).mockResolvedValue({
      data: {
        token: { accessToken: 'new-token' },
        user: { nickname: 'U' },
      },
    });

    (getUserProfile as jest.Mock).mockRejectedValue(new Error('Profile error'));

    await expect(store.loginAction('code')).rejects.toThrow('用户信息不完整');

    expect(store.token).toBeNull();
    expect(store.userInfo).toBeNull();
    expect(mockRemoveStorageSync).toHaveBeenCalledWith('token');
    expect(mockRemoveStorageSync).toHaveBeenCalledWith('userInfo');
  });

  it('loginAction: no user returned -> fetch profile fails -> clears stored token', async () => {
    const store = getStore();

    (wechatLogin as jest.Mock).mockResolvedValue({
      data: {
        token: { accessToken: 'new-token' },
        user: null,
      },
    });

    (getUserProfile as jest.Mock).mockRejectedValue(new Error('Fetch Error'));

    await expect(store.loginAction('code')).rejects.toThrow('Fetch Error');
    expect(store.token).toBeNull();
    expect(mockRemoveStorageSync).toHaveBeenCalledWith('token');
  });

  it('fetchProfileAction: response code != 200 triggers toast and rethrow', async () => {
    const store = getStore();
    store.token = 'valid-token';

    (getUserProfile as jest.Mock).mockResolvedValue({
      code: 500,
      message: 'server error',
      data: null,
    });

    await expect(store.fetchProfileAction()).rejects.toThrow('server error');
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '用户信息刷新失败', icon: 'none' })
    );
  });

  it('updateLocalUserInfo merges fields without dropping existing ones', () => {
    const store = getStore();

    store.userInfo = {
      id: '1',
      openId: 'o1',
      nickname: 'Old',
      avatar: 'a',
      preferences: {},
      allergens: [],
      myFavoriteDishes: [],
      myReviews: [],
      myComments: [],
      createdAt: 't1',
      updatedAt: 't2',
    };

    store.updateLocalUserInfo({ nickname: 'New' });

    expect(store.userInfo).toEqual(
      expect.objectContaining({ id: '1', openId: 'o1', nickname: 'New' })
    );
    expect(mockSetStorageSync).toHaveBeenCalledWith('userInfo', expect.any(String));
  });
});
