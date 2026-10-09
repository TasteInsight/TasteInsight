import { getPreferredDishSort } from '@/utils/dish-sort';

it.each([
  [undefined, 'averageRating', 'desc'],
  ['rating', 'averageRating', 'desc'],
  ['popularity', 'reviewCount', 'desc'],
  ['newest', 'createdAt', 'desc'],
  ['price_low', 'price', 'asc'],
  ['price_high', 'price', 'desc'],
] as const)('maps %s to the existing dish query contract', (sortBy, field, order) => {
  expect(getPreferredDishSort(sortBy)).toEqual({ field, order });
});
