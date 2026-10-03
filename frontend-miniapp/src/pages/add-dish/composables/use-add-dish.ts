import { ref, reactive, computed, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { uploadDish } from '@/api/modules/dish';
import { getCanteenList } from '@/api/modules/canteen';
import { uploadImage } from '@/api/modules/upload';
import type { DishUserCreateRequest, Canteen, Window } from '@/types/api';

type AddDishFormData = DishUserCreateRequest & {
  floor: string;
};

/**
 * 新建菜品页面逻辑
 */
export function useAddDish() {
  const userStore = useUserStore();
  let disposed = false;
  let navigationTimer: ReturnType<typeof setTimeout> | null = null;
  const captureOperation = () => {
    const session = userStore.sessionVersion;
    return () => !disposed && session === userStore.sessionVersion;
  };
  const cancelNavigation = () => {
    if (navigationTimer === null) return;
    clearTimeout(navigationTimer);
    navigationTimer = null;
  };
  // 表单数据
  const formData = reactive<AddDishFormData>({
    name: '',
    price: 0,
    priceUnit: '',
    description: '',
    images: [],
    tags: [],
    ingredients: [],
    allergens: [],
    canteenId: '',
    canteenName: '',
    windowId: '',
    windowNumber: '',
    windowName: '',
    floor: '',
    availableMealTime: [],
    status: 'online',
  });

  const customTagInput = ref('');
  const customAllergenInput = ref('');
  const customTags = ref<string[]>([]);
  const customAllergens = ref<string[]>([]);

  // 食堂和窗口选项
  const canteenList = ref<Canteen[]>([]);
  const windowList = ref<Window[]>([]);
  const selectedCanteen = ref<Canteen | null>(null);

  // 状态
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref('');

  // 供应时段选项
  const mealTimeOptions = [
    { label: '早餐', value: 'breakfast' },
    { label: '午餐', value: 'lunch' },
    { label: '晚餐', value: 'dinner' },
    { label: '夜宵', value: 'nightsnack' },
  ];

  // 常用标签
  const commonTags = [
    '辣',
    '甜',
    '清淡',
    '油腻',
    '新品',
    '招牌',
    '米饭',
    '面食',
    '小炒',
    '汤类',
    '素食',
    '荤菜',
    '凉菜',
    '主食',
    '小吃',
  ];

  // 常见过敏原
  const commonAllergens = [
    '花生',
    '牛奶',
    '鸡蛋',
    '大豆',
    '小麦',
    '海鲜',
    '坚果',
    '芝麻',
    '虾',
    '蟹',
  ];

  /**
   * 表单是否有效
   */
  const isFormValid = computed(() => {
    return (
      (formData.name?.trim() || '') !== '' &&
      formData.price > 0 &&
      (formData.canteenName?.trim() || '') !== '' &&
      (formData.windowName?.trim() || '') !== '' &&
      formData.availableMealTime.length > 0
    );
  });

  /**
   * 加载食堂列表
   */
  const loadCanteenList = async () => {
    const isCurrent = captureOperation();
    loading.value = true;
    try {
      const response = await getCanteenList({ page: 1, pageSize: 100 });
      if (!isCurrent()) return;
      if (response.code === 200 && response.data) {
        canteenList.value = response.data.items;
      }
    } catch (err: any) {
      if (!isCurrent()) return;
      console.error('加载食堂列表失败:', err);
      error.value = '加载食堂列表失败';
    } finally {
      if (isCurrent()) loading.value = false;
    }
  };

  /**
   * 选择食堂
   */
  const selectCanteen = (canteen: Canteen) => {
    selectedCanteen.value = canteen;
    formData.canteenId = canteen.id;
    formData.canteenName = canteen.name;
    windowList.value = canteen.windows || [];
    // 重置窗口选择
    formData.windowId = '';
    formData.windowNumber = '';
    formData.windowName = '';
    formData.floor = '';
  };

  /**
   * 选择窗口
   */
  const selectWindow = (window: Window) => {
    formData.windowId = window.id;
    formData.windowNumber = window.number || '';
    formData.windowName = window.name;
    formData.floor = window.floor?.level || '';
  };

  /**
   * 切换供应时段
   */
  const toggleMealTime = (mealTime: 'breakfast' | 'lunch' | 'dinner' | 'nightsnack') => {
    const index = formData.availableMealTime.indexOf(mealTime);
    if (index > -1) {
      formData.availableMealTime.splice(index, 1);
    } else {
      formData.availableMealTime.push(mealTime);
    }
  };

  /**
   * 切换标签
   */
  const toggleTag = (tag: string) => {
    if (!formData.tags) {
      formData.tags = [];
    }
    const index = formData.tags.indexOf(tag);
    if (index > -1) {
      formData.tags.splice(index, 1);
    } else {
      formData.tags.push(tag);
    }
  };

  const addCustomTag = () => {
    const tag = customTagInput.value.trim();
    if (!tag) return;
    if (!formData.tags) {
      formData.tags = [];
    }
    if (!formData.tags.includes(tag)) {
      formData.tags.push(tag);
    }
    customTagInput.value = '';
    if (!customTags.value.includes(tag)) {
      customTags.value.push(tag);
    }
  };

  const removeCustomTag = (tag: string) => {
    const idx = customTags.value.indexOf(tag);
    if (idx > -1) {
      customTags.value.splice(idx, 1);
    }
    if (formData.tags) {
      const tagIdx = formData.tags.indexOf(tag);
      if (tagIdx > -1) formData.tags.splice(tagIdx, 1);
    }
  };

  /**
   * 切换过敏原
   */
  const toggleAllergen = (allergen: string) => {
    if (!formData.allergens) {
      formData.allergens = [];
    }
    const index = formData.allergens.indexOf(allergen);
    if (index > -1) {
      formData.allergens.splice(index, 1);
    } else {
      formData.allergens.push(allergen);
    }
  };

  const addCustomAllergen = () => {
    const allergen = customAllergenInput.value.trim();
    if (!allergen) return;
    if (!formData.allergens) {
      formData.allergens = [];
    }
    if (!formData.allergens.includes(allergen)) {
      formData.allergens.push(allergen);
    }
    customAllergenInput.value = '';
    if (!customAllergens.value.includes(allergen)) {
      customAllergens.value.push(allergen);
    }
  };

  const removeCustomAllergen = (item: string) => {
    const idx = customAllergens.value.indexOf(item);
    if (idx > -1) {
      customAllergens.value.splice(idx, 1);
    }
    if (formData.allergens) {
      const aIdx = formData.allergens.indexOf(item);
      if (aIdx > -1) formData.allergens.splice(aIdx, 1);
    }
  };

  /**
   * 选择图片
   */
  const chooseImages = () => {
    const isCurrent = captureOperation();
    uni.chooseImage({
      count: 9 - (formData.images?.length || 0),
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        if (!isCurrent()) return;
        if (!formData.images) {
          formData.images = [];
        }
        formData.images.push(...res.tempFilePaths);
      },
    });
  };

  /**
   * 删除图片
   */
  const removeImage = (index: number) => {
    formData.images?.splice(index, 1);
  };

  /**
   * 提交表单
   */
  const submitForm = async (): Promise<boolean> => {
    if (submitting.value) return false;
    const isCurrent = captureOperation();
    if (!isCurrent()) return false;
    cancelNavigation();
    if (!isFormValid.value) {
      uni.showToast({
        title: '请填写必填项',
        icon: 'none',
      });
      return false;
    }

    submitting.value = true;
    error.value = '';
    const draft = JSON.parse(JSON.stringify(formData)) as AddDishFormData;

    try {
      const uploadedImages = await Promise.all(
        (draft.images || []).map(async imagePath => (await uploadImage(imagePath)).url)
      );
      if (!isCurrent()) return false;
      const dishData: DishUserCreateRequest = {
        name: draft.name,
        tags: draft.tags,
        price: draft.price,
        priceUnit: draft.priceUnit,
        description: draft.description,
        images: uploadedImages,
        parentDishId: draft.parentDishId,
        subDishId: draft.subDishId,
        ingredients: draft.ingredients,
        allergens: draft.allergens,
        canteenId: draft.canteenId,
        canteenName: draft.canteenName,
        windowId: draft.windowId || undefined,
        windowNumber: draft.windowNumber,
        windowName: draft.windowName,
        availableMealTime: draft.availableMealTime,
        availableDates: draft.availableDates,
        status: draft.status,
      };
      const response = await uploadDish(dishData);
      if (!isCurrent()) return false;

      if (response.code === 200 || response.code === 201) {
        uni.showToast({
          title: '提交成功，等待审核',
          icon: 'success',
        });

        // 延迟返回上一页
        navigationTimer = setTimeout(() => {
          navigationTimer = null;
          if (isCurrent()) uni.navigateBack();
        }, 1500);

        return true;
      } else {
        throw new Error(response.message || '提交失败');
      }
    } catch (err: any) {
      if (!isCurrent()) return false;
      console.error('提交失败:', err);
      error.value = err.message || '提交失败，请稍后重试';
      uni.showToast({
        title: error.value,
        icon: 'none',
      });
      return false;
    } finally {
      if (isCurrent()) submitting.value = false;
    }
  };

  /**
   * 重置表单
   */
  const resetForm = () => {
    formData.name = '';
    formData.price = 0;
    formData.priceUnit = '';
    formData.description = '';
    formData.images = [];
    formData.tags = [];
    formData.ingredients = [];
    formData.allergens = [];
    formData.canteenId = '';
    formData.canteenName = '';
    formData.windowId = '';
    formData.windowNumber = '';
    formData.windowName = '';
    formData.floor = '';
    formData.availableMealTime = [];
    selectedCanteen.value = null;
    windowList.value = [];
    error.value = '';
    customTags.value = [];
    customAllergens.value = [];
    customTagInput.value = '';
    customAllergenInput.value = '';
  };

  watch(() => userStore.sessionVersion, () => {
    cancelNavigation();
    resetForm();
    canteenList.value = [];
    loading.value = false;
    submitting.value = false;
  }, { flush: 'sync' });

  if (getCurrentScope()) onScopeDispose(() => {
    disposed = true;
    cancelNavigation();
  });

  return {
    formData,
    canteenList,
    windowList,
    selectedCanteen,
    loading,
    submitting,
    error,
    isFormValid,
    mealTimeOptions,
    commonTags,
    commonAllergens,
    customTagInput,
    customAllergenInput,
    customTags,
    customAllergens,
    loadCanteenList,
    selectCanteen,
    selectWindow,
    toggleMealTime,
    toggleTag,
    addCustomTag,
    removeCustomTag,
    toggleAllergen,
    addCustomAllergen,
    removeCustomAllergen,
    chooseImages,
    removeImage,
    submitForm,
    resetForm,
  };
}
