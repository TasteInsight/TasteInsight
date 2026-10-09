import type { GetDishesRequest, UserSettings } from '@/types/api';

export function getPreferredDishSort(
  sortBy?: NonNullable<UserSettings['displaySettings']>['sortBy']
): GetDishesRequest['sort'] {
  switch (sortBy) {
    case 'popularity':
      return { field: 'reviewCount', order: 'desc' };
    case 'newest':
      return { field: 'createdAt', order: 'desc' };
    case 'price_low':
      return { field: 'price', order: 'asc' };
    case 'price_high':
      return { field: 'price', order: 'desc' };
    default:
      return { field: 'averageRating', order: 'desc' };
  }
}
