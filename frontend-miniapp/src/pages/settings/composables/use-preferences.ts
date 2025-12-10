import { reactive, ref, onMounted, computed } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { useCanteenStore } from '@/store/modules/use-canteen-store';
import { updateUserProfile } from '@/api/modules/user';
import type { UserProfileUpdateRequest, UserPreference } from '@/types/api';

export interface PreferencesForm {
  spiciness: number;
  sweetness: number;
  saltiness: number;
  oiliness: number;
  portionSize: 'small' | 'medium' | 'large';
  meatPreference: string[];
  priceRange: { min: number; max: number };
  canteenPreferences: string[];
  avoidIngredients: string[];
  favoriteIngredients: string[];
}

// 口味标签常量
export const TASTE_LABELS = ['未设置', '清淡', '适中', '偏重', '很重', '极重'];
export const SPICINESS_LABELS = ['未设置', '微辣', '中辣', '重辣', '特辣', '变态辣'];
export const PORTION_LABELS: Record<'small' | 'medium' | 'large', string> = {
  small: '小份',
  medium: '中份',
  large: '大份'
};
export const REVERSE_PORTION_LABELS: Record<string, 'small' | 'medium' | 'large'> = {
  '小份': 'small',
  '中份': 'medium',
  '大份': 'large'
};

