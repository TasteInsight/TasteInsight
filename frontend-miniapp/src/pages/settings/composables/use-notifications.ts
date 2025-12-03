import { reactive, ref, onMounted } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import type { UserProfileUpdateRequest, UserSettings } from '@/types/api';

export interface NotificationsForm {
  newDishAlert: boolean;
  priceChangeAlert: boolean;
  reviewReplyAlert: boolean;
  weeklyRecommendation: boolean;
}

export function useNotifications() {
  const userStore = useUserStore();
  
  const saving = ref(false);
  const loading = ref(true);
  
  const form = reactive<NotificationsForm>({
    newDishAlert: true,
    priceChangeAlert: false,
    reviewReplyAlert: true,
    weeklyRecommendation: true
  });

  /**
   * 加载通知设置
   */
  async function loadNotificationSettings() {
    loading.value = true;
    try {
      await userStore.fetchProfileAction();
      const userInfo = userStore.userInfo;
      if (userInfo?.settings?.notificationSettings) {
        const notif = userInfo.settings.notificationSettings;
        form.newDishAlert = notif.newDishAlert ?? true;
        form.priceChangeAlert = notif.priceChangeAlert ?? false;
        form.reviewReplyAlert = notif.reviewReplyAlert ?? true;
        form.weeklyRecommendation = notif.weeklyRecommendation ?? true;
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新通知设置字段
   */
  function updateField(field: keyof NotificationsForm, e: any) {
    const value = e && typeof e === 'object' && 'detail' in e ? !!e.detail.value : !!e;
    form[field] = value;
  }

  /**
   * 保存设置
   */
  async function handleSave(): Promise<boolean> {
    saving.value = true;
    try {
      const settings: Partial<UserSettings> = {
        notificationSettings: {
          newDishAlert: form.newDishAlert,
          priceChangeAlert: form.priceChangeAlert,
          reviewReplyAlert: form.reviewReplyAlert,
          weeklyRecommendation: form.weeklyRecommendation
        }
      };

      const payload: UserProfileUpdateRequest = { settings };

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
    loadNotificationSettings();
  });

  return {
    // 状态
    form,
    saving,
    loading,
    
    // 方法
    updateField,
    handleSave
  };
}
