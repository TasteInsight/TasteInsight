import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PlanEditDialog from '@/components/meal-plan/PlanEditDialog.vue';
import { getDishes } from '@/api/modules/dish';
import { getWindowList, getCanteenList } from '@/api/modules/canteen';

const mockCanteenStore = {
  canteenList: [{ id: 'c1', name: '第一食堂' }],
  fetchCanteenList: jest.fn(),
};

jest.mock('@/store/modules/use-canteen-store', () => ({
  useCanteenStore: () => mockCanteenStore,
}));
jest.mock('@/api/modules/canteen', () => ({
  getWindowDishes: jest.fn(),
  getWindowList: jest.fn(),
  getCanteenList: jest.fn(),
}));
jest.mock('@/api/modules/dish', () => ({ getDishes: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (getDishes as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { page: 1, totalPages: 1 } },
  });
  (getWindowList as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [{ id: 'w1', name: '素食窗口' }], meta: { totalPages: 1 } },
  });
  (getCanteenList as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: mockCanteenStore.canteenList, meta: { totalPages: 1 } },
  });
});

test('window and keyword compose a server query, and clearing keyword keeps the window', async () => {
  setActivePinia(createPinia());
  const wrapper = mount(PlanEditDialog, { props: { visible: true, plan: null } });
  const vm = wrapper.vm as any;
  await vm.onCanteenChange({ detail: { value: 0 } });
  await vm.onWindowChange({ detail: { value: 0 } });
  vm.searchKeyword = '豆腐';
  await vm.handleSearch();
  expect(getDishes).toHaveBeenLastCalledWith(
    expect.objectContaining({
      filter: expect.objectContaining({ canteenId: ['c1'], windowId: ['w1'] }),
      search: { keyword: '豆腐' },
      pagination: { page: 1, pageSize: 10 },
    })
  );
  await vm.clearSearch();
  expect(getDishes).toHaveBeenLastCalledWith(
    expect.objectContaining({
      filter: expect.objectContaining({ windowId: ['w1'] }),
      search: { keyword: '' },
    })
  );
  expect(vm.selectedWindow.id).toBe('w1');
  wrapper.unmount();
});

test('unchanged planning closes directly, while a dirty meal requires discard confirmation', async () => {
  setActivePinia(createPinia());
  const wrapper = mount(PlanEditDialog, { props: { visible: true, plan: null } });
  const vm = wrapper.vm as any;
  await vm.handleClose();
  expect(uni.showModal).not.toHaveBeenCalled();
  expect(wrapper.emitted('close')).toHaveLength(1);
  vm.toggleDishSelection({ id: 'rice', name: '米饭' });
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => success({ confirm: false }));
  await vm.handleClose();
  expect(uni.showModal).toHaveBeenCalled();
  expect(wrapper.emitted('close')).toHaveLength(1);
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => success({ confirm: true }));
  await vm.handleClose();
  expect(wrapper.emitted('close')).toHaveLength(2);
  wrapper.unmount();
});

test('planning append failure retains its candidate list and retries the same page', async () => {
  setActivePinia(createPinia());
  const wrapper = mount(PlanEditDialog, { props: { visible: true, plan: null } });
  const vm = wrapper.vm as any;
  (getDishes as jest.Mock)
    .mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'first', name: '米饭' }], meta: { page: 1, totalPages: 2 } },
    })
    .mockRejectedValueOnce(new Error('加载中断'))
    .mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'second', name: '豆腐' }], meta: { page: 2, totalPages: 2 } },
    });
  vm.searchKeyword = '豆腐';
  await vm.handleSearch();
  await vm.loadNextPage();
  expect(vm.dishList.map((dish: any) => dish.id)).toEqual(['first']);
  expect(vm.dishError).toBe('加载中断');
  await vm.loadNextPage();
  expect((getDishes as jest.Mock).mock.calls.map(([query]) => query.pagination.page)).toEqual([
    1, 2, 2,
  ]);
  wrapper.unmount();
});

test('planning loads all canteen options locally without replacing the home canteen cache', async () => {
  setActivePinia(createPinia());
  (getCanteenList as jest.Mock)
    .mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'c1', name: '第一食堂' }], meta: { totalPages: 2 } },
    })
    .mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'c2', name: '第二食堂' }], meta: { totalPages: 2 } },
    });
  const wrapper = mount(PlanEditDialog, { props: { visible: true, plan: null } });
  await flushPromises();
  expect((wrapper.vm as any).canteenList.map((item: any) => item.id)).toEqual(['c1', 'c2']);
  expect(mockCanteenStore.canteenList.map(item => item.id)).toEqual(['c1']);
  expect(getCanteenList).toHaveBeenLastCalledWith({ page: 2, pageSize: 50 });
  wrapper.unmount();
});

