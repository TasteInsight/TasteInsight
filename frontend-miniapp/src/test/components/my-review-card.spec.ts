import { mount } from '@vue/test-utils';
import ReviewCard from '@/pages/profile/my-reviews/components/ReviewCard.vue';
const review = {
  id: 'r',
  dishId: 'd',
  dishName: '番茄炒蛋',
  dishImage: '',
  content: '今天的口感很好',
  rating: 4,
  images: [],
  status: 'pending',
  createdAt: '2026-10-04T10:00:00Z',
};

it.each(['pending', 'approved', 'rejected'])(
  'renders a %s review without internal status labels or an image placeholder',
  status => {
    const wrapper = mount(ReviewCard, { props: { review: { ...review, status } as any } });
    expect(wrapper.text()).not.toMatch(/待审核|已发布|未通过|仅你可见/);
    expect(wrapper.text()).toContain(review.content);
    expect(wrapper.findAll('image, img')).toHaveLength(0);
    expect(wrapper.element.tagName).toBe('BUTTON');
  }
);

it('removes failed dish and review images without leaving blank slots', async () => {
  const wrapper = mount(ReviewCard, {
    props: { review: { ...review, dishImage: 'dish.jpg', images: ['review.jpg'] } as any },
  });
  expect(wrapper.findAll('image, img')).toHaveLength(2);
  for (const img of wrapper.findAll('image, img')) await img.trigger('error');
  expect(wrapper.findAll('image, img')).toHaveLength(0);
  expect(wrapper.find('.my-review-images').exists()).toBe(false);
  await wrapper.trigger('click');
  expect(wrapper.emitted('click')).toHaveLength(1);
});

it('opens a review once per Enter or Space press and keeps the existing click emit', async () => {
  const wrapper = mount(ReviewCard, { props: { review: review as any } });
  expect(wrapper.attributes('role')).toBe('button');
  expect(wrapper.attributes('tabindex')).toBe('0');
  expect(wrapper.attributes('aria-label')).toBe('查看番茄炒蛋的评价');
  await wrapper.trigger('keyup', { key: 'Enter' });
  expect(wrapper.emitted('click')).toBeUndefined();
  const down = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  wrapper.element.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  await wrapper.trigger('keydown', { key: 'Enter', repeat: true });
  await wrapper.trigger('keyup', { key: 'Enter' });
  await wrapper.trigger('keyup', { key: 'Enter' });
  expect(wrapper.emitted('click')).toEqual([[]]);
  await wrapper.trigger('keydown', { key: ' ' });
  await wrapper.trigger('blur');
  await wrapper.trigger('keyup', { key: ' ' });
  expect(wrapper.emitted('click')).toEqual([[]]);
  await wrapper.trigger('keydown', { key: ' ' });
  await wrapper.trigger('keyup', { key: ' ' });
  expect(wrapper.emitted('click')).toEqual([[], []]);
  await wrapper.trigger('click');
  expect(wrapper.emitted('click')).toEqual([[], [], []]);
  wrapper.unmount();
});
