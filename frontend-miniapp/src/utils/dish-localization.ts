import { locale } from '@/i18n';
export function localizedDishName(dish: { name?: string | null; nameEn?: string | null }): string {
  return (locale.value === 'en' ? dish.nameEn?.trim() : '') || dish.name || '';
}
export function localizedDishDescription(dish: {
  description?: string | null;
  descriptionEn?: string | null;
}): string {
  return (locale.value === 'en' ? dish.descriptionEn?.trim() : '') || dish.description || '';
}
