import { mount } from '@vue/test-utils';
import ProfilePostCard from '@/pages/profile/components/ProfilePostCard.vue';
import type { Post } from '@/api/modules/social';

const post = (changes: Partial<Post> = {}): Post => ({
  id: 'post/1',
  userId: 'owner',
  userNickname: '个人空间的作者',
  userAvatar: '',
  content: '午餐吃了香菇青菜，清爽又好吃。',
  images: [],
  status: 'pending',
  likeCount: 0,
  likedByMe: false,
  commentCount: 0,
  createdAt: '2026-10-09T10:00:00Z',
  updatedAt: '2026-10-09T10:00:00Z',
  ...changes,
});
beforeEach(() => jest.clearAllMocks());

test('a personal text entry contains content without repeating its owner or missing-image placeholders', () => {
  const wrapper = mount(ProfilePostCard, { props: { post: post() } });
  expect(wrapper.classes()).toContain('profile-post-card--text');
  expect(wrapper.text()).toContain(post().content);
  expect(wrapper.text()).not.toContain(post().userNickname);
  expect(wrapper.text()).not.toMatch(/待审核|已提交|暂无图片|0 赞|0 回复/);
  expect(wrapper.find('image').exists()).toBe(false);
  expect(wrapper.get('button').attributes('aria-label')).toContain(post().content);
  wrapper.unmount();
});

test('photo entries show a real cover and omit the image column when all resources fail', async () => {
  const wrapper = mount(ProfilePostCard, {
    props: { post: post({ images: ['https://image.test/one.png', 'https://image.test/two.png'] }) },
  });
  expect(wrapper.classes()).not.toContain('profile-post-card--text');
  expect(wrapper.get('image').attributes('src')).toContain('one.png');
  await wrapper.get('image').trigger('error');
  expect(wrapper.get('image').attributes('src')).toContain('two.png');
  await wrapper.get('image').trigger('error');
  expect(wrapper.find('.profile-post-cover').exists()).toBe(false);
  expect(wrapper.classes()).toContain('profile-post-card--text');
  await wrapper.setProps({ post: post({ id: 'next', images: ['https://image.test/one.png'] }) });
  expect(wrapper.get('image').attributes('src')).toContain('one.png');
  wrapper.unmount();
});

test.each(['Enter', ' '])('opens the current post exactly once after %p key release', async key => {
  const wrapper = mount(ProfilePostCard, { props: { post: post() } });
  const button = wrapper.get('button');
  expect(button.attributes('tabindex')).toBe('0');
  await button.trigger('keydown', { key });
  await button.trigger('keydown', { key, repeat: true });
  expect(uni.navigateTo).not.toHaveBeenCalled();
  await button.trigger('keyup', { key });
  await button.trigger('keyup', { key });
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/community/detail?id=post%2F1' });
  await wrapper.setProps({ post: post({ id: 'next' }) });
  await button.trigger('click');
  expect(uni.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/community/detail?id=next' });
  wrapper.unmount();
});

test('renders only real nonzero interaction counts without nested action buttons', () => {
  const wrapper = mount(ProfilePostCard, {
    props: { post: post({ likeCount: 7, commentCount: 2 }) },
  });
  expect(wrapper.text()).toContain('7 赞');
  expect(wrapper.text()).toContain('2 回复');
  expect(wrapper.findAll('button')).toHaveLength(1);
  wrapper.unmount();
});

test('keeps rejected feedback inside its own entry and never adds a pending status', async () => {
  const wrapper = mount(ProfilePostCard, {
    props: { post: post({ status: 'rejected', rejectReason: '请移除无关图片' }) },
  });
  expect(wrapper.get('.profile-post-note').text()).toBe('请移除无关图片');
  await wrapper.setProps({ post: post({ status: 'pending' }) });
  expect(wrapper.find('.profile-post-note').exists()).toBe(false);
  wrapper.unmount();
});
