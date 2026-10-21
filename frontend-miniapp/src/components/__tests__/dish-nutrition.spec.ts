import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import DishNutrition from '../DishNutrition.vue';
import DishSummaryCard from '../DishSummaryCard.vue';

describe('per-serving nutrition display', () => {
  it('uses guest defaults, keeps zero and omits missing values', () => {
    const wrapper = mount(DishNutrition, {
      props: { dish: { calories: 0, protein: 20, fat: null } },
    });
    expect(wrapper.text()).toContain('每份');
    expect(wrapper.text()).toContain('热量 0 kcal');
    expect(wrapper.text()).not.toContain('蛋白质');
    wrapper.unmount();
    expect(
      mount(DishNutrition, { props: { dish: {} } })
        .find('.dish-nutrition')
        .exists()
    ).toBe(false);
  });
  it('responds immediately to each saved preference and logout', async () => {
    const store = useUserStore();
    store.token = 'signed-in';
    store.userInfo = {
      settings: { displaySettings: { showCalories: false, showNutrition: true } },
    } as any;
    const wrapper = mount(DishSummaryCard, {
      props: {
        dish: {
          id: 'd',
          name: '菜品',
          price: 0,
          images: [],
          calories: 310,
          protein: 0,
          carbohydrate: 25.5,
          fat: null,
        } as any,
      },
    });
    expect(wrapper.text()).not.toContain('kcal');
    expect(wrapper.text()).toContain('蛋白质 0 g');
    expect(wrapper.text()).toContain('碳水化合物 25.5 g');
    expect(wrapper.text()).not.toContain('脂肪');
    store.userInfo!.settings!.displaySettings = { showCalories: true, showNutrition: false };
    await nextTick();
    expect(wrapper.text()).toContain('热量 310 kcal');
    expect(wrapper.text()).not.toContain('蛋白质');
    store.userInfo!.settings!.displaySettings = { showCalories: false, showNutrition: false };
    await nextTick();
    expect(wrapper.find('.dish-nutrition').exists()).toBe(false);
    store.token = null;
    await nextTick();
    expect(wrapper.text()).toContain('热量 310 kcal');
  });
});
