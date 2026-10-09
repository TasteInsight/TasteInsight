import { reactive, onMounted } from 'vue';
import { useSettingsProfile } from './use-settings-profile';
import type { UserProfileUpdateRequest } from '@/types/api';

export interface AllergensForm {
  allergens: string;
}

// 常见过敏原列表
export const COMMON_ALLERGENS = [
  '花生',
  '牛奶',
  '鸡蛋',
  '海鲜',
  '大豆',
  '小麦',
  '坚果',
  '芝麻',
  '芒果',
  '菠萝',
  '猕猴桃',
  '桃子',
  '蚕豆',
];

export function useAllergens() {
  const form = reactive<AllergensForm>({
    allergens: '',
  });

  const profile = useSettingsProfile(
    userInfo => {
      form.allergens = userInfo?.allergens?.join(', ') || '';
    },
    form,
    'allergens'
  );
  const { loadProfile, saveProfile } = profile;

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
      .map(item => item.trim())
      .filter(Boolean);
  }

  /**
   * 保存设置
   */
  async function handleSave(): Promise<boolean> {
    const payload: UserProfileUpdateRequest = {
      allergens: parseAllergenList(form.allergens),
    };
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
    commonAllergens: COMMON_ALLERGENS,

    // 方法
    isSelected,
    toggleAllergen,
    handleSave,
  };
}
