import { mount } from '@vue/test-utils';
import CanteenHeader from '@/pages/canteen/components/CanteenHeader.vue';
import CanteenResultItem from '@/pages/search/components/CanteenResultItem.vue';
import CanteenWindowList from '@/pages/canteen/components/CanteenWindowList.vue';
import WindowHeader from '@/pages/window/components/WindowHeader.vue';

const canteen = {
  id: 'canteen',
  name: '紫荆园',
  images: ['https://test.invalid/first.jpg', 'https://test.invalid/second.jpg'],
} as any;

test('canteen header removes failed photos, retains valid ones, and never loses the name', async () => {
  const wrapper = mount(CanteenHeader, { props: { canteen } });
  expect(wrapper.findAll('image')).toHaveLength(2);
  await wrapper.findAll('image')[0].trigger('error');
  expect(wrapper.findAll('image')).toHaveLength(1);
  expect(wrapper.get('image').attributes('src')).toBe(canteen.images[1]);
  await wrapper.get('image').trigger('error');
  expect(wrapper.find('swiper').exists()).toBe(false);
  expect(wrapper.text()).toContain('紫荆园');
  wrapper.unmount();
});

test('canteen search results try the next valid photo and provide a compact fallback', async () => {
  const wrapper = mount(CanteenResultItem, { props: { canteen } });
  await wrapper.get('image').trigger('error');
  expect(wrapper.get('image').attributes('src')).toBe(canteen.images[1]);
  await wrapper.get('image').trigger('error');
  expect(wrapper.find('image').exists()).toBe(false);
  expect(wrapper.text()).toContain('暂无照片');
  expect(wrapper.text()).toContain('紫荆园');
  expect(wrapper.text()).toContain('暂无评分');
  wrapper.unmount();
});

test('window entries consume floor.name or floor.level from the API contract', async () => {
  const wrapper = mount(CanteenWindowList, {
    props: {
      windows: [
        { id: 'first', name: '家常菜', floor: { name: '二层', level: '2' } },
        { id: 'second', name: '素食', floor: { level: '3' } },
      ] as any,
    },
  });
  expect(wrapper.text()).toContain('二层');
  expect(wrapper.text()).toContain('3层');
  await wrapper.findAll('button')[1].trigger('tap');
  expect(wrapper.emitted('click')).toEqual([['second']]);
  wrapper.unmount();
});

test.each([
  ['canteen', CanteenHeader],
  ['window', WindowHeader],
] as const)('%s header exposes a retry after metadata loading fails', async (kind, component) => {
  const wrapper = mount(component as any, {
    props: { [kind]: null, loading: false, error: '信息加载失败' },
  });
  expect(wrapper.text()).toContain('信息加载失败');
  expect(wrapper.text()).not.toContain('正在加载');
  await wrapper.get('button').trigger('tap');
  expect(wrapper.emitted('retry')).toHaveLength(1);
  wrapper.unmount();
});
