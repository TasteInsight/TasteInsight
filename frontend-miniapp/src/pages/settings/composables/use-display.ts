import { reactive, onMounted } from 'vue';
import { useSettingsProfile } from './use-settings-profile';
import type { UserProfileUpdateRequest, UserSettings } from '@/types/api';

export interface DisplayForm {
  showCalories: boolean;
  showNutrition: boolean;
  sortByIndex: number;
}

// 排序选项
export const SORT_OPTIONS = ['评分优先', '评价最多', '最新上架', '价格从低到高', '价格从高到低'];
export const SORT_VALUES = ['rating', 'popularity', 'newest', 'price_low', 'price_high'] as const;

export function useDisplay() {
  const form = reactive<DisplayForm>({
    showCalories: true,
    showNutrition: false,
    sortByIndex: 0,
  });

  const profile = useSettingsProfile(
    userInfo => {
      const display = userInfo?.settings?.displaySettings;
      form.showCalories = display?.showCalories ?? true;
      form.showNutrition = display?.showNutrition ?? false;
      const index = display?.sortBy ? SORT_VALUES.indexOf(display.sortBy) : -1;
      form.sortByIndex = index >= 0 ? index : 0;
    },
    form,
    'display'
  );
  const { loadProfile, saveProfile } = profile;

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
    const settings: Partial<UserSettings> = {
      displaySettings: {
        showCalories: form.showCalories,
        showNutrition: form.showNutrition,
        sortBy: SORT_VALUES[form.sortByIndex],
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

    // 常量
    sortOptions: SORT_OPTIONS,

    // 方法
    onShowCaloriesChange,
    onShowNutritionChange,
    onSortChange,
    handleSave,
  };
}
