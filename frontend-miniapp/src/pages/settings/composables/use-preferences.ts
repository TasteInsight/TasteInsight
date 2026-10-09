import { reactive, ref, onMounted, computed, getCurrentScope, onScopeDispose } from 'vue';
import { getCanteenList } from '@/api/modules/canteen';
import { useSettingsProfile } from './use-settings-profile';
import type { Canteen, UserProfileUpdateRequest, UserPreference } from '@/types/api';

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
  ingredientDrafts: {
    favoriteIngredients: string;
    meatPreference: string;
    avoidIngredients: string;
  };
}

// 口味标签常量
export const TASTE_LABELS = ['未设置', '清淡', '适中', '偏重', '很重', '极重'];
export const SPICINESS_LABELS = ['未设置', '微辣', '中辣', '重辣', '特辣', '变态辣'];
export const PORTION_LABELS: Record<'small' | 'medium' | 'large', string> = {
  small: '小份',
  medium: '中份',
  large: '大份',
};
export const REVERSE_PORTION_LABELS: Record<string, 'small' | 'medium' | 'large'> = {
  小份: 'small',
  中份: 'medium',
  大份: 'large',
};

export function usePreferences() {
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
    favoriteIngredients: [],
    ingredientDrafts: { favoriteIngredients: '', meatPreference: '', avoidIngredients: '' },
  });

  // 输入框临时值
  const newFavoriteIngredient = computed({
    get: () => form.ingredientDrafts.favoriteIngredients,
    set: value => {
      form.ingredientDrafts.favoriteIngredients = value;
    },
  });
  const newMeatPreference = computed({
    get: () => form.ingredientDrafts.meatPreference,
    set: value => {
      form.ingredientDrafts.meatPreference = value;
    },
  });
  const newAvoidIngredient = computed({
    get: () => form.ingredientDrafts.avoidIngredients,
    set: value => {
      form.ingredientDrafts.avoidIngredients = value;
    },
  });

  const profile = useSettingsProfile(
    userInfo => {
      const pref = userInfo?.preferences;
      form.spiciness = pref?.tastePreferences?.spicyLevel ?? 0;
      form.sweetness = pref?.tastePreferences?.sweetness ?? 0;
      form.saltiness = pref?.tastePreferences?.saltiness ?? 0;
      form.oiliness = pref?.tastePreferences?.oiliness ?? 0;
      form.portionSize = pref?.portionSize ?? 'medium';
      form.meatPreference = [...(pref?.meatPreference ?? [])];
      form.priceRange = { ...(pref?.priceRange ?? { min: 20, max: 100 }) };
      form.canteenPreferences = [...(pref?.canteenPreferences ?? [])];
      form.avoidIngredients = [...(pref?.avoidIngredients ?? [])];
      form.favoriteIngredients = [...(pref?.favoriteIngredients ?? [])];
      newFavoriteIngredient.value = '';
      newMeatPreference.value = '';
      newAvoidIngredient.value = '';
    },
    form,
    'preferences'
  );
  const { loadProfile, saveProfile } = profile;

  const canteenList = ref<Canteen[]>([]);
  const canteensLoading = ref(false);
  const canteensError = ref('');
  let directoryDisposed = false;
  if (getCurrentScope())
    onScopeDispose(() => {
      directoryDisposed = true;
    });

  async function loadCanteens(): Promise<boolean> {
    if (canteensLoading.value || directoryDisposed) return false;
    canteensLoading.value = true;
    canteensError.value = '';
    try {
      const directory: Canteen[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await getCanteenList({ page, pageSize: 100 });
        if (directoryDisposed) return false;
        if (response.code !== 200 || !response.data)
          throw new Error(response.message || '食堂列表加载失败');
        directory.push(...response.data.items);
        totalPages = response.data.meta.totalPages;
        page++;
      } while (page <= totalPages);
      canteenList.value = directory;
      return true;
    } catch (error) {
      if (!directoryDisposed) {
        canteensError.value = error instanceof Error ? error.message : '食堂列表加载失败';
      }
      return false;
    } finally {
      if (!directoryDisposed) canteensLoading.value = false;
    }
  }

  const priceRangeError = computed(() => {
    const { min, max } = form.priceRange;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return '请填写有效的最低价和最高价';
    if (min < 0 || max < 0) return '价格不能小于 0';
    if (min > max) return '最低价格不能高于最高价格';
    return '';
  });

  function validatePriceRange(): boolean {
    return !priceRangeError.value;
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
    const canteen = canteenList.value.find(c => c.id === canteenId);
    return canteen ? canteen.name : '食堂信息暂不可用';
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
    if (!profile.canEdit.value) return false;
    if (!validatePriceRange()) {
      uni.showToast({ title: priceRangeError.value, icon: 'none' });
      return false;
    }
    for (const field of ['favoriteIngredients', 'meatPreference', 'avoidIngredients'] as const) {
      const value = form.ingredientDrafts[field].trim();
      if (value && !form[field].includes(value)) form[field].push(value);
      form.ingredientDrafts[field] = '';
    }
    const preferences: Partial<UserPreference> = {
      tastePreferences: {
        spicyLevel: form.spiciness,
        sweetness: form.sweetness,
        saltiness: form.saltiness,
        oiliness: form.oiliness,
      },
      portionSize: form.portionSize,
      meatPreference: [...form.meatPreference],
      priceRange: { ...form.priceRange },
      canteenPreferences: [...form.canteenPreferences],
      avoidIngredients: [...form.avoidIngredients],
      favoriteIngredients: [...form.favoriteIngredients],
    };

    const payload: UserProfileUpdateRequest = { preferences };
    return saveProfile(payload);
  }

  // 组件挂载时加载数据
  onMounted(() => {
    void loadProfile();
    void loadCanteens();
  });

  return {
    // 状态
    form,
    ...profile,
    newFavoriteIngredient,
    newMeatPreference,
    newAvoidIngredient,
    canteenList,
    canteensLoading,
    canteensError,
    loadCanteens,
    priceRangeError,

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
    handleSave,
  };
}
