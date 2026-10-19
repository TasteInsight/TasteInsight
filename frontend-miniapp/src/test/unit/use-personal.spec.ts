import { usePersonal } from '@/pages/settings/composables/use-personal';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import { uploadImage } from '@/api/modules/upload';
import { effectScope, reactive, ref } from 'vue';

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
    onMounted: jest.fn(fn => fn()),
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
      isLoggedIn: true,
      sessionVersion: 0,
      userInfo: {
        nickname: 'Old Nickname',
        avatar: 'old-avatar.jpg',
      },
      fetchProfileAction: jest.fn().mockResolvedValue(undefined),
      updateLocalUserInfo: jest.fn(),
      updateProfileAction: jest.fn(async (payload: any) => {
        const result = await updateUserProfile(payload);
        if (result.code !== 200 || !result.data) throw new Error(result.message || '保存失败');
        mockStore.updateLocalUserInfo(result.data);
      }),
    });
    (useUserStore as unknown as jest.Mock).mockReturnValue(mockStore);
    jest.clearAllMocks();
  });

  it('edits pending nickname and avatar without changing the public profile, and returns to approved defaults after clearing', async () => {
    mockStore.userInfo.publicProfileSubmission = {
      status: 'manual',
      fields: { nickname: '待审昵称', avatar: 'pending-avatar.jpg' },
      reason: null,
    };
    const state = usePersonal();
    await state.loadProfile();
    expect(state.form).toEqual({ nickname: '待审昵称', avatar: 'pending-avatar.jpg' });
    expect(mockStore.userInfo.nickname).toBe('Old Nickname');
    expect(mockStore.userInfo.avatar).toBe('old-avatar.jpg');
    expect(state.profileSubmission.value?.status).toBe('manual');
    mockStore.userInfo = {
      nickname: '审核通过的昵称',
      avatar: 'approved-avatar.jpg',
      publicProfileSubmission: null,
    };
    await state.loadProfile();
    expect(state.form).toEqual({ nickname: '审核通过的昵称', avatar: 'approved-avatar.jpg' });
    expect(state.profileSubmission.value).toBeNull();
  });

  it('keeps rejected submissions editable and exposes the reason in the personal editor', async () => {
    mockStore.userInfo.publicProfileSubmission = {
      status: 'rejected',
      fields: { nickname: '待修改昵称' },
      reason: '请修改昵称',
    };
    const state = usePersonal();
    await state.loadProfile();
    expect(state.form.nickname).toBe('待修改昵称');
    expect(state.form.avatar).toBe('old-avatar.jpg');
    expect(state.canEdit.value).toBe(true);
    expect(state.profileSubmission.value?.reason).toBe('请修改昵称');
    mockStore.sessionVersion++;
    expect(state.form).toEqual({ nickname: '', avatar: '' });
    expect(state.profileSubmission.value).toBeNull();
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
    await new Promise(process.nextTick);

    (uploadImage as jest.Mock).mockResolvedValue({
      url: 'uploaded-avatar-url.jpg',
      filename: 'uploaded-avatar.jpg',
    });

    (uni.chooseImage as jest.Mock).mockImplementation(options => {
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

    (uni.chooseImage as jest.Mock).mockImplementation(options => {
      options.success({ tempFilePaths: ['temp-avatar.jpg'] });
    });

    await expect(chooseAvatar()).resolves.toBeUndefined();

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
    await new Promise(process.nextTick);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    (uni.chooseImage as jest.Mock).mockImplementation(options => {
      options.fail(new Error('Choose failed'));
    });

    await expect(chooseAvatar()).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith('选择图片失败:', expect.any(Error));
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '选择图片失败' }));

    consoleSpy.mockRestore();
  });
  describe('pending avatar draft identity', () => {
    const asset = 'https://api.example.test/api/v1/content-moderation/images/avatar_asset_123456';
    const oldPreview = `${asset}?expires=1000&signature=old`;
    const freshPreview = `${asset}?expires=2000&signature=fresh`;
    const localAvatar =
      'https://api.example.test/api/v1/content-moderation/images/local_avatar_123456?expires=1000&signature=local';
    let storage: Map<string, string>;
    const scopes: ReturnType<typeof effectScope>[] = [];

    const createPage = () => {
      const scope = effectScope();
      scopes.push(scope);
      return { scope, state: scope.run(() => usePersonal())! };
    };

    beforeEach(() => {
      storage = new Map();
      Object.assign(uni, {
        getStorageSync: jest.fn(key => storage.get(key)),
        setStorageSync: jest.fn((key, value) => storage.set(key, value)),
        removeStorageSync: jest.fn(key => storage.delete(key)),
      });
      mockStore.userInfo.id = 'avatar-draft-user';
      mockStore.userInfo.publicProfileSubmission = {
        status: 'manual',
        fields: { nickname: '待审昵称', avatar: oldPreview },
        reason: null,
      };
    });

    afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));

    it.each([false, true])(
      'restores local edits with a refreshed preview, local avatar changed=%s',
      async changedAvatar => {
        const first = createPage();
        await first.state.loadProfile();
        first.state.form.nickname = '未保存的昵称';
        if (changedAvatar) first.state.form.avatar = localAvatar;
        first.scope.stop();
        mockStore.userInfo.publicProfileSubmission.fields.avatar = freshPreview;
        const next = createPage();
        await next.state.loadProfile();
        expect(next.state.form.nickname).toBe('未保存的昵称');
        expect(next.state.form.avatar).toBe(changedAvatar ? localAvatar : freshPreview);
        expect(next.state.restoredDraft.value).toBe(true);
        expect(next.state.dirty.value).toBe(true);
      }
    );

    it('restores existing drafts whose baseline contains the original signed URL', async () => {
      storage.set(
        'settings-draft:avatar-draft-user:personal',
        JSON.stringify({
          baseline: JSON.stringify({ avatar: oldPreview, nickname: '待审昵称' }),
          value: { avatar: oldPreview, nickname: '旧版本中未保存的昵称' },
        })
      );
      mockStore.userInfo.publicProfileSubmission.fields.avatar = freshPreview;
      const next = createPage();
      await next.state.loadProfile();
      expect(next.state.form).toEqual({ avatar: freshPreview, nickname: '旧版本中未保存的昵称' });
      expect(next.state.restoredDraft.value).toBe(true);
    });

    it.each(['nickname', 'avatar'])(
      'discards drafts when the server changes the actual %s',
      async field => {
        const first = createPage();
        await first.state.loadProfile();
        first.state.form.nickname = '未保存的昵称';
        first.scope.stop();
        const remote = mockStore.userInfo.publicProfileSubmission.fields;
        remote[field] = field === 'nickname' ? '其他页面修改的昵称' : localAvatar;
        const next = createPage();
        await next.state.loadProfile();
        expect(next.state.form).toEqual(remote);
        expect(next.state.restoredDraft.value).toBe(false);
        expect(next.state.dirty.value).toBe(false);
        expect(storage.has('settings-draft:avatar-draft-user:personal')).toBe(false);
      }
    );

    it('keeps query parameters significant for ordinary avatar URLs', async () => {
      mockStore.userInfo.publicProfileSubmission.fields.avatar =
        'https://cdn.example.test/avatar?version=1';
      const first = createPage();
      await first.state.loadProfile();
      first.state.form.nickname = '未保存的昵称';
      first.scope.stop();
      mockStore.userInfo.publicProfileSubmission.fields.avatar =
        'https://cdn.example.test/avatar?version=2';
      const next = createPage();
      await next.state.loadProfile();
      expect(next.state.form.nickname).toBe('待审昵称');
      expect(next.state.form.avatar).toBe('https://cdn.example.test/avatar?version=2');
      expect(next.state.restoredDraft.value).toBe(false);
      expect(storage.has('settings-draft:avatar-draft-user:personal')).toBe(false);
    });
  });
});
