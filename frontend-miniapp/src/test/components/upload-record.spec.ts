import { shallowMount } from '@vue/test-utils';
import UploadRecord from '@/pages/profile/my-uploads/components/UploadRecord.vue';
import UiIcon from '@/components/UiIcon.vue';
import type { MyUploadItem } from '@/types/api';

const item: MyUploadItem = {
  id: 'upload-1',
  name: '番茄炒蛋',
  canteenName: '紫荆园',
  windowName: '家常菜',
  price: 0,
  priceUnit: '元/份',
  kind: 'create',
  status: 'pending',
  revision: 1,
  createdAt: '2026-10-11T01:00:00Z',
};

test.each([
  ['pending', '待审核', 'history'],
  ['approved', '已采纳', 'shield'],
  ['rejected', '未通过', 'info'],
  ['withdrawn', '已撤回', 'close'],
] as const)('shows a compact semantic status for %s', (status, label, icon) => {
  const wrapper = shallowMount(UploadRecord, { props: { item: { ...item, status } } });
  expect(wrapper.get('.upload-title').text()).toBe('番茄炒蛋');
  expect(wrapper.get('.upload-location').text()).toBe('紫荆园 · 家常菜');
  expect(wrapper.get('.upload-price').text()).toBe('¥0/份');
  expect(wrapper.get('.upload-status').text()).toBe(label);
  expect(wrapper.get('.upload-status').findComponent(UiIcon).props('name')).toBe(icon);
  expect(wrapper.get('.upload-meta').text()).toContain('新增菜品');
  wrapper.unmount();
});

test('uses concise actions without removing rejection context', async () => {
  const wrapper = shallowMount(UploadRecord, {
    props: { item: { ...item, status: 'rejected', rejectReason: '价格需要确认' } },
  });
  expect(wrapper.get('.upload-reason').text()).toContain('价格需要确认');
  expect(wrapper.findAll('button').map(button => button.text())).toEqual(['修改资料', '撤回']);
  await wrapper.findAll('button')[0].trigger('click');
  await wrapper.findAll('button')[1].trigger('click');
  expect(wrapper.emitted('edit')).toHaveLength(1);
  expect(wrapper.emitted('withdraw')).toHaveLength(1);
  await wrapper.setProps({ item: { ...item, status: 'approved', approvedDishId: 'dish-1' } });
  expect(wrapper.findAll('button').map(button => button.text())).toEqual(['查看菜品']);
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('openDish')).toEqual([['dish-1']]);
  wrapper.unmount();
});

test('renders only an available thumbnail and resets a failed image when the record changes', async () => {
  const wrapper = shallowMount(UploadRecord, { props: { item } });
  expect(wrapper.find('.upload-photo').exists()).toBe(false);
  await wrapper.setProps({ item: { ...item, images: ['/dish-1.jpg', '/dish-2.jpg'] } });
  expect(wrapper.get('.upload-photo').attributes('src')).toBe('/dish-1.jpg');
  expect(wrapper.get('.upload-photo').attributes('alt')).toBe('番茄炒蛋');
  await wrapper.get('.upload-photo').trigger('error');
  expect(wrapper.find('.upload-photo').exists()).toBe(false);
  await wrapper.setProps({ item: { ...item, id: 'upload-2', images: ['/dish-1.jpg'] } });
  expect(wrapper.get('.upload-photo').attributes('src')).toBe('/dish-1.jpg');
  await wrapper.setProps({ item: { ...item, id: 'upload-2', images: [] } });
  expect(wrapper.find('.upload-photo').exists()).toBe(false);
  wrapper.unmount();
});

test('highlighting leaves the record content and actions unchanged', async () => {
  const wrapper = shallowMount(UploadRecord, { props: { item } });
  const before = wrapper.text();
  await wrapper.setProps({ highlighted: true });
  expect(wrapper.classes()).toContain('upload-focused');
  expect(wrapper.text()).toBe(before);
  await wrapper.setProps({ highlighted: false });
  expect(wrapper.classes()).not.toContain('upload-focused');
  wrapper.unmount();
});
