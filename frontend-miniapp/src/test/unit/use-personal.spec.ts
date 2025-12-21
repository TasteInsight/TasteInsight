import { usePersonal } from '@/pages/settings/composables/use-personal';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import { uploadImage } from '@/api/modules/upload';
import { reactive, ref } from 'vue';

// Mock Store
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: jest.fn(),
}));

// Mock API
jest.mock('@/api/modules/user', () => ({
  updateUserProfile: jest.fn(),
}));

// Mock Upload API
jest.mock('@/api/modules/upload', () => ({
  uploadImage: jest.fn(),
}));

// Mock Vue onMounted
jest.mock('vue', () => {
  const originalVue = jest.requireActual('vue');
  return {
    ...originalVue,
    onMounted: jest.fn((fn) => fn()),
  };
});

// Mock global.uni
(global as any).uni = {
  showToast: jest.fn(),
  chooseImage: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
};

describe('usePersonal', () => {
  let mockStore: any;

  beforeEach(() => {
    mockStore = reactive({
      userInfo: {
        nickname: 'Old Nickname',
        avatar: 'old-avatar.jpg',
      },
      fetchProfileAction: jest.fn().mockResolvedValue(undefined),
      updateLocalUserInfo: jest.fn(),
    });
    (useUserStore as unknown as jest.Mock).mockReturnValue(mockStore);
    jest.clearAllMocks();
  });

  it('should load personal info on mount', async () => {
    const { form, loading } = usePersonal();
    
    expect(loading.value).toBe(true);
    await new Promise(process.nextTick);

    expect(mockStore.fetchProfileAction).toHaveBeenCalled();
    expect(form.nickname).toBe('Old Nickname');
    expect(form.avatar).toBe('old-avatar.jpg');
    expect(loading.value).toBe(false);
  });

  it('should handle save success', async () => {
    const { form, handleSave, saving } = usePersonal();
    await new Promise(process.nextTick); // Wait for load

    form.nickname = 'New Nickname';
    
    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 200,
      data: { nickname: 'New Nickname', avatar: 'old-avatar.jpg' },
    });

    const result = await handleSave();

    expect(saving.value).toBe(false);
    expect(result).toBe(true);
    expect(updateUserProfile).toHaveBeenCalledWith({
      nickname: 'New Nickname',
      avatar: 'old-avatar.jpg',
    });
    expect(mockStore.updateLocalUserInfo).toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '保存成功' }));
  });

  it('should handle save failure', async () => {
    const { form, handleSave, saving } = usePersonal();
    await new Promise(process.nextTick);

    form.nickname = 'New Nickname';
    
    (updateUserProfile as jest.Mock).mockResolvedValue({
      code: 500,
      message: 'Server Error',
    });

    const result = await handleSave();

    expect(saving.value).toBe(false);
    expect(result).toBe(false);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Server Error' }));
  });

  it('should validate form', async () => {
    const { form, handleSave } = usePersonal();
    await new Promise(process.nextTick);

    form.nickname = ''; // Empty nickname

    const result = await handleSave();

    expect(result).toBe(false);
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '请输入昵称' }));
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it('should handle choose avatar success', async () => {
    const { chooseAvatar, form, uploading } = usePersonal();
    
    (uploadImage as jest.Mock).mockResolvedValue({
      url: 'uploaded-avatar-url.jpg',
      filename: 'uploaded-avatar.jpg'
    });
    
    (uni.chooseImage as jest.Mock).mockImplementation((options) => {
      options.success({ tempFilePaths: ['temp-avatar.jpg'] });
    });

    await chooseAvatar();

    expect(uploadImage).toHaveBeenCalledWith('temp-avatar.jpg');
    expect(form.avatar).toBe('uploaded-avatar-url.jpg');
    expect(uploading.value).toBe(false);
    expect(uni.showLoading).toHaveBeenCalledWith({ title: '上传中...' });
    expect(uni.hideLoading).toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith({ title: '头像上传成功', icon: 'success' });
  });

  it('should handle avatar upload failure', async () => {
    const { chooseAvatar, form, uploading } = usePersonal();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Wait for initial data load
    await new Promise(process.nextTick);
    const originalAvatar = form.avatar; // Save original value after load
    
    (uploadImage as jest.Mock).mockRejectedValue(new Error('Upload failed'));
    
    (uni.chooseImage as jest.Mock).mockImplementation((options) => {
      options.success({ tempFilePaths: ['temp-avatar.jpg'] });
    });

    await expect(chooseAvatar()).rejects.toThrow('Upload failed');

    expect(uploadImage).toHaveBeenCalledWith('temp-avatar.jpg');
    expect(form.avatar).toBe(originalAvatar); // Should remain unchanged on failure
    expect(uploading.value).toBe(false);
    expect(uni.showLoading).toHaveBeenCalledWith({ title: '上传中...' });
    expect(uni.hideLoading).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('上传头像失败:', expect.any(Error));
    expect(uni.showToast).toHaveBeenCalledWith({ title: '头像上传失败', icon: 'none' });
    
    consoleSpy.mockRestore();
  });

  it('should handle choose avatar failure', async () => {
    const { chooseAvatar } = usePersonal();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    (uni.chooseImage as jest.Mock).mockImplementation((options) => {
      options.fail(new Error('Choose failed'));
    });

    await expect(chooseAvatar()).rejects.toThrow('Choose failed');

    expect(consoleSpy).toHaveBeenCalledWith('选择图片失败:', expect.any(Error));
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '选择图片失败' }));
    
    consoleSpy.mockRestore();
  });
});
