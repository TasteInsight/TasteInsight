export function priceUnitSuffix(priceUnit?: string | null): string {
  const unit = (priceUnit || '').trim().replace(/^元\/?/, '').trim();
  return unit ? `/${unit}` : '';
}
