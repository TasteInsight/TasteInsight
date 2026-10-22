import { t } from '@/i18n';
import { computed, reactive, ref, onMounted, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { uploadImage } from '@/api/modules/upload';
import { useSettingsProfile } from './use-settings-profile';
import { moderationImageIdentity } from '@/utils/moderation-image';

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
      const submitted = userInfo?.publicProfileSubmission?.fields;
      form.avatar = submitted?.avatar ?? userInfo?.avatar ?? '';
      form.nickname = submitted?.nickname ?? userInfo?.nickname ?? '';
    },
    form,
    'personal',
    value =>
      JSON.stringify(value, (key, field) =>
        key === 'avatar' && typeof field === 'string' ? moderationImageIdentity(field) : field
      )
  );

  const profileSubmission = computed(() =>
    profile.initialized.value ? userStore.userInfo?.publicProfileSubmission : null
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
        uni.showLoading({ title: t('account.settings.uploading2') });
        try {
          const result = await uploadImage(filePath);
          if (!ownsSelection()) return;
          form.avatar = result.url;
          uni.showToast({ title: t('account.settings.photoUploaded'), icon: 'success' });
        } catch (error) {
          if (!ownsSelection()) return;
          console.error('上传头像失败:', error);
          uni.showToast({ title: t('account.settings.unableToUploadPhoto'), icon: 'none' });
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
              if (ownsSelection())
                uni.showToast({
                  title: t('account.settings.unableToOpenCropEditor'),
                  icon: 'none',
                });
              finish();
            },
          });
        },
        fail: err => {
          if (ownsSelection() && !String(err.errMsg || '').includes('cancel')) {
            console.error('选择图片失败:', err);
            uni.showToast({ title: t('account.settings.unableToSelectImage'), icon: 'none' });
          }
          finish();
        },
      });
    });
  }

  async function handleSave(): Promise<boolean> {
    if (!profile.canEdit.value || uploading.value || selecting.value) return false;
    if (!form.nickname.trim()) {
      uni.showToast({ title: t('account.settings.enterNickname'), icon: 'none' });
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

  return { form, ...profile, profileSubmission, uploading, selecting, chooseAvatar, handleSave };
}
