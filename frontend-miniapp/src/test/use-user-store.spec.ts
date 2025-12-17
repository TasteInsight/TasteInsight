import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from '@/store/modules/use-user-store';
import { wechatLogin, getUserProfile } from '@/api/modules/user';

// Mock API modules
jest.mock('@/api/modules/user', () => ({
  wechatLogin: jest.fn(),
  getUserProfile: jest.fn(),
}));

// Mock uni-app APIs
const mockGetStorageSync = jest.fn();
const mockSetStorageSync = jest.fn();
const mockRemoveStorageSync = jest.fn();
const mockShowToast = jest.fn();

(global as any).uni = {
  getStorageSync: mockGetStorageSync,
  setStorageSync: mockSetStorageSync,
  removeStorageSync: mockRemoveStorageSync,
  showToast: mockShowToast,
};

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockGetStorageSync.mockReturnValue(''); // Default empty storage
  });

  describe('State & Getters', () => {
    it('should initialize with default values', () => {
      const store = useUserStore();
      expect(store.token).toBeNull();
      expect(store.userInfo).toBeNull();
      expect(store.isLoggedIn).toBe(false);
      expect(store.nickname).toBe('游客');
      expect(store.avatar).toBe('/static/images/default-avatar.png');
    });

    it('should initialize from storage', () => {
      mockGetStorageSync.mockImplementation((key: string) => {
        if (key === 'token') return 'stored-token';
        if (key === 'userInfo') return JSON.stringify({ nickname: 'Stored User', avatar: 'stored-avatar.png' });
        return '';
      });

      const store = useUserStore();
      expect(store.token).toBe('stored-token');
      expect(store.userInfo).toEqual(expect.objectContaining({ nickname: 'Stored User' }));
      expect(store.isLoggedIn).toBe(true);
      expect(store.nickname).toBe('Stored User');
      expect(store.avatar).toBe('stored-avatar.png');
    });
  });

  describe('Actions', () => {
    describe('loginAction', () => {
      it('should login successfully with user info returned', async () => {
        const store = useUserStore();
        const mockUser = { id: '1', nickname: 'Test User', avatar: 'avatar.png' };
        const mockLoginResponse = {
          data: {
            token: { accessToken: 'new-token', refreshToken: 'refresh-token' },
            user: mockUser,
          },
        };
        const mockProfileResponse = { code: 200, data: mockUser };

        (wechatLogin as jest.Mock).mockResolvedValue(mockLoginResponse);
        (getUserProfile as jest.Mock).mockResolvedValue(mockProfileResponse);

        await store.loginAction('test-code');

        expect(store.token).toBe('new-token');
        expect(store.refreshToken).toBe('refresh-token');
        expect(store.userInfo).toEqual(expect.objectContaining(mockUser));
        expect(mockSetStorageSync).toHaveBeenCalledWith('token', 'new-token');
        expect(mockSetStorageSync).toHaveBeenCalledWith('refreshToken', 'refresh-token');
        expect(mockSetStorageSync).toHaveBeenCalledWith('userInfo', expect.any(String));
      });

      it('should login successfully and fetch profile if user info missing', async () => {
        const store = useUserStore();
        const mockUser = { id: '1', nickname: 'Fetched User' };
        const mockLoginResponse = {
          data: {
            token: { accessToken: 'new-token' },
            user: null,
          },
        };
        const mockProfileResponse = { code: 200, data: mockUser };

        (wechatLogin as jest.Mock).mockResolvedValue(mockLoginResponse);
        (getUserProfile as jest.Mock).mockResolvedValue(mockProfileResponse);

        await store.loginAction('test-code');

        expect(store.token).toBe('new-token');
        expect(store.userInfo).toEqual(expect.objectContaining(mockUser));
        expect(getUserProfile).toHaveBeenCalled();
      });

      it('should throw error if no token returned', async () => {
        const store = useUserStore();
        (wechatLogin as jest.Mock).mockResolvedValue({ data: {} });

        await expect(store.loginAction('test-code')).rejects.toThrow('登录失败：未获取到有效的 token');
        expect(store.token).toBeNull();
      });

      it('should logout on login failure', async () => {
        const store = useUserStore();
        (wechatLogin as jest.Mock).mockRejectedValue(new Error('Network Error'));

        await expect(store.loginAction('test-code')).rejects.toThrow('Network Error');
        expect(store.token).toBeNull();
        expect(mockRemoveStorageSync).toHaveBeenCalled();
      });
    });

    describe('logoutAction', () => {
      it('should clear state and storage', () => {
        const store = useUserStore();
        store.token = 'some-token';
        store.userInfo = { id: '1' } as any;

        store.logoutAction();

        expect(store.token).toBeNull();
        expect(store.userInfo).toBeNull();
        expect(mockRemoveStorageSync).toHaveBeenCalledWith('token');
        expect(mockRemoveStorageSync).toHaveBeenCalledWith('refreshToken');
        expect(mockRemoveStorageSync).toHaveBeenCalledWith('userInfo');
      });
    });

    describe('fetchProfileAction', () => {
      it('should fetch and update user info', async () => {
        const store = useUserStore();
        store.token = 'valid-token'; // Simulate logged in
        const mockUser = { id: '1', nickname: 'Updated User' };
        (getUserProfile as jest.Mock).mockResolvedValue({ code: 200, data: mockUser });

        await store.fetchProfileAction();

        expect(store.userInfo).toEqual(mockUser);
        expect(mockSetStorageSync).toHaveBeenCalledWith('userInfo', JSON.stringify(mockUser));
      });

      it('should warn if not logged in', async () => {
        const store = useUserStore();
        store.token = null;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        await store.fetchProfileAction();

        expect(consoleSpy).toHaveBeenCalledWith('用户未登录，无法获取用户信息');
        expect(getUserProfile).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should handle fetch error', async () => {
        const store = useUserStore();
        store.token = 'valid-token';
        (getUserProfile as jest.Mock).mockRejectedValue(new Error('Fetch Error'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        await expect(store.fetchProfileAction()).rejects.toThrow('Fetch Error');
        expect(mockShowToast).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('updateLocalUserInfo', () => {
      it('should update local state and storage', () => {
        const store = useUserStore();
        store.userInfo = { id: '1', nickname: 'Old Name' } as any;

        store.updateLocalUserInfo({ nickname: 'New Name' });

        expect(store.userInfo?.nickname).toBe('New Name');
        expect(mockSetStorageSync).toHaveBeenCalledWith('userInfo', expect.stringContaining('New Name'));
      });

      it('should do nothing if userInfo is null', () => {
        const store = useUserStore();
        store.userInfo = null;

        store.updateLocalUserInfo({ nickname: 'New Name' });

        expect(store.userInfo).toBeNull();
        expect(mockSetStorageSync).not.toHaveBeenCalled();
      });
    });
  });
});
