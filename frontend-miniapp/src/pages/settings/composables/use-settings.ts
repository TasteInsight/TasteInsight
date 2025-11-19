import { reactive, ref, computed, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import type { User, UserProfileUpdateRequest, UserPreference } from '@/types/api';

export interface SettingsFormState {
  nickname: string;
  avatar: string;
  allergensText: string;
  favoriteIngredientsText: string;
  avoidIngredientsText: string;
  canteenPreferencesText: string;
  tagPreferencesText: string;
  spicyLevel: number;
  sweetness: number;
  saltiness: number;
  oiliness: number;
  portionSize: '' | 'small' | 'medium' | 'large';
  priceRangeMin: string;
  priceRangeMax: string;
  showCalories: boolean;
  showNutrition: boolean;
  sortBy: '' | 'rating' | 'price_low' | 'price_high' | 'popularity' | 'newest';
  newDishAlert: boolean;
  priceChangeAlert: boolean;
  reviewReplyAlert: boolean;
  weeklyRecommendation: boolean;
}

export type SettingsField = keyof SettingsFormState;

function createEmptyForm(): SettingsFormState {
  return {
    nickname: '',
    avatar: '',
    allergensText: '',
    favoriteIngredientsText: '',
    avoidIngredientsText: '',
    canteenPreferencesText: '',
    tagPreferencesText: '',
    spicyLevel: 0,
    sweetness: 0,
    saltiness: 0,
    oiliness: 0,
    portionSize: '',
    priceRangeMin: '',
    priceRangeMax: '',
    showCalories: false,
    showNutrition: false,
    sortBy: '',
    newDishAlert: false,
    priceChangeAlert: false,
    reviewReplyAlert: false,
    weeklyRecommendation: false,
  };
}

function parseList(text: string): string[] {
  return text
    .split(/[,，;；\n\r\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

export function useSettings() {
  const userStore = useUserStore();
  const loading = ref(false);
  const saving = ref(false);

  const form = reactive<SettingsFormState>(createEmptyForm());
  const original = ref<SettingsFormState>(createEmptyForm());

  const isLoggedIn = computed(() => userStore.isLoggedIn);
  const userInfo = computed(() => userStore.userInfo);

  const avatarPreview = computed(() => form.avatar.trim() || '/static/images/default-avatar.png');

  watch(
    userInfo,
    (info) => {
      syncForm(info);
    },
    { immediate: true }
  );

  onShow(async () => {
    if (!isLoggedIn.value) {
      return;
    }
    loading.value = true;
    try {
      await userStore.fetchProfileAction();
    } catch (error) {
      console.error('获取用户信息失败:', error);
    } finally {
      loading.value = false;
    }
  });

  function syncForm(info: User | null) {
    const snapshot = createEmptyForm();

    if (info) {
      snapshot.nickname = info.nickname ?? '';
      snapshot.avatar = info.avatar ?? '';
      snapshot.allergensText = (info.allergens ?? []).join(', ');

      if (info.preferences) {
        const pref = info.preferences;
        snapshot.spicyLevel = pref.spicyLevel ?? snapshot.spicyLevel;
        snapshot.portionSize = pref.portionSize ?? snapshot.portionSize;
        snapshot.favoriteIngredientsText = (pref.favoriteIngredients ?? []).join(', ');
        snapshot.avoidIngredientsText = (pref.avoidIngredients ?? []).join(', ');
        snapshot.canteenPreferencesText = (pref.canteenPreferences ?? []).join(', ');
        snapshot.tagPreferencesText = (pref.tagPreferences ?? []).join(', ');
        snapshot.priceRangeMin = pref.priceRange?.min !== undefined ? String(pref.priceRange.min) : snapshot.priceRangeMin;
        snapshot.priceRangeMax = pref.priceRange?.max !== undefined ? String(pref.priceRange.max) : snapshot.priceRangeMax;

        if (pref.tastePreferences) {
          snapshot.sweetness = pref.tastePreferences.sweetness ?? snapshot.sweetness;
          snapshot.saltiness = pref.tastePreferences.saltiness ?? snapshot.saltiness;
          snapshot.oiliness = pref.tastePreferences.oiliness ?? snapshot.oiliness;
        }

        if (pref.displaySettings) {
          snapshot.showCalories = pref.displaySettings.showCalories ?? snapshot.showCalories;
          snapshot.showNutrition = pref.displaySettings.showNutrition ?? snapshot.showNutrition;
          snapshot.sortBy = pref.displaySettings.sortBy ?? snapshot.sortBy;
        }

        if (pref.notificationSettings) {
          snapshot.newDishAlert = pref.notificationSettings.newDishAlert ?? snapshot.newDishAlert;
          snapshot.priceChangeAlert = pref.notificationSettings.priceChangeAlert ?? snapshot.priceChangeAlert;
          snapshot.reviewReplyAlert = pref.notificationSettings.reviewReplyAlert ?? snapshot.reviewReplyAlert;
          snapshot.weeklyRecommendation = pref.notificationSettings.weeklyRecommendation ?? snapshot.weeklyRecommendation;
        }
      }
    }

    Object.assign(form, snapshot);
    original.value = { ...snapshot };
  }

  function hasFieldChanged(field: SettingsField): boolean {
    const current = form[field];
    const initial = original.value[field];

    if (typeof current === 'string' && typeof initial === 'string') {
      return current.trim() !== initial.trim();
    }

    return current !== initial;
  }

  const canSubmit = computed(() => {
    if (!isLoggedIn.value || saving.value) {
      return false;
    }
    return (Object.keys(form) as SettingsField[]).some((field) => hasFieldChanged(field));
  });

  function handleFieldChange(field: SettingsField, value: unknown) {
    (form as any)[field] = value;
  }

  async function handleSave() {
    if (!isLoggedIn.value) {
      uni.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (!canSubmit.value) {
      uni.showToast({ title: '没有修改内容', icon: 'none' });
      return;
    }

    saving.value = true;
    try {
      const payload: UserProfileUpdateRequest = {
        nickname: form.nickname.trim() || undefined,
        avatar: form.avatar.trim() || undefined,
        allergens: parseList(form.allergensText),
      };

      const preferences: Partial<UserPreference> = {};

      const favoriteIngredientsChanged = hasFieldChanged('favoriteIngredientsText');
      const avoidIngredientsChanged = hasFieldChanged('avoidIngredientsText');
      const canteenPreferencesChanged = hasFieldChanged('canteenPreferencesText');
      const tagPreferencesChanged = hasFieldChanged('tagPreferencesText');

      if (favoriteIngredientsChanged) {
        preferences.favoriteIngredients = parseList(form.favoriteIngredientsText);
      }

      if (avoidIngredientsChanged) {
        preferences.avoidIngredients = parseList(form.avoidIngredientsText);
      }

      if (canteenPreferencesChanged) {
        preferences.canteenPreferences = parseList(form.canteenPreferencesText);
      }

      if (tagPreferencesChanged) {
        preferences.tagPreferences = parseList(form.tagPreferencesText);
      }

      if (hasFieldChanged('spicyLevel')) {
        preferences.spicyLevel = form.spicyLevel;
      }

      const tasteFields: SettingsField[] = ['sweetness', 'saltiness', 'oiliness'];
      if (tasteFields.some((field) => hasFieldChanged(field))) {
        preferences.tastePreferences = {
          sweetness: form.sweetness,
          saltiness: form.saltiness,
          oiliness: form.oiliness,
        };
      }

      if (hasFieldChanged('portionSize')) {
        preferences.portionSize = form.portionSize || undefined;
      }

      if (hasFieldChanged('priceRangeMin') || hasFieldChanged('priceRangeMax')) {
        const min = parseNumber(form.priceRangeMin);
        const max = parseNumber(form.priceRangeMax);
        if (min !== undefined || max !== undefined) {
          preferences.priceRange = {
            min: min ?? 0,
            max: max ?? 0,
          };
        }
      }

      const displayFields: SettingsField[] = ['showCalories', 'showNutrition', 'sortBy'];
      if (displayFields.some((field) => hasFieldChanged(field))) {
        preferences.displaySettings = {
          showCalories: form.showCalories,
          showNutrition: form.showNutrition,
          sortBy: form.sortBy || undefined,
        };
      }

      const notificationFields: SettingsField[] = ['newDishAlert', 'priceChangeAlert', 'reviewReplyAlert', 'weeklyRecommendation'];
      if (notificationFields.some((field) => hasFieldChanged(field))) {
        preferences.notificationSettings = {
          newDishAlert: form.newDishAlert,
          priceChangeAlert: form.priceChangeAlert,
          reviewReplyAlert: form.reviewReplyAlert,
          weeklyRecommendation: form.weeklyRecommendation,
        };
      }

      if (Object.keys(preferences).length > 0) {
        payload.preferences = preferences;
      }

      const response = await updateUserProfile(payload);
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message || '保存失败');
      }

      userStore.updateLocalUserInfo(response.data);
      syncForm(response.data);
      uni.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      console.error('更新个人信息失败:', error);
      const message = error instanceof Error ? error.message : '保存失败';
      uni.showToast({ title: message, icon: 'none' });
    } finally {
      saving.value = false;
    }
  }

  function handleLogout() {
    uni.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          userStore.logoutAction();
          syncForm(null);
          uni.showToast({ title: '已退出', icon: 'none' });
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/index/index' });
          }, 400);
        }
      },
    });
  }

  function goLogin() {
    uni.navigateTo({ url: '/pages/login/index' });
  }

  return {
    // state
    loading,
    saving,
    form,

    // getters
    isLoggedIn,
    canSubmit,
    avatarPreview,

    // actions
    handleFieldChange,
    handleSave,
    handleLogout,
    goLogin,
  };
}