export function usePreferences() {
  const userStore = useUserStore();
  const canteenStore = useCanteenStore();
  
  const saving = ref(false);
  const loading = ref(true);
  
  const form = reactive<PreferencesForm>({
    spiciness: 0,
    sweetness: 0,
    saltiness: 0,
    oiliness: 0,
    portionSize: 'medium',
    meatPreference: [],
    priceRange: { min: 20, max: 100 },
    canteenPreferences: [],
    avoidIngredients: [],
    favoriteIngredients: []
  });

  // 输入框临时值
  const newFavoriteIngredient = ref('');
  const newMeatPreference = ref('');
  const newAvoidIngredient = ref('');

  // 食堂列表
  const canteenList = computed(() => canteenStore.canteenList);

  /**
   * 加载用户偏好设置
   */
  async function loadPreferences() {
    loading.value = true;
    try {
      // 加载食堂列表
      if (canteenStore.canteenList.length === 0) {
        await canteenStore.fetchCanteenList();
      }
      
      await userStore.fetchProfileAction();
      const userInfo = userStore.userInfo;
      if (userInfo?.preferences) {
        const pref = userInfo.preferences;
        if (pref.tastePreferences) {
          form.spiciness = pref.tastePreferences.spicyLevel ?? 0;
          form.sweetness = pref.tastePreferences.sweetness ?? 0;
          form.saltiness = pref.tastePreferences.saltiness ?? 0;
          form.oiliness = pref.tastePreferences.oiliness ?? 0;
        }
        form.portionSize = pref.portionSize ?? 'medium';
        form.meatPreference = pref.meatPreference ?? [];
        form.priceRange = pref.priceRange ?? { min: 20, max: 100 };
        form.canteenPreferences = pref.canteenPreferences ?? [];
        form.avoidIngredients = pref.avoidIngredients ?? [];
        form.favoriteIngredients = pref.favoriteIngredients ?? [];
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 验证价格范围
   */
  function validatePriceRange(): boolean {
    const { min, max } = form.priceRange;
    if (min >= max) {
      uni.showToast({
        title: '最低价格必须小于最高价格',
        icon: 'none'
      });
      form.priceRange = { min: 20, max: 100 };
      return false;
    }
    return true;
  }

  /**
   * 添加喜好食材
   */
  function addFavoriteIngredient() {
    const value = newFavoriteIngredient.value.trim();
    if (!value) return;
    
    if (form.favoriteIngredients.includes(value)) {
      uni.showToast({ title: '已存在该食材', icon: 'none' });
      return;
    }
    form.favoriteIngredients.push(value);
    newFavoriteIngredient.value = '';
  }

  function removeFavoriteIngredient(index: number) {
    form.favoriteIngredients.splice(index, 1);
  }

  /**
   * 添加肉类偏好
   */
  function addMeatPreference() {
    const value = newMeatPreference.value.trim();
    if (!value) return;
    
    if (form.meatPreference.includes(value)) {
      uni.showToast({ title: '已存在该肉类', icon: 'none' });
      return;
    }
    form.meatPreference.push(value);
    newMeatPreference.value = '';
  }

  function removeMeatPreference(index: number) {
    form.meatPreference.splice(index, 1);
  }

  /**
   * 食堂偏好操作
   */
  function onCanteenSelect(e: { detail: { value: number } }) {
    const index = e.detail.value;
    const selectedCanteen = canteenList.value[index];
    if (!selectedCanteen) return;
    
    const canteenId = selectedCanteen.id;
    if (form.canteenPreferences.includes(canteenId)) {
      uni.showToast({ title: '已存在该食堂', icon: 'none' });
      return;
    }
    form.canteenPreferences.push(canteenId);
  }

  function removeCanteenPreference(index: number) {
    form.canteenPreferences.splice(index, 1);
  }

  function getCanteenNameById(canteenId: string): string {
    const canteen = canteenList.value.find((c) => c.id === canteenId);
    return canteen ? canteen.name : canteenId;
  }

  /**
   * 添加不喜欢的食材
   */
  function addAvoidIngredient() {
    const value = newAvoidIngredient.value.trim();
    if (!value) return;
    
    if (form.avoidIngredients.includes(value)) {
      uni.showToast({ title: '已存在该食材', icon: 'none' });
      return;
    }
    form.avoidIngredients.push(value);
    newAvoidIngredient.value = '';
  }

  function removeAvoidIngredient(index: number) {
    form.avoidIngredients.splice(index, 1);
  }

  /**
   * 保存设置
   */
  async function handleSave(): Promise<boolean> {
    if (!validatePriceRange()) return false;

    saving.value = true;
    try {
      const preferences: Partial<UserPreference> = {
        tastePreferences: {
          spicyLevel: form.spiciness,
          sweetness: form.sweetness,
          saltiness: form.saltiness,
          oiliness: form.oiliness
        },
        portionSize: form.portionSize,
        meatPreference: form.meatPreference,
        priceRange: form.priceRange,
        canteenPreferences: form.canteenPreferences,
        avoidIngredients: form.avoidIngredients,
        favoriteIngredients: form.favoriteIngredients
      };

      const payload: UserProfileUpdateRequest = { preferences };

      const response = await updateUserProfile(payload);
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message || '保存失败');
      }

      userStore.updateLocalUserInfo(response.data);
      
      uni.showToast({ title: '保存成功', icon: 'success' });
      
      setTimeout(() => {
        uni.navigateBack();
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('保存失败:', error);
      const message = error instanceof Error ? error.message : '保存失败';
      uni.showToast({ title: message, icon: 'none' });
      return false;
    } finally {
      saving.value = false;
    }
  }

  // 组件挂载时加载数据
  onMounted(() => {
    loadPreferences();
  });

  return {
    // 状态
    form,
    saving,
    loading,
    newFavoriteIngredient,
    newMeatPreference,
    newAvoidIngredient,
    canteenList,
    
    // 常量
    tasteLabels: TASTE_LABELS,
    spicinessLabels: SPICINESS_LABELS,
    portionLabels: PORTION_LABELS,
    reversePortionLabels: REVERSE_PORTION_LABELS,
    
    // 方法
    validatePriceRange,
    addFavoriteIngredient,
    removeFavoriteIngredient,
    addMeatPreference,
    removeMeatPreference,
    onCanteenSelect,
    removeCanteenPreference,
    getCanteenNameById,
    addAvoidIngredient,
    removeAvoidIngredient,
    handleSave
  };
}
