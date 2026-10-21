import { shallowMount, flushPromises } from '@vue/test-utils';
import AddDishPage from '@/pages/add-dish/index.vue';
import UiIcon from '@/components/UiIcon.vue';
import { getCanteenList } from '@/api/modules/canteen';
import { getDishById, uploadDish } from '@/api/modules/dish';
import { onBackPress } from '@dcloudio/uni-app';
jest.mock('@dcloudio/uni-app', () => ({ onBackPress: jest.fn(), onHide: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({
    sessionVersion: 1,
    isLoggedIn: true,
    userInfo: { id: 'A', capabilities: { canContribute: true } },
  }),
}));
jest.mock('@/api/modules/canteen', () => ({ getCanteenList: jest.fn() }));
jest.mock('@/api/modules/dish', () => ({ uploadDish: jest.fn(), getDishById: jest.fn() }));
const uniMock = {
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  setNavigationBarTitle: jest.fn(),
  showToast: jest.fn(),
  navigateBack: jest.fn(),
  showModal: jest.fn(),
  pageScrollTo: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
  (global as any).uni = uniMock;
  (global as any).getCurrentPages = () => [];
  (getCanteenList as jest.Mock).mockResolvedValue({ code: 200, data: { items: [] } });
});

it('shows visible validation and focuses the first field instead of silently disabling submit', async () => {
  const wrapper = shallowMount(AddDishPage);
  await flushPromises();
  expect(wrapper.get('.submit-button').attributes('disabled')).toBeUndefined();
  await wrapper.get('.submit-button').trigger('tap');
  await flushPromises();
  expect(wrapper.get('#field-name').text()).toContain('请输入菜品名称');
  expect(uniMock.pageScrollTo).toHaveBeenCalledWith({ selector: '#field-name', duration: 200 });
  expect(uploadDish).not.toHaveBeenCalled();
  wrapper.unmount();
});

it('offers a location retry and no unsupported free-text window input', async () => {
  (getCanteenList as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const wrapper = shallowMount(AddDishPage);
  await flushPromises();
  expect(wrapper.text()).toContain('重新加载');
  (wrapper.vm as any).formData.name = 'Draft';
  const canteen = { id: 'c', name: 'Canteen', windows: [] };
  (getCanteenList as jest.Mock).mockResolvedValueOnce({ code: 200, data: { items: [canteen] } });
  await wrapper.get('.error-feedback__action').trigger('tap');
  await flushPromises();
  await wrapper.get('.location-choice').trigger('tap');
  expect((wrapper.vm as any).formData.name).toBe('Draft');
  expect(wrapper.text()).toContain('可按食堂提交申请');
  expect(wrapper.find('[placeholder="请输入窗口名称"]').exists()).toBe(false);
  wrapper.unmount();
});

it('does not confirm a pristine form and preserves a cancelled dirty return', async () => {
  const wrapper = shallowMount(AddDishPage);
  await flushPromises();
  const back = (onBackPress as jest.Mock).mock.calls[0][0];
  expect(back()).toBe(false);
  expect(uniMock.showModal).not.toHaveBeenCalled();
  (wrapper.vm as any).formData.name = 'Draft';
  uniMock.showModal.mockImplementation(({ success }) => success({ confirm: false }));
  expect(back()).toBe(true);
  await flushPromises();
  expect((wrapper.vm as any).formData.name).toBe('Draft');
  expect(uniMock.navigateBack).not.toHaveBeenCalled();
  wrapper.unmount();
});

it('keeps conflict recovery enabled and only discards input after explicit confirmation', async () => {
  (global as any).getCurrentPages = () => [{ options: { targetDishId: 'dish' } }];
  const original = {
    id: 'dish',
    name: '面条',
    price: 12,
    canteenId: 'c',
    canteenName: '食堂',
    images: [],
    availableMealTime: ['lunch'],
    updatedAt: '2026-10-11T01:00:00Z',
  };
  (getDishById as jest.Mock)
    .mockResolvedValueOnce({ code: 200, data: original })
    .mockResolvedValue({
      code: 200,
      data: { ...original, price: 13, updatedAt: '2026-10-11T02:00:00Z' },
    });
  (uploadDish as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('菜品资料已更新'), { statusCode: 409 })
  );
  const wrapper = shallowMount(AddDishPage);
  await flushPromises();
  (wrapper.vm as any).formData.price = 15;
  await wrapper.get('.submit-button').trigger('tap');
  await flushPromises();
  expect(wrapper.get('#contribution-conflict').text()).toContain('菜品资料已更新');
  expect(wrapper.get('.draft-discard').attributes('disabled')).toBeUndefined();
  expect(wrapper.get('.draft-discard').text()).toContain('加载最新资料');
  uniMock.showModal.mockImplementation(({ success }) => success({ confirm: false }));
  await wrapper.get('.draft-discard').trigger('tap');
  await flushPromises();
  expect((wrapper.vm as any).formData.price).toBe(15);
  expect(getDishById).toHaveBeenCalledTimes(1);
  uniMock.showModal.mockImplementation(({ success }) => success({ confirm: true }));
  await wrapper.get('.draft-discard').trigger('tap');
  await flushPromises();
  expect((wrapper.vm as any).formData.price).toBe(13);
  expect(wrapper.find('#contribution-conflict').exists()).toBe(false);
  wrapper.unmount();
});

