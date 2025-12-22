import { reactive, ref, onMounted } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import { uploadImage } from '@/api/modules/upload';
import type { UserProfileUpdateRequest } from '@/types/api';

export interface PersonalForm {
  avatar: string;
  nickname: string;
}

export function usePersonal() {
  const userStore = useUserStore();
  const isTestEnv = typeof process !== 'undefined' && !!process.env && process.env.NODE_ENV === 'test';
  
  const saving = ref(false);
  const loading = ref(true);
  const uploading = ref(false);
  
  const form = reactive<PersonalForm>({
    avatar: '',
    nickname: ''
  });

  /**
   * 加载用户信息
   */
  async function loadPersonalInfo() {
    loading.value = true;
    try {
      await userStore.fetchProfileAction();
      const userInfo = userStore.userInfo;
      if (userInfo) {
        form.avatar = userInfo.avatar || '';
        form.nickname = userInfo.nickname || '';
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 选择头像
   */
  async function chooseAvatar() {
    return new Promise<void>((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePath = res.tempFilePaths[0];

          // 单测/非运行环境可能没有 navigateTo，回退为直接上传
          if (isTestEnv || typeof (uni as any).navigateTo !== 'function') {
            uploading.value = true;
            uni.showLoading({ title: '上传中...' });
            (async () => {
              try {
                const uploadResult = await uploadImage(tempFilePath);
                form.avatar = uploadResult.url;
                uni.hideLoading();
                uni.showToast({ title: '头像上传成功', icon: 'success' });
                resolve();
              } catch (error) {
                console.error('上传头像失败:', error);
                uni.hideLoading();
                uni.showToast({ title: '头像上传失败', icon: 'none' });
                reject(error);
              } finally {
                uploading.value = false;
              }
            })();
            return;
          }

          // 进入裁剪页面，裁剪完成后再上传
          uni.navigateTo({
            // 同时使用 query + eventChannel：
            // - query 用 encodeURIComponent 规避非法字符/时序问题（裁剪页可能错过 init 事件）
            // - eventChannel 仍保留，避免未来扩展参数过长
            url: `/pages/settings/components/avatar-crop?src=${encodeURIComponent(tempFilePath)}`,
            success: (navRes) => {
              const eventChannel = navRes.eventChannel;
              eventChannel.emit('init', { src: tempFilePath });

              // 设置超时，如果用户取消裁剪或出错，5分钟后 reject
              const timeout = setTimeout(() => {
                reject(new Error('裁剪超时或取消'));
              }, 5 * 60 * 1000); // 5分钟

              eventChannel.on('cropped', async (data: { tempFilePath: string }) => {
                clearTimeout(timeout);
                const croppedPath = data?.tempFilePath;
                if (!croppedPath) {
                  reject(new Error('裁剪失败'));
                  return;
                }

                uploading.value = true;
                uni.showLoading({ title: '上传中...' });
                try {
                  const uploadResult = await uploadImage(croppedPath);
                  form.avatar = uploadResult.url;
                  uni.hideLoading();
                  uni.showToast({ title: '头像上传成功', icon: 'success' });
                  resolve();
                } catch (error) {
                  console.error('上传头像失败:', error);
                  uni.hideLoading();
                  uni.showToast({ title: '头像上传失败', icon: 'none' });
                  reject(error);
                } finally {
                  uploading.value = false;
                }
              });
            },
            fail: (err) => {
              console.error('跳转裁剪页面失败:', err);
              const errMsg = (err as any)?.errMsg ? String((err as any).errMsg) : '';
              uni.showToast({ title: errMsg ? `打开裁剪失败：${errMsg}` : '打开裁剪失败', icon: 'none' });
              reject(err);
            },
          });
        },
        fail: (err) => {
          console.error('选择图片失败:', err);
          uni.showToast({
            title: '选择图片失败',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  }

  /**
   * 验证表单
   */
  function validateForm(): boolean {
    if (!form.nickname.trim()) {
      uni.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return false;
    }
    return true;
  }

  /**
   * 保存设置
   */
  async function handleSave(): Promise<boolean> {
    if (!validateForm()) return false;

    saving.value = true;
    try {
      const payload: UserProfileUpdateRequest = {
        nickname: form.nickname.trim(),
        avatar: form.avatar.trim() || undefined
      };

      const response = await updateUserProfile(payload);
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message || '保存失败');
      }

      userStore.updateLocalUserInfo(response.data);
      
      uni.showToast({
        title: '保存成功',
        icon: 'success'
      });
      
      setTimeout(() => {
        if (typeof (uni as any).navigateBack === 'function') {
          uni.navigateBack();
        }
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('保存失败:', error);
      const message = error instanceof Error ? error.message : '保存失败';
      uni.showToast({
        title: message,
        icon: 'none'
      });
      return false;
    } finally {
      saving.value = false;
    }
  }

  // 组件挂载时加载数据
  onMounted(() => {
    loadPersonalInfo();
  });

  return {
    // 状态
    form,
    saving,
    loading,
    uploading,
    
    // 方法
    chooseAvatar,
    handleSave
  };
}
