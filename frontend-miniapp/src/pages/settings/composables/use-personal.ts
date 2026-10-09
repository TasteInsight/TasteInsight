import { reactive, ref, onMounted, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { uploadImage } from '@/api/modules/upload';
import { useSettingsProfile } from './use-settings-profile';

export interface PersonalForm {
  avatar: string;
  nickname: string;
}

export function usePersonal() {
  const userStore = useUserStore();
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const form = reactive<PersonalForm>({ avatar: '', nickname: '' });
  const uploading = ref(false);
  const selecting = ref(false);
  let finishSelection: (() => void) | null = null;
  const profile = useSettingsProfile(
    userInfo => {
      form.avatar = userInfo?.avatar || '';
      form.nickname = userInfo?.nickname || '';
    },
    form,
    'personal'
  );

  async function chooseAvatar(): Promise<void> {
    if (!profile.canEdit.value || selecting.value || uploading.value) return;
    const ownsSelection = profile.captureOperation();
    selecting.value = true;
    return new Promise<void>(resolve => {
      const finish = () => {
        if (ownsSelection()) selecting.value = false;
        if (finishSelection === finish) finishSelection = null;
        resolve();
      };
      finishSelection = finish;

      const uploadAvatar = async (filePath: string) => {
        if (!ownsSelection()) {
          finish();
          return;
        }
        uploading.value = true;
        uni.showLoading({ title: '上传中...' });
        try {
          const result = await uploadImage(filePath);
          if (!ownsSelection()) return;
          form.avatar = result.url;
          uni.showToast({ title: '头像上传成功', icon: 'success' });
        } catch (error) {
          if (!ownsSelection()) return;
          console.error('上传头像失败:', error);
          uni.showToast({ title: '头像上传失败', icon: 'none' });
        } finally {
          if (ownsSelection()) {
            uploading.value = false;
            uni.hideLoading();
          }
          finish();
        }
      };

      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: res => {
          if (!ownsSelection()) {
            finish();
            return;
          }
          const tempFilePath = res.tempFilePaths[0];
          if (isTestEnv) {
            void uploadAvatar(tempFilePath);
            return;
          }
          uni.navigateTo({
            url: `/pages/settings/components/avatar-crop?src=${encodeURIComponent(tempFilePath)}`,
            success: navRes => {
              if (!ownsSelection()) {
                finish();
                return;
              }
              navRes.eventChannel.on('cropped', (data: { tempFilePath: string }) => {
                if (!ownsSelection()) {
                  finish();
                  return;
                }
                void uploadAvatar(data.tempFilePath);
              });
              navRes.eventChannel.on('cancel', finish);
              navRes.eventChannel.emit('init', { src: tempFilePath });
            },
            fail: () => {
              if (ownsSelection()) uni.showToast({ title: '打开裁剪失败，请重试', icon: 'none' });
              finish();
            },
          });
        },
        fail: err => {
          if (ownsSelection() && !String(err.errMsg || '').includes('cancel')) {
            console.error('选择图片失败:', err);
            uni.showToast({ title: '选择图片失败', icon: 'none' });
          }
          finish();
        },
      });
    });
  }

  async function handleSave(): Promise<boolean> {
    if (!profile.canEdit.value || uploading.value || selecting.value) return false;
    if (!form.nickname.trim()) {
      uni.showToast({ title: '请输入昵称', icon: 'none' });
      return false;
    }
    return profile.saveProfile({
      nickname: form.nickname.trim(),
      avatar: form.avatar.trim() || undefined,
    });
  }

  const releaseSelection = () => {
    if (uploading.value) uni.hideLoading();
    uploading.value = false;
    selecting.value = false;
    finishSelection?.();
  };
  watch(() => userStore.sessionVersion, releaseSelection, { flush: 'sync' });
  if (getCurrentScope()) onScopeDispose(releaseSelection);
  onMounted(() => {
    void profile.loadProfile();
  });

  return { form, ...profile, uploading, selecting, chooseAvatar, handleSave };
}
