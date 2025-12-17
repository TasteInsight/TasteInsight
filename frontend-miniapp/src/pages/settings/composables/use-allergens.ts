import { reactive, ref, onMounted } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { updateUserProfile } from '@/api/modules/user';
import type { UserProfileUpdateRequest } from '@/types/api';

export interface AllergensForm {
  allergens: string;
}

// 常见过敏原列表
export const COMMON_ALLERGENS = [
  '花生', '牛奶', '鸡蛋', '海鲜', '大豆', '小麦', 
  '坚果', '芝麻', '芒果', '菠萝', '猕猴桃', '桃子', '蚕豆'
];

export function useAllergens() {
  const userStore = useUserStore();
  
  const saving = ref(false);
  const loading = ref(true);
  
  const form = reactive<AllergensForm>({
    allergens: ''
  });

  /**
   * 加载用户过敏原信息
   */
  async function loadAllergens() {
    loading.value = true;
    try {
      await userStore.fetchProfileAction();
      const userInfo = userStore.userInfo;
      if (userInfo?.allergens) {
        form.allergens = userInfo.allergens.join(', ');
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 判断过敏原是否已选中
   */
  function isSelected(allergen: string): boolean {
    return form.allergens
      .split(/[,，]/)
      .map(a => a.trim())
      .includes(allergen);
  }

  /**
   * 切换过敏原选中状态
   */
  function toggleAllergen(allergen: string) {
    let allergenList = form.allergens
      .split(/[,，]/)
      .map(a => a.trim())
      .filter(a => a);
    
    const index = allergenList.indexOf(allergen);
    
    if (index > -1) {
      allergenList.splice(index, 1);
    } else {
      allergenList.push(allergen);
    }
    
    form.allergens = allergenList.join(', ');
  }

  /**
   * 解析过敏原列表
   */
  function parseAllergenList(text: string): string[] {
    return text
      .split(/[,，;；\n\r\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /**
   * 保存设置
   */
  async function handleSave(): Promise<boolean> {
    saving.value = true;
    try {
      const payload: UserProfileUpdateRequest = {
        allergens: parseAllergenList(form.allergens)
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
    loadAllergens();
  });

  return {
    // 状态
    form,
    saving,
    loading,
    
    // 常量
    commonAllergens: COMMON_ALLERGENS,
    
    // 方法
    isSelected,
    toggleAllergen,
    handleSave
  };
}