test('a closed and reopened planning dialog ignores an earlier discard confirmation', async () => {
  setActivePinia(createPinia());
  let resolveModal!: (value: { confirm: boolean }) => void;
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => {
    resolveModal = success;
  });
  const wrapper = mount(PlanEditDialog, { props: { visible: true, plan: null } });
  const vm = wrapper.vm as any;
  vm.toggleDishSelection({ id: 'rice', name: '米饭' });
  const closing = vm.requestClose();
  await wrapper.setProps({ visible: false });
  await wrapper.setProps({ visible: true });
  resolveModal({ confirm: true });
  expect(await closing).toBe(false);
  expect(wrapper.emitted('close')).toBeUndefined();
  wrapper.unmount();
});

test('the save button follows parent pending state and emits an immutable command snapshot', async () => {
  setActivePinia(createPinia());
  const wrapper = mount(PlanEditDialog, {
    props: { visible: true, plan: null, submitting: true },
    global: { stubs: { picker: { template: '<div><slot /></div>' } } },
  });
  const form = (wrapper.vm as any).formData;
  Object.assign(form, {
    startDate: '2026-10-03',
    endDate: '2026-10-03',
    mealTime: 'lunch',
    dishes: ['dish'],
  });
  const saveButton = () => wrapper.find('[data-testid="plan-save"]');
  expect(saveButton().text()).toBe('提交中...');
  expect(saveButton().classes()).toContain('plan-button-disabled');
  await saveButton().trigger('tap');
  expect(wrapper.emitted('submit')).toBeUndefined();
  await wrapper.setProps({ submitting: false });
  expect(saveButton().text()).toBe('确认保存');
  expect(saveButton().classes()).not.toContain('plan-button-disabled');
  await saveButton().trigger('tap');
  const command = wrapper.emitted('submit')![0][0] as any;
  form.dishes.push('another');
  expect(command.dishes).toEqual(['dish']);
  wrapper.unmount();
});

test('a new meal preselects the dish and keeps a single date with an editable suggested meal', async () => {
  setActivePinia(createPinia());
  const dish = {
    id: 'rice',
    name: '米饭',
    images: [],
    price: 3,
    availableMealTime: ['lunch'],
    averageRating: 0,
  } as any;
  const wrapper = mount(PlanEditDialog, {
    props: { visible: true, plan: null, initialDishes: [dish] },
  });
  const vm = wrapper.vm as any;
  expect(vm.formData.startDate).toBe(vm.formData.endDate);
  expect(vm.formData.mealTime).toBe('lunch');
  expect(vm.formData.dishes).toEqual(['rice']);
  expect(wrapper.text()).toContain('米饭');
  expect(wrapper.find('[data-testid="plan-end-date"]').exists()).toBe(false);
  vm.onStartDateChange({ detail: { value: '2099-10-05' } });
  vm.selectMealTime('dinner');
  vm.handleSubmit();
  expect(wrapper.emitted('submit')![0][0]).toEqual({
    startDate: '2099-10-05',
    endDate: '2099-10-05',
    mealTime: 'dinner',
    dishes: ['rice'],
  });
  wrapper.unmount();
});

test('editing an existing multi-day plan preserves both dates and permits explicit single-day selection', async () => {
  setActivePinia(createPinia());
  const plan = {
    id: 'plan',
    startDate: '2099-10-03',
    endDate: '2099-10-06',
    mealTime: 'dinner',
    dishes: [{ id: 'rice', name: '米饭', price: 3, images: [] }],
  } as any;
  const wrapper = mount(PlanEditDialog, { props: { visible: true, plan } });
  const vm = wrapper.vm as any;
  expect(vm.multiDay).toBe(true);
  expect(wrapper.find('[data-testid="plan-end-date"]').exists()).toBe(true);
  vm.handleSubmit();
  expect(wrapper.emitted('submit')![0][0]).toMatchObject({
    startDate: '2099-10-03',
    endDate: '2099-10-06',
  });
  vm.toggleMultiDay();
  vm.onStartDateChange({ detail: { value: '2099-10-07' } });
  vm.handleSubmit();
  expect(wrapper.emitted('submit')![1][0]).toMatchObject({
    startDate: '2099-10-07',
    endDate: '2099-10-07',
  });
  wrapper.unmount();
});

test('dish selection hides missing and failed photos and displays a new image resource', async () => {
  setActivePinia(createPinia());
  const wrapper = mount(PlanEditDialog, { props: { visible: true, plan: null } });
  const vm = wrapper.vm as any;
  const withImage = (url: string) => ({
    id: 'rice',
    name: '米饭',
    images: [url],
    price: 3,
    averageRating: 0,
  });
  vm.dishList = [{ ...withImage(''), images: [] }];
  await wrapper.vm.$nextTick();
  expect(wrapper.find('.plan-result-image').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('暂无图片');
  vm.dishList = [withImage('https://images.test/old.jpg')];
  await wrapper.vm.$nextTick();
  await wrapper.get('image.plan-result-image').trigger('error');
  expect(wrapper.find('image.plan-result-image').exists()).toBe(false);
  expect(wrapper.find('.plan-result-image').exists()).toBe(false);
  vm.dishList = [withImage('https://images.test/current.jpg')];
  await wrapper.vm.$nextTick();
  expect(wrapper.get('image.plan-result-image').attributes('src')).toBe(
    'https://images.test/current.jpg'
  );
  wrapper.unmount();
});
