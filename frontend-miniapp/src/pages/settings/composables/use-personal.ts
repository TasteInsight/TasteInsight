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
          
          // 开始上传
          uploading.value = true;
          uni.showLoading({
            title: '上传中...'
          });
          
          try {
            const uploadResult = await uploadImage(tempFilePath);
            form.avatar = uploadResult.url;
            
            uni.hideLoading();
            uni.showToast({
              title: '头像上传成功',
              icon: 'success'
            });
            resolve();
          } catch (error) {
            console.error('上传头像失败:', error);
            uni.hideLoading();
            uni.showToast({
              title: '头像上传失败',
              icon: 'none'
            });
            reject(error);
          } finally {
            uploading.value = false;
          }
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
        uni.navigateBack();
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
