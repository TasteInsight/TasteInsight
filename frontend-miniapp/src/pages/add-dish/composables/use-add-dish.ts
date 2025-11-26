import { ref, reactive, computed } from 'vue';
import { uploadDish } from '@/api/modules/dish';
import { getCanteenList } from '@/api/modules/canteen';
import type { DishUserCreateRequest, Canteen, Window } from '@/types/api';

/**
 * 新建菜品页面逻辑
 */
export function useAddDish() {
  // 表单数据
  const formData = reactive<DishUserCreateRequest>({
    name: '',
    price: 0,
    description: '',
    images: [],
    tags: [],
    ingredients: [],
    allergens: [],
    canteenId: '',
    canteenName: '',
    windowNumber: '',
    windowName: '',
    floor: '',
    availableMealTime: [],
    status: 'online',
  });

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
    '辣', '甜', '清淡', '油腻', '新品',
    '招牌', '米饭', '面食', '小炒', '汤类',
    '素食', '荤菜', '凉菜', '主食', '小吃',
  ];

  // 常见过敏原
  const commonAllergens = [
    '花生', '牛奶', '鸡蛋', '大豆', '小麦',
    '海鲜', '坚果', '芝麻', '虾', '蟹',
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
    loading.value = true;
    try {
      const response = await getCanteenList({ page: 1, pageSize: 100 });
      if (response.code === 200 && response.data) {
        canteenList.value = response.data.items;
      }
    } catch (err: any) {
      console.error('加载食堂列表失败:', err);
      error.value = '加载食堂列表失败';
    } finally {
      loading.value = false;
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
    formData.windowNumber = '';
    formData.windowName = '';
    formData.floor = '';
  };

  /**
   * 选择窗口
   */
  const selectWindow = (window: Window) => {
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

  /**
   * 选择图片
   */
  const chooseImages = () => {
    uni.chooseImage({
      count: 9 - (formData.images?.length || 0),
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
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
    if (!isFormValid.value) {
      uni.showToast({
        title: '请填写必填项',
        icon: 'none',
      });
      return false;
    }

    submitting.value = true;
    error.value = '';

    try {
      const response = await uploadDish(formData);
      
      if (response.code === 200) {
        uni.showToast({
          title: '提交成功，等待审核',
          icon: 'success',
        });
        
        // 延迟返回上一页
        setTimeout(() => {
          uni.navigateBack();
        }, 1500);
        
        return true;
      } else {
        throw new Error(response.message || '提交失败');
      }
    } catch (err: any) {
      console.error('提交失败:', err);
      error.value = err.message || '提交失败，请稍后重试';
      uni.showToast({
        title: error.value,
        icon: 'none',
      });
      return false;
    } finally {
      submitting.value = false;
    }
  };

  /**
   * 重置表单
   */
  const resetForm = () => {
    formData.name = '';
    formData.price = 0;
    formData.description = '';
    formData.images = [];
    formData.tags = [];
    formData.ingredients = [];
    formData.allergens = [];
    formData.canteenId = '';
    formData.canteenName = '';
    formData.windowNumber = '';
    formData.windowName = '';
    formData.floor = '';
    formData.availableMealTime = [];
    selectedCanteen.value = null;
    windowList.value = [];
    error.value = '';
  };

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
    loadCanteenList,
    selectCanteen,
    selectWindow,
    toggleMealTime,
    toggleTag,
    toggleAllergen,
    chooseImages,
    removeImage,
    submitForm,
    resetForm,
  };
}
