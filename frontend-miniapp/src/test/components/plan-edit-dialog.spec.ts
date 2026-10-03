import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PlanEditDialog from '@/pages/planning/components/PlanEditDialog.vue';

jest.mock('@/store/modules/use-canteen-store', () => ({
  useCanteenStore: () => ({ canteenList: [], fetchCanteenList: jest.fn() }),
}));
jest.mock('@/api/modules/canteen', () => ({ getWindowDishes: jest.fn(), getWindowList: jest.fn() }));
jest.mock('@/api/modules/dish', () => ({ getDishes: jest.fn() }));

test('the save button follows parent pending state and emits an immutable command snapshot', async () => {
  setActivePinia(createPinia());
  const wrapper = mount(PlanEditDialog, {
    props: { visible: true, plan: null, submitting: true },
    global: { stubs: { picker: { template: '<div><slot /></div>' } } },
  });
  const form = (wrapper.vm as any).formData;
  Object.assign(form, {
    startDate: '2026-10-03', endDate: '2026-10-03', mealTime: 'lunch', dishes: ['dish'],
  });
  const saveButton = () => wrapper.find('.px-6.py-5 [class~="shadow-purple-200"]');
  expect(saveButton().text()).toBe('提交中...');
  await saveButton().trigger('tap');
  expect(wrapper.emitted('submit')).toBeUndefined();
  await wrapper.setProps({ submitting: false });
  expect(saveButton().text()).toBe('确认保存');
  await saveButton().trigger('tap');
  const command = wrapper.emitted('submit')![0][0] as any;
  form.dishes.push('another');
  expect(command.dishes).toEqual(['dish']);
  wrapper.unmount();
});
