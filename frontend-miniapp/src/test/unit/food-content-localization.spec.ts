import { locale } from '@/i18n';
import { localizedDishName, localizedDishDescription } from '@/utils/dish-localization';
import {
  parseAllergenList,
  loadAllergenCatalog,
  allergenLabel,
  allergenValue,
  normalizeAllergenValues,
} from '@/utils/allergen-catalog';
jest.mock('@/utils/request', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    data: [
      { value: '花生', nameZh: '花生', nameEn: 'Peanuts', aliases: ['peanut', '花生'] },
      { value: '坚果', nameZh: '坚果', nameEn: 'Tree nuts', aliases: ['Tree nut'] },
    ],
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

it('normalizes all comparisons and keeps whole custom phrases private', async () => {
  await loadAllergenCatalog();
  expect(allergenValue(' \u3000TrEE\t\nNuTS\u00A0')).toBe('坚果');
  expect(allergenLabel(' TREE  NUT ')).toBe('坚果');
  expect(allergenValue('Tree nutshell')).toBe('Tree nutshell');
  expect(allergenValue(' Private\t phrase ')).toBe('Private phrase');
  expect(normalizeAllergenValues([' Pine\t\nNuts ', 'PINE  NUTS'])).toEqual(['Pine Nuts']);
  expect(parseAllergenList(' Pine\t nuts, pine  NUTS；Milk\u00A0protein')).toEqual([
    'Pine nuts',
    'Milk protein',
  ]);
});

it('uses fixed Unicode case folding while retaining complete custom terms', () => {
  expect(parseAllergenList('ΟΣ,οσ,ος;Straße;STRASSE;Ᲊ;ᲊ;Ɤ;ɤ;İ;i;i\u0307')).toEqual([
    'ΟΣ',
    'Straße',
    'Ᲊ',
    'Ɤ',
    'İ',
    'i',
  ]);
  expect(parseAllergenList('PINE  NUTS, pine\t nuts; NUTS')).toEqual(['PINE NUTS', 'NUTS']);
});
