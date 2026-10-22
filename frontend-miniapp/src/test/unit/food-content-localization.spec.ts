import { locale } from '@/i18n';
import { localizedDishName, localizedDishDescription } from '@/utils/dish-localization';
import {
  parseAllergenList,
  loadAllergenCatalog,
  allergenLabel,
  allergenValue,
} from '@/utils/allergen-catalog';
jest.mock('@/utils/request', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockResolvedValue({
      data: [{ value: '花生', nameZh: '花生', nameEn: 'Peanuts', aliases: ['peanut', '花生'] }],
    }),
}));
afterEach(() => {
  locale.value = 'zh-Hans';
});
it('switches cached dish content immediately and falls back per field', () => {
  const dish = { name: '原名', nameEn: 'English name', description: '原描述', descriptionEn: '' };
  locale.value = 'en';
  expect(localizedDishName(dish)).toBe('English name');
  expect(localizedDishDescription(dish)).toBe('原描述');
  expect(localizedDishName({ name: '原名' })).toBe('原名');
  locale.value = 'zh-Hans';
  expect(localizedDishName(dish)).toBe('原名');
  expect(dish.name).toBe('原名');
});
it('preserves multiword custom allergens and resolves curated display labels separately from values', async () => {
  expect(parseAllergenList('Pine nuts, Milk protein；自定义成分\nPine nuts')).toEqual([
    'Pine nuts',
    'Milk protein',
    '自定义成分',
  ]);
  await loadAllergenCatalog();
  locale.value = 'en';
  expect(allergenLabel('花生')).toBe('Peanuts');
  expect(allergenValue('PEANUT')).toBe('花生');
  expect(allergenLabel('Private custom phrase')).toBe('Private custom phrase');
});
