import { shallowMount, flushPromises } from '@vue/test-utils';
import AddDishPage from '@/pages/add-dish/index.vue';
import { getCanteenList } from '@/api/modules/canteen';
import { uploadDish } from '@/api/modules/dish';
import { onBackPress } from '@dcloudio/uni-app';
jest.mock('@dcloudio/uni-app', () => ({ onBackPress: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 1, userInfo: { id: 'A' } }),
}));
jest.mock('@/api/modules/canteen', () => ({ getCanteenList: jest.fn() }));
jest.mock('@/api/modules/dish', () => ({ uploadDish: jest.fn() }));
const uniMock = {
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
  await wrapper.get('.location-state button').trigger('tap');
  await flushPromises();
  await wrapper.get('.location-choice').trigger('tap');
  expect((wrapper.vm as any).formData.name).toBe('Draft');
  expect(wrapper.text()).toContain('可直接提交到食堂');
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
