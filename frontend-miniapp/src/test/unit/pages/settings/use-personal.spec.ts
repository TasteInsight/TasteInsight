jest.mock('@/store/modules/use-user-store');
jest.mock('@/api/modules/user');
jest.mock('@/api/modules/upload');

import { usePersonal } from '@/pages/settings/composables/use-personal';
import { uploadImage } from '@/api/modules/upload';
import { updateUserProfile } from '@/api/modules/user';
import { useUserStore as _useUserStore } from '@/store/modules/use-user-store';

const mockedUpload = uploadImage as jest.MockedFunction<typeof uploadImage>;
const mockedUpdate = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;
const mockedUseUserStore = _useUserStore as jest.MockedFunction<typeof _useUserStore>;

describe('usePersonal', () => {
  const originalEnv = process.env.NODE_ENV;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mockedUseUserStore.mockReturnValue({
      fetchProfileAction: jest.fn().mockResolvedValue(undefined),
      userInfo: { avatar: '', nickname: '' },
      updateLocalUserInfo: jest.fn(),
    } as any);
    // basic uni mocks
    (global as any).uni = (global as any).uni || {};
    (global as any).uni.showToast = jest.fn();
    (global as any).uni.showLoading = jest.fn();
    (global as any).uni.hideLoading = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('chooseAvatar uploads in test env and updates form on success', async () => {
    mockedUpload.mockResolvedValueOnce({ url: 'http://avatar' } as any);
    (global as any).uni.chooseImage = jest.fn((opts) => {
      opts.success({ tempFilePaths: ['tmp.jpg'] });
    });

    const comp = usePersonal();
    await comp.chooseAvatar();

    expect(mockedUpload).toHaveBeenCalledWith('tmp.jpg');
    expect(comp.form.avatar).toBe('http://avatar');
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('chooseAvatar shows toast on upload failure and rejects', async () => {
    mockedUpload.mockRejectedValueOnce(new Error('upfail'));
    (global as any).uni.chooseImage = jest.fn((opts) => {
      opts.success({ tempFilePaths: ['tmp.jpg'] });
    });

    const comp = usePersonal();
    await expect(comp.chooseAvatar()).rejects.toThrow('upfail');
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('handleSave validates nickname and returns false when empty', async () => {
    const comp = usePersonal();
    comp.form.nickname = '   ';
    const res = await comp.handleSave();
    expect(res).toBe(false);
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('handleSave success updates user and returns true', async () => {
    mockedUpdate.mockResolvedValueOnce({ code: 200, data: { nickname: 'n', avatar: 'a' } } as any);
    const mockStore = mockedUseUserStore();
    mockStore.updateLocalUserInfo = jest.fn();

    const comp = usePersonal();
    comp.form.nickname = 'n';
    comp.form.avatar = 'a';

    const res = await comp.handleSave();
    expect(res).toBe(true);
    expect(mockStore.updateLocalUserInfo).toHaveBeenCalled();
    expect((global as any).uni.showToast).toHaveBeenCalledWith({ title: '保存成功', icon: 'success' });
  });

  test('handleSave failure shows toast and returns false', async () => {
    mockedUpdate.mockResolvedValueOnce({ code: 400, message: 'Bad' } as any);

    const comp = usePersonal();
    comp.form.nickname = 'n';

    const res = await comp.handleSave();
    expect(res).toBe(false);
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });
});
