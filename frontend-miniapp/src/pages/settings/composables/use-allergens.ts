import { t } from '@/i18n';
import { reactive, onMounted } from 'vue';
import { useSettingsProfile } from './use-settings-profile';
import type { UserProfileUpdateRequest } from '@/types/api';

export interface AllergensForm {
  allergens: string;
}

// 常见过敏原列表
export const COMMON_ALLERGENS = [
  ['花生', 'food.peanuts'],
  ['牛奶', 'food.milk'],
  ['鸡蛋', 'food.eggs'],
  ['海鲜', 'food.seafood'],
  ['大豆', 'food.soy'],
  ['小麦', 'food.wheat'],
  ['坚果', 'food.treeNuts'],
  ['芝麻', 'food.sesame'],
  ['芒果', 'food.mango'],
  ['菠萝', 'food.pineapple'],
  ['猕猴桃', 'food.kiwi'],
  ['桃子', 'food.peach'],
  ['蚕豆', 'food.broadBeans'],
].map(([value, labelKey]) => ({
  value,
  get label() {
    return t(labelKey);
  },
}));

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
    const allergenList = form.allergens
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
