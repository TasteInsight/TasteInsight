import { mount, shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { locale } from '@/i18n';
import FilterBar from '../FilterBar.vue';
import AddDishPage from '@/pages/add-dish/index.vue';
import ReportDialog from '@/components/ReportDialog.vue';
import ReviewForm from '@/pages/dish/components/ReviewForm.vue';
import TasteProfile from '@/pages/dish/components/TasteProfile.vue';
import CanteenWindowList from '@/pages/canteen/components/CanteenWindowList.vue';
import WindowHeader from '@/pages/window/components/WindowHeader.vue';
import WindowResultItem from '@/pages/search/components/WindowResultItem.vue';
import { getCanteenList } from '@/api/modules/canteen';
import { uploadDish } from '@/api/modules/dish';

jest.mock('@dcloudio/uni-app', () => ({ onBackPress: jest.fn(), onHide: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({
    sessionVersion: 1,
    isLoggedIn: true,
    userInfo: { id: 'student', capabilities: { canContribute: true } },
  }),
}));
jest.mock('@/api/modules/canteen', () => ({ getCanteenList: jest.fn() }));
jest.mock('@/api/modules/dish', () => ({ uploadDish: jest.fn(), getDishById: jest.fn() }));
jest.mock('@/api/modules/review', () => ({ createReview: jest.fn() }));

const wrappers: VueWrapper[] = [];
const keep = <T extends VueWrapper>(wrapper: T): T => {
  wrappers.push(wrapper);
  return wrapper;
};
const button = (wrapper: VueWrapper, label: string) => {
  const found = wrapper.findAll('button').find(item => item.text() === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
};
beforeEach(() => {
  jest.clearAllMocks();
  locale.value = 'zh-Hans';
  Object.assign(uni, {
    getStorageSync: jest.fn(),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
    setNavigationBarTitle: jest.fn(),
    pageScrollTo: jest.fn(),
    showModal: jest.fn(),
    showToast: jest.fn(),
  });
  (globalThis as any).getCurrentPages = () => [];
  (getCanteenList as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [{ id: 'canteen', name: '中文食堂', windows: [] }] },
  });
  (uploadDish as jest.Mock).mockResolvedValue({ code: 201, data: { id: 'submission' } });
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  locale.value = 'zh-Hans';
});

it('preserves each Chinese floor label and updates generated floor labels in English', async () => {
  const windows = keep(
    mount(CanteenWindowList, {
      props: {
        windows: [
          { id: 'first', name: '家常菜', floor: { level: '3' } },
          { id: 'second', name: '面食', floor: { name: '二层', level: '2' } },
        ] as any,
      },
    })
  );
  const header = keep(
    mount(WindowHeader, {
      props: { window: { id: 'first', name: '家常菜', floor: { level: '1' } } as any },
    })
  );
  const result = keep(
    mount(WindowResultItem, {
      props: { window: { id: 'first', name: '家常菜', floor: { level: '3' } } as any },
    })
  );
  expect(windows.findAll('.canteen-window-floor').map(item => item.text())).toEqual([
    '3层',
    '二层',
  ]);
  expect(header.text()).toContain('1层');
  expect(result.text()).toContain('3楼');
  locale.value = 'en';
  await nextTick();
  expect(windows.findAll('.canteen-window-floor').map(item => item.text())).toEqual([
    'Floor 3',
    '二层',
  ]);
  expect(header.text()).toContain('Floor 1');
  expect(result.text()).toContain('Floor 3');
});

