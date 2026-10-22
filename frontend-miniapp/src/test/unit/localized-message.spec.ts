import { locale, t } from '@/i18n';
import { useLocalizedMessage } from '@/composables/use-localized-message';
import { useFilter } from '@/pages/index/composables/use-filter';

afterEach(() => {
  locale.value = 'zh-Hans';
});

test('relocalizes existing validation state after language changes', () => {
  locale.value = 'zh-Hans';
  const filter = useFilter();
  filter.customPriceMin.value = '-1';
  expect(filter.validatePriceInput()).toBe(false);
  const original = filter.priceError.value;
  locale.value = 'en';
  expect(filter.priceError.value).toBe(t('food.enterAMinimumPriceOfZeroOrMore'));
  expect(filter.priceError.value).not.toBe(original);
});

test('retains original business details and clears state normally', () => {
  const message = useLocalizedMessage();
  message.value = 'Original review detail';
  locale.value = 'en';
  expect(message.value).toBe('Original review detail');
  message.value = '';
  expect(message.value).toBe('');
});
