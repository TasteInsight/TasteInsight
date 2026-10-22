import { t } from '@/i18n';

const units = new Map([
  ['份', 'serving'],
  ['碗', 'bowl'],
  ['盘', 'plate'],
  ['个', 'piece'],
  ['杯', 'cup'],
  ['斤', 'jin'],
  ['两', 'liang'],
  ['克', 'gram'],
  ['千克', 'kilogram'],
  ['100克', 'hundredGrams'],
]);

export function normalizePriceUnit(priceUnit?: string | null): string {
  return (priceUnit || '')
    .trim()
    .replace(/^元\/?/, '')
    .trim();
}

export function priceUnitSuffix(priceUnit?: string | null): string {
  const unit = normalizePriceUnit(priceUnit);
  const key = units.get(unit);
  return unit ? `/${key ? t(`common.price.${key}`) : unit}` : '';
}
