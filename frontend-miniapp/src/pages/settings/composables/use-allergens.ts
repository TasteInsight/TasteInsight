import { locale } from '@/i18n';
import {
  allergenOptions,
  loadAllergenCatalog,
  parseAllergenList,
  allergenLabel,
  allergenValue,
} from '@/utils/allergen-catalog';
import { ref, watch, reactive, onMounted } from 'vue';
import { useSettingsProfile } from './use-settings-profile';
import type { UserProfileUpdateRequest } from '@/types/api';

export interface AllergensForm {
  allergens: string;
}

export const COMMON_ALLERGENS = allergenOptions.value;

export function useAllergens() {
  const form = reactive<AllergensForm>({
    allergens: '',
  });

  const displayAllergens = ref('');
  let editing = false;
  const profile = useSettingsProfile(
    userInfo => {
      editing = false;
      form.allergens = userInfo?.allergens?.join(', ') || '';
      formatEditor();
    },
    form,
    'allergens'
  );
  const { loadProfile, saveProfile } = profile;
  function formatEditor() {
    if (!editing)
      displayAllergens.value = parseAllergenList(form.allergens).map(allergenLabel).join(', ');
  }
  watch([() => form.allergens, locale, allergenOptions], formatEditor, { immediate: true });
  const editAllergens = () => {
    editing = true;
  };
  const inputAllergens = (event: any) => {
    form.allergens = event.detail?.value ?? event.target.value;
  };
  const finishAllergens = () => {
    editing = false;
    formatEditor();
  };

  /**
   * 判断过敏原是否已选中
   */
  function isSelected(allergen: string): boolean {
    return parseAllergenList(form.allergens).map(allergenValue).includes(allergen);
  }

  /**
   * 切换过敏原选中状态
   */
  function toggleAllergen(allergen: string) {
    const allergenList = parseAllergenList(form.allergens)
      .map(allergenValue)
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
   * 保存设置
   */
  async function handleSave(): Promise<boolean> {
    const payload: UserProfileUpdateRequest = {
      allergens: parseAllergenList(form.allergens).map(allergenValue),
    };
    return saveProfile(payload);
  }

  // 组件挂载时加载数据
  onMounted(() => {
    loadProfile();
    void loadAllergenCatalog();
  });

  return {
    // 状态
    form,
    ...profile,

    // 常量
    commonAllergens: allergenOptions,
    displayAllergens,
    editAllergens,
    inputAllergens,
    finishAllergens,

    // 方法
    isSelected,
    toggleAllergen,
    handleSave,
  };
}
