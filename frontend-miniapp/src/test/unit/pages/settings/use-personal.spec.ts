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
    const mockStoreReturn: any = {
      fetchProfileAction: jest.fn() as unknown as jest.Mock<any, any>,
      userInfo: { avatar: '', nickname: '' },
      updateLocalUserInfo: jest.fn() as unknown as jest.Mock<any, any>,
    };
    (mockStoreReturn.fetchProfileAction as jest.Mock).mockResolvedValue(undefined);
    (mockStoreReturn.updateLocalUserInfo as jest.Mock).mockResolvedValue && (mockStoreReturn.updateLocalUserInfo as jest.Mock).mockResolvedValue(undefined);
    mockedUseUserStore.mockReturnValue(mockStoreReturn as any);
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
    mockStore.updateLocalUserInfo = jest.fn() as unknown as jest.Mock<any, any>;
    (mockStore.updateLocalUserInfo as jest.Mock).mockResolvedValue && (mockStore.updateLocalUserInfo as jest.Mock).mockResolvedValue(undefined);

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

  test('chooseAvatar navigates to crop page and uploads cropped image', async () => {
    // simulate real environment (not test env)
    process.env.NODE_ENV = 'development';
    const mockStore = mockedUseUserStore();
    mockStore.fetchProfileAction = jest.fn() as unknown as jest.Mock<any, any>;
    (mockStore.fetchProfileAction as jest.Mock).mockResolvedValue(undefined);

    let capturedChannel: any = null;
    (global as any).uni.navigateTo = jest.fn((opts: any) => {
      const handlers: Record<string, Function> = {};
      const eventChannel = {
        on: (name: string, fn: Function) => { handlers[name] = fn; },
        emit: (name: string, data: any) => { if (handlers[name]) handlers[name](data); },
      } as any;
      capturedChannel = eventChannel;
      opts.success({ eventChannel });
    });

    mockedUpload.mockResolvedValueOnce({ url: 'http://cropped' } as any);

    const comp = usePersonal();
    const p = comp.chooseAvatar();
    // simulate cropped event after handler registered
    capturedChannel.emit('cropped', { tempFilePath: 'crop.jpg' });
    await p;

    expect(mockedUpload).toHaveBeenCalledWith('crop.jpg');
    expect(comp.form.avatar).toBe('http://cropped');
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('chooseAvatar navigateTo fail rejects and shows toast', async () => {
    process.env.NODE_ENV = 'development';
    (global as any).uni.navigateTo = jest.fn((opts: any) => opts.fail({ errMsg: 'navfail' }));
    const comp = usePersonal();
    await expect(comp.chooseAvatar()).rejects.toEqual({ errMsg: 'navfail' });
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('onMounted calls fetch and handles fetchProfileAction error (loading cleared) when used inside a component', async () => {
    const { mount } = require('@vue/test-utils');
    const { defineComponent } = require('vue');

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockStore = mockedUseUserStore();
    mockStore.fetchProfileAction = jest.fn() as unknown as jest.Mock<any, any>;
    (mockStore.fetchProfileAction as jest.Mock).mockRejectedValue(new Error('fetchfail'));

    const wrapper = mount(defineComponent({
      setup() {
        const comp = usePersonal();
        return { comp };
      },
      template: '<div />',
    }));

    // allow onMounted async to run
    await new Promise((r) => setTimeout(r, 0));

    expect(mockStore.fetchProfileAction).toHaveBeenCalled();
    expect(wrapper.vm.comp.loading.value).toBe(false);
    spy.mockRestore();
  });
});