it('updates open filter labels and accessible chips while preserving API enum values', async () => {
  const wrapper = keep(
    mount(FilterBar, {
      props: { filter: { price: { min: 10, max: 15 } } },
      global: { stubs: { slider: true } },
    })
  );
  await wrapper.get('.filter-trigger').trigger('click');
  expect(button(wrapper, '招牌').exists()).toBe(true);
  locale.value = 'en';
  await nextTick();
  expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Filter dishes');
  expect(wrapper.find('[aria-label="Remove ¥10–15"]').exists()).toBe(true);
  await button(wrapper, 'Signature').trigger('click');
  await button(wrapper, 'Vegetarian').trigger('click');
  await button(wrapper, 'Peanuts').trigger('click');
  await button(wrapper, 'Lunch').trigger('click');
  await button(wrapper, 'Apply').trigger('click');
  const filter = wrapper.emitted('filter-change')![0][0];
  expect(filter).toEqual({
    price: { min: 10, max: 15 },
    tag: ['招牌'],
    meatPreference: ['素'],
    avoidIngredients: ['花生'],
    mealTime: ['lunch'],
  });
  await wrapper.setProps({ filter: filter as any });
  expect(wrapper.find('[aria-label="Remove Tag: Signature"]').exists()).toBe(true);
  expect(wrapper.find('[aria-label="Remove Avoid: Peanuts"]').exists()).toBe(true);
  locale.value = 'zh-Hans';
  await nextTick();
  expect(wrapper.find('[aria-label="移除标签：招牌"]').exists()).toBe(true);
});

it('translates contribution controls and validation while submitting the original tag and allergen values', async () => {
  const wrapper = keep(shallowMount(AddDishPage));
  await flushPromises();
  locale.value = 'en';
  await nextTick();
  expect(uni.setNavigationBarTitle).toHaveBeenLastCalledWith({ title: 'Suggest a dish' });
  await wrapper.get('.submit-button').trigger('tap');
  await flushPromises();
  expect(wrapper.get('#field-name').text()).toContain('Enter a dish name');
  await wrapper.get('#dish-name').setValue('用户菜名');
  await wrapper.get('#dish-price').setValue('12');
  await button(wrapper, '中文食堂').trigger('tap');
  await button(wrapper, 'Lunch').trigger('tap');
  await wrapper.get('.optional-toggle').trigger('tap');
  expect(wrapper.text()).toContain('Nutrition per serving (optional)');
  await button(wrapper, 'Signature').trigger('tap');
  await button(wrapper, 'Peanuts').trigger('tap');
  locale.value = 'zh-Hans';
  await nextTick();
  expect(button(wrapper, '招牌').attributes('aria-pressed')).toBe('true');
  locale.value = 'en';
  await nextTick();
  await wrapper.get('.submit-button').trigger('tap');
  await flushPromises();
  expect(uploadDish).toHaveBeenCalledWith(
    expect.objectContaining({
      name: '用户菜名',
      canteenName: '中文食堂',
      tags: ['招牌'],
      allergens: ['花生'],
      availableMealTime: ['lunch'],
    })
  );
});

it('updates report picker choices and sends the stable report type', async () => {
  const wrapper = keep(mount(ReportDialog, { global: { stubs: { 'page-container': true } } }));
  const picker = wrapper.findComponent({ name: 'UiPicker' });
  picker.vm.$emit('change', { detail: { value: 0 } });
  await nextTick();
  locale.value = 'en';
  await nextTick();
  expect((picker.props('range') as any[])[0].label).toBe('Inappropriate content');
  expect(wrapper.text()).toContain('Inappropriate content');
  await wrapper.get('#report-reason').setValue('Reason');
  await button(wrapper, 'Submit report').trigger('tap');
  expect(wrapper.emitted('submit')).toEqual([[{ type: 'inappropriate', reason: 'Reason' }]]);
});

it('updates review ratings and taste accessibility text without changing the selected score', async () => {
  const review = keep(
    shallowMount(ReviewForm, { props: { dishId: 'dish', dishName: '用户菜名' } })
  );
  await review.get('[aria-label="总体评分 4 星"]').trigger('tap');
  const taste = keep(
    mount(TasteProfile, {
      props: { taste: { spicyLevel: 3, sweetness: 2, saltiness: 1, oiliness: 4 } },
    })
  );
  locale.value = 'en';
  await nextTick();
  expect(review.get('[aria-label="Overall rating: 4 of 5 stars"]').attributes('aria-pressed')).toBe(
    'true'
  );
  expect(review.text()).toContain('Good');
  expect(review.text()).toContain('Spiciness');
  expect(taste.get('[data-taste="spicyLevel"]').attributes('aria-label')).toBe(
    'Spiciness: intensity 3 of 5, from low to high'
  );
});