it('keeps essential fields in the main flow and reveals the optional description on demand', async () => {
  const wrapper = shallowMount(AddDishPage);
  await flushPromises();
  expect(wrapper.find('.form-intro').exists()).toBe(false);
  expect(wrapper.find('#dish-name').exists()).toBe(true);
  expect(wrapper.find('#dish-price').exists()).toBe(true);
  expect(wrapper.find('#field-canteen').exists()).toBe(true);
  expect(wrapper.find('.image-list').exists()).toBe(true);
  expect(wrapper.find('#dish-description').exists()).toBe(false);
  expect(wrapper.find('.draft-status').exists()).toBe(false);
  await wrapper.get('.optional-toggle').trigger('tap');
  expect(wrapper.find('#dish-description').exists()).toBe(true);
  wrapper.unmount();
});

it.each([
  ['', '申请新增菜品', '申请新增菜品', '申请已提交，等待审核'],
  ['dish', '申请补充资料', '提交补充建议', '补充建议已提交，等待审核'],
])(
  'describes the %s submission as a reviewed application',
  async (targetId, title, action, toast) => {
    (global as any).getCurrentPages = () => [{ options: { targetDishId: targetId } }];
    (getDishById as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        id: 'dish',
        name: '面条',
        price: 12,
        canteenId: 'c',
        canteenName: '食堂',
        availableMealTime: ['lunch'],
        updatedAt: '2026-10-11T01:00:00Z',
      },
    });
    (uploadDish as jest.Mock).mockResolvedValue({ code: 201, data: { id: 'upload' } });
    const wrapper = shallowMount(AddDishPage);
    await flushPromises();
    expect(uniMock.setNavigationBarTitle).toHaveBeenLastCalledWith({ title });
    expect(wrapper.get('.submit-button').text()).toBe(action);
    Object.assign((wrapper.vm as any).formData, {
      name: '面条',
      price: 15,
      canteenId: 'c',
      canteenName: '食堂',
      availableMealTime: ['lunch'],
    });
    await wrapper.get('.submit-button').trigger('tap');
    await flushPromises();
    expect(uniMock.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: toast }));
    expect(wrapper.get('.submission-success').text()).toContain(
      targetId ? '补充建议' : '新增菜品申请'
    );
    expect(wrapper.get('.submission-success').text()).toContain('审核');
    wrapper.unmount();
  }
);

it('keeps tag and allergen input, selection, icon removal and disabled behavior intact', async () => {
  const wrapper = shallowMount(AddDishPage);
  await flushPromises();
  await wrapper.get('.optional-toggle').trigger('tap');
  const spicy = wrapper.findAll('.badge-choice').find(choice => choice.text() === '辣')!;
  await spicy.trigger('tap');
  expect(spicy.attributes('aria-pressed')).toBe('true');
  expect((wrapper.vm as any).formData.tags).toContain('辣');
  for (const [inputLabel, value, removeLabel, field] of [
    ['自定义标签', '手作', '移除标签 手作', 'tags'],
    ['自定义过敏原', '芒果', '移除过敏原 芒果', 'allergens'],
  ]) {
    const input = wrapper.get('[aria-label="' + inputLabel + '"]');
    await input.setValue(value);
    await input.trigger('confirm');
    expect((wrapper.vm as any).formData[field]).toContain(value);
    const remove = wrapper.get('[aria-label="' + removeLabel + '"]');
    expect(remove.getComponent(UiIcon).props('name')).toBe('close');
    expect(remove.text()).toBe('');
    await remove.trigger('tap');
    expect((wrapper.vm as any).formData[field]).not.toContain(value);
    await input.setValue(value);
    await input.trigger('confirm');
  }
  (wrapper.vm as any).readOnly = true;
  await flushPromises();
  for (const label of ['移除标签 手作', '移除过敏原 芒果']) {
    const remove = wrapper.get('[aria-label="' + label + '"]');
    expect(remove.attributes('disabled')).toBeDefined();
    await remove.trigger('tap');
  }
  expect((wrapper.vm as any).formData.tags).toContain('手作');
  expect((wrapper.vm as any).formData.allergens).toContain('芒果');
  wrapper.unmount();
});

it('shows optional per-serving nutrition controls and opens them for validation errors', async () => {
  const wrapper = shallowMount(AddDishPage);
  await flushPromises();
  Object.assign((wrapper.vm as any).formData, { name: '豆腐', price: 8, canteenName: '食堂', availableMealTime: ['lunch'], calories: -1 });
  await wrapper.get('.submit-button').trigger('tap');
  await flushPromises();
  expect(wrapper.get('#field-calories').text()).toContain('应为 0 或正数');
  expect(wrapper.get('#dish-protein').attributes('placeholder')).toBe('未提供');
  expect(uniMock.pageScrollTo).toHaveBeenCalledWith({ selector: '#field-calories', duration: 200 });
  wrapper.unmount();
});
