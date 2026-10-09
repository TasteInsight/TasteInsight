import { reactive, onMounted } from 'vue';
import { useSettingsProfile } from './use-settings-profile';
import type { UserProfileUpdateRequest, UserSettings } from '@/types/api';

export interface NotificationsForm {
  newDishAlert: boolean;
  priceChangeAlert: boolean;
  reviewReplyAlert: boolean;
  weeklyRecommendation: boolean;
}

export function useNotifications() {
  const form = reactive<NotificationsForm>({
    newDishAlert: true,
    priceChangeAlert: false,
    reviewReplyAlert: true,
    weeklyRecommendation: true,
  });

  const profile = useSettingsProfile(
    userInfo => {
      const notif = userInfo?.settings?.notificationSettings;
      form.newDishAlert = notif?.newDishAlert ?? true;
      form.priceChangeAlert = notif?.priceChangeAlert ?? false;
      form.reviewReplyAlert = notif?.reviewReplyAlert ?? true;
      form.weeklyRecommendation = notif?.weeklyRecommendation ?? true;
    },
    form,
    'notifications'
  );
  const { loadProfile, saveProfile } = profile;

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
    const settings: Partial<UserSettings> = {
      notificationSettings: {
        newDishAlert: form.newDishAlert,
        priceChangeAlert: form.priceChangeAlert,
        reviewReplyAlert: form.reviewReplyAlert,
        weeklyRecommendation: form.weeklyRecommendation,
      },
    };

    const payload: UserProfileUpdateRequest = { settings };
    return saveProfile(payload);
  }

  // 组件挂载时加载数据
  onMounted(() => {
    loadProfile();
  });

  return {
    // 状态
    form,
    ...profile,

    // 方法
    updateField,
    handleSave,
  };
}
