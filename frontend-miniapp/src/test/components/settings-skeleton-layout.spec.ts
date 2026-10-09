import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { getUserProfile } from '@/api/modules/user';
import { getCanteenList } from '@/api/modules/canteen';
import DisplayPage from '@/pages/settings/components/display.vue';
import PreferencesPage from '@/pages/settings/components/preferences.vue';
import NotificationsPage from '@/pages/settings/components/notifications.vue';
import AllergensPage from '@/pages/settings/components/allergens.vue';
import DisplaySkeleton from '@/components/skeleton/DisplaySettingsSkeleton.vue';
import PreferencesSkeleton from '@/components/skeleton/PreferencesSkeleton.vue';
import NotificationsSkeleton from '@/components/skeleton/NotificationsSkeleton.vue';
import AllergensSkeleton from '@/components/skeleton/AllergensSkeleton.vue';
import { COMMON_ALLERGENS } from '@/pages/settings/composables/use-allergens';

jest.mock('@dcloudio/uni-app', () => ({ onBackPress: jest.fn() }));
jest.mock('@/api/modules/user', () => ({
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
}));
jest.mock('@/api/modules/canteen', () => ({ getCanteenList: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(uni, {
    getStorageSync: jest.fn(key =>
      key === 'token' ? 'token' : key === 'userInfo' ? JSON.stringify({ id: 'user' }) : undefined
    ),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
  });
  setActivePinia(createPinia());
  (getUserProfile as jest.Mock).mockImplementation(() => new Promise(() => {}));
  (getCanteenList as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { totalPages: 1 } },
  });
});

it.each([
  ['display', DisplayPage, DisplaySkeleton],
  ['preferences', PreferencesPage, PreferencesSkeleton],
  ['notifications', NotificationsPage, NotificationsSkeleton],
  ['allergens', AllergensPage, AllergensSkeleton],
] as const)(
  '%s keeps the existing page viewport blank until profile initialization succeeds',
  (_name, Page) => {
    const wrapper = mount(Page as any);
    expect(wrapper.findAll('.page-content')).toHaveLength(1);
    expect(wrapper.findAll('.settings-page')).toHaveLength(1);
    expect(wrapper.find('.skeleton-item').exists()).toBe(false);
    expect(wrapper.get('.settings-form-body').text()).toBe('');
    expect(wrapper.get('.settings-form-body').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('.settings-save-bar').exists()).toBe(false);
    wrapper.unmount();
  }
);

it.each([
  [DisplaySkeleton, 2],
  [NotificationsSkeleton, 4],
] as const)('matches the actual toggle row count', (Skeleton, count) => {
  const wrapper = mount(Skeleton);
  expect(wrapper.findAll('.settings-skeleton-toggle')).toHaveLength(count);
  wrapper.unmount();
});

it('keeps preference skeletons in taste, portion, price and ingredient order', () => {
  const wrapper = mount(PreferencesSkeleton);
  const sections = wrapper.findAll('.preferences-skeleton-section');
  expect(sections).toHaveLength(7);
  expect(sections[0].findAll('.preferences-skeleton-taste-row')).toHaveLength(4);
  expect(sections[1].find('.preferences-skeleton-portion').exists()).toBe(true);
  expect(sections[2].find('.preferences-skeleton-price').exists()).toBe(true);
  expect(
    sections
      .slice(3, 6)
      .every(section => section.classes().includes('preferences-skeleton-ingredient'))
  ).toBe(true);
  expect(sections[6].classes()).toContain('preferences-skeleton-canteen');
  expect(wrapper.findAll('.preferences-skeleton-taste-row')).toHaveLength(4);
  expect(wrapper.findAll('.preferences-skeleton-portion .skeleton-item')).toHaveLength(3);
  expect(
    wrapper.findAll('.preferences-skeleton-price .preferences-skeleton-price-field')
  ).toHaveLength(2);
  expect(wrapper.findAll('.preferences-skeleton-ingredient')).toHaveLength(3);
  expect(wrapper.find('.preferences-skeleton-canteen').exists()).toBe(true);
  wrapper.unmount();
});

it('matches the 140px allergen input and 44px option heights', () => {
  const wrapper = mount(AllergensSkeleton);
  expect(wrapper.get('.allergens-skeleton-input').attributes('style')).toContain('height: 140px');
  const options = wrapper.findAll('.allergens-skeleton-option');
  expect(options).toHaveLength(COMMON_ALLERGENS.length);
  for (const option of options) expect(option.attributes('style')).toContain('height: 44px');
  wrapper.unmount();
});
