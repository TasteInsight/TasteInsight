import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { BatchParsedDishDto } from '@/admin-dishes/dto/admin-dish-batch.dto';
import { expandAllergenValues } from './allergen-values';

const catalog = [
  {
    value: '花生',
    nameZh: '花生',
    nameEn: 'Peanuts',
    aliases: ['Peanut', 'Peanuts', '花生'],
  },
  {
    value: '坚果',
    nameZh: '坚果',
    nameEn: 'Tree nuts',
    aliases: ['Tree nut', 'Tree nuts', '坚果'],
  },
];

it('resolves every language and case to the same complete alias group', () => {
  for (const input of ['花生', 'peanut', 'PEANUTS']) {
    expect(expandAllergenValues([input], catalog)).toEqual([
      '花生',
      'Peanuts',
      'Peanut',
    ]);
  }
});

it('preserves unknown custom phrases without splitting words or guessing translations', () => {
  expect(
    expandAllergenValues(
      ['Pine nuts', '自定义成分', '  Pine nuts  ', ''],
      catalog,
    ),
  ).toEqual(['Pine nuts', '自定义成分']);
});

it('deduplicates known aliases while retaining distinct allergen identities', () => {
  expect(
    expandAllergenValues(['Peanuts', '花生', 'TREE NUTS'], catalog),
  ).toEqual(['花生', 'Peanuts', 'Peanut', '坚果', 'Tree nuts', 'Tree nut']);
});

it('preserves multiword allergen identities in batch confirmation text', () => {
  const dto = plainToInstance(BatchParsedDishDto, {
    allergens: 'Pine nuts, Milk protein；花生',
  });
  expect(dto.allergens).toEqual(['Pine nuts', 'Milk protein', '花生']);
});
