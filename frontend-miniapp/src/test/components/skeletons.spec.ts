import { mount } from '@vue/test-utils';
import SkeletonBase from '@/components/skeleton/SkeletonBase.vue';
import AIChatSkeleton from '@/components/skeleton/AIChatSkeleton.vue';
import AddDishSkeleton from '@/components/skeleton/AddDishSkeleton.vue';
import AllergensSkeleton from '@/components/skeleton/AllergensSkeleton.vue';
import CanteenSkeleton from '@/components/skeleton/CanteenSkeleton.vue';
import DishDetailSkeleton from '@/components/skeleton/DishDetailSkeleton.vue';
import DishListSkeleton from '@/components/skeleton/DishListSkeleton.vue';
import DisplaySettingsSkeleton from '@/components/skeleton/DisplaySettingsSkeleton.vue';
import NewsDetailSkeleton from '@/components/skeleton/NewsDetailSkeleton.vue';
import NewsListSkeleton from '@/components/skeleton/NewsListSkeleton.vue';
import NotificationsSkeleton from '@/components/skeleton/NotificationsSkeleton.vue';
import PersonalSettingsSkeleton from '@/components/skeleton/PersonalSettingsSkeleton.vue';
import PlanningSkeleton from '@/components/skeleton/PlanningSkeleton.vue';
import PreferencesSkeleton from '@/components/skeleton/PreferencesSkeleton.vue';
import ProfileSkeleton from '@/components/skeleton/ProfileSkeleton.vue';
import ReviewListSkeleton from '@/components/skeleton/ReviewListSkeleton.vue';
import SearchSkeleton from '@/components/skeleton/SearchSkeleton.vue';
import SettingsSkeleton from '@/components/skeleton/SettingsSkeleton.vue';
import TagListSkeleton from '@/components/skeleton/TagListSkeleton.vue';
import WindowSkeleton from '@/components/skeleton/WindowSkeleton.vue';

describe('Skeleton components', () => {
  it('SkeletonBase applies props to style and classes', () => {
    const wrapper = mount(SkeletonBase, {
      props: {
        width: '32px',
        height: '16px',
        animated: false,
        roundedFull: true,
        rounded: 'rounded-lg',
        className: 'extra-class',
      },
    });

    const el = wrapper.find('.skeleton-item');
    expect(el.exists()).toBe(true);
    // style should contain width/height
    const style = (el.element as HTMLElement).getAttribute('style') || '';
    expect(style).toContain('width: 32px');
    expect(style).toContain('height: 16px');
    // classes
    expect(el.classes()).toContain('rounded-full');
    expect(el.classes()).toContain('rounded-lg');
    expect(el.classes()).toContain('extra-class');
    // animated was turned off
    expect(el.classes()).not.toContain('skeleton-animated');
  });

  const simpleComponents = [
    { comp: AIChatSkeleton, expectClass: 'rounded-2xl' },
    { comp: AddDishSkeleton, expectClass: 'rounded-lg' },
    { comp: AllergensSkeleton, expectClass: 'rounded' },
    { comp: CanteenSkeleton, expectClass: 'rounded' },
    { comp: DishDetailSkeleton, expectClass: 'rounded' },
    { comp: DishListSkeleton, expectClass: 'rounded' },
    { comp: DisplaySettingsSkeleton, expectClass: 'rounded' },
    { comp: NewsDetailSkeleton, expectClass: 'rounded' },
    { comp: NewsListSkeleton, expectClass: 'rounded' },
    { comp: NotificationsSkeleton, expectClass: 'rounded' },
    { comp: PersonalSettingsSkeleton, expectClass: 'rounded' },
    { comp: PlanningSkeleton, expectClass: 'rounded' },
    { comp: PreferencesSkeleton, expectClass: 'rounded' },
    { comp: ProfileSkeleton, expectClass: 'rounded' },
    { comp: ReviewListSkeleton, expectClass: 'rounded' },
    { comp: SearchSkeleton, expectClass: 'rounded' },
    { comp: SettingsSkeleton, expectClass: 'rounded' },
    { comp: TagListSkeleton, expectClass: 'rounded' },
    { comp: WindowSkeleton, expectClass: 'rounded' },
  ];

  for (const item of simpleComponents) {
    it(`${item.comp.name} renders skeleton items and has expected classes`, () => {
      const wrapper = mount(item.comp as any);
      const items = wrapper.findAll('.skeleton-item');
      expect(items.length).toBeGreaterThan(0);
      // assert at least one element contains expected rounded class (if present)
      const found = wrapper.findAll(`.${item.expectClass}`).length > 0;
      expect(found).toBe(true);
    });
  }
});