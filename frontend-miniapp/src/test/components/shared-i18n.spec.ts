import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { locale } from '@/i18n';
import AsyncState from '@/components/AsyncState.vue';
import SearchBar from '@/components/SearchBar.vue';
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import { priceUnitSuffix } from '@/utils/price-display';

beforeEach(() => {
  locale.value = 'zh-Hans';
});
afterEach(() => {
  locale.value = 'zh-Hans';
});

test('shared defaults update while mounted and preserve caller-supplied text', async () => {
  const state = mount(AsyncState, { props: { error: 'API detail', hasContent: false } });
  const search = mount(SearchBar, { global: { stubs: { 'uni-icons': true } } });
  expect(state.text()).toContain('重新加载');
  expect(search.text()).toContain('搜索');
  locale.value = 'en';
  await nextTick();
  expect(state.text()).toContain('Reload');
  expect(state.text()).toContain('API detail');
  expect(search.text()).toContain('Search');
  state.unmount();
  search.unmount();
});

test('dish presentation translates labels and units while preserving catalog data', async () => {
  const dish = {
    id: 'dish',
    name: '宫保鸡丁',
    canteenName: '第一食堂',
    status: 'offline',
    price: 12,
    priceUnit: '元/份',
    averageRating: 4.5,
    reviewCount: 1,
    images: [],
  };
  const card = mount(DishSummaryCard, { props: { dish: dish as any } });
  locale.value = 'en';
  await nextTick();
  expect(card.text()).toContain('宫保鸡丁');
  expect(card.text()).toContain('第一食堂');
  expect(card.text()).toContain('Unavailable');
  expect(card.text()).toContain('/serving');
  expect(card.text()).toContain('1 review');
  expect(card.attributes('aria-label')).toBe('View 宫保鸡丁, unavailable');
  expect(priceUnitSuffix('元/100克')).toBe('/100 g');
  expect(dish.priceUnit).toBe('元/份');
  card.unmount();
});
