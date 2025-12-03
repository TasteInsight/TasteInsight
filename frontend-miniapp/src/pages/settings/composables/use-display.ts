import { reactive, ref, onMounted } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import type { UserProfileUpdateRequest, UserSettings } from '@/types/api';

export interface DisplayForm {
  showCalories: boolean;
  showNutrition: boolean;
  sortByIndex: number;
}

// 排序选项
export const SORT_OPTIONS = ['推荐排序', '热度排序', '最新上架', '价格从低到高', '价格从高到低'];
export const SORT_VALUES = ['rating', 'popularity', 'newest', 'price_low', 'price_high'];

export function useDisplay() {
  const userStore = useUserStore();
  
  const saving = ref(false);
  const loading = ref(true);
  
  const form = reactive<DisplayForm>({
    showCalories: true,
    showNutrition: true,
    sortByIndex: 0
  });

  /**
   * 加载显示设置
   */
  async function loadDisplaySettings() {
    loading.value = true;
    try {
      await userStore.fetchProfileAction();
      const userInfo = userStore.userInfo;
      if (userInfo?.settings?.displaySettings) {
        const display = userInfo.settings.displaySettings;
        form.showCalories = display.showCalories ?? true;
        form.showNutrition = display.showNutrition ?? true;
        if (display.sortBy) {
          const index = SORT_VALUES.indexOf(display.sortBy);
          form.sortByIndex = index >= 0 ? index : 0;
        }
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 事件处理：兼容不同平台的 change 事件结构
   */
  function onShowCaloriesChange(e: any) {
    form.showCalories = e && typeof e === 'object' && 'detail' in e ? !!e.detail.value : !!e;
  }

  function onShowNutritionChange(e: any) {
    form.showNutrition = e && typeof e === 'object' && 'detail' in e ? !!e.detail.value : !!e;
  }

  function onSortChange(e: any) {
    const val = e && typeof e === 'object' && 'detail' in e ? e.detail.value : e;
    form.sortByIndex = Number(val) || 0;
  }

  /**
   * 保存设置
   */
  async function handleSave(): Promise<boolean> {
    saving.value = true;
    try {
      const settings: Partial<UserSettings> = {
        displaySettings: {
          showCalories: form.showCalories,
          showNutrition: form.showNutrition,
          sortBy: SORT_VALUES[form.sortByIndex] as any
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
    loadDisplaySettings();
  });

  return {
    // 状态
    form,
    saving,
    loading,
    
    // 常量
    sortOptions: SORT_OPTIONS,
    
    // 方法
    onShowCaloriesChange,
    onShowNutritionChange,
    onSortChange,
    handleSave
  };
}
