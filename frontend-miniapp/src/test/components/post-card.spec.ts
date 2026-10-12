import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import PostCard from '@/pages/community/components/PostCard.vue';
import { setPostLike, type Post } from '@/api/modules/social';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';

jest.mock('@/api/modules/social', () => ({ setPostLike: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/utils/student-access', () => ({ requireStudent: jest.fn() }));

const post = (overrides: Partial<Post> = {}): Post => ({
  id: 'post/one?x=1',
  userId: 'author/one',
  userNickname: '同学A',
  userAvatar: '',
  content: '今天的午餐',
  images: ['first.jpg', 'second.jpg'],
  status: 'approved',
  likeCount: 2,
  likedByMe: false,
  commentCount: 3,
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
  ...overrides,
});
const wrappers: any[] = [];
function card(value = post(), detail = false) {
  const wrapper = mount(PostCard, { props: { post: value, detail } });
  wrappers.push(wrapper);
  return wrapper;
}
async function press(button: any, key = 'Enter') {
  const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  button.element.dispatchEvent(down);
  await button.trigger('keydown', { key, repeat: true });
  await button.trigger('keyup', { key });
  await button.trigger('keyup', { key });
  await flushPromises();
  return down;
}
beforeEach(() => {
  jest.clearAllMocks();
  (useUserStore as unknown as jest.Mock).mockReturnValue(
    reactive({ sessionVersion: 0, isLoggedIn: true })
  );
  (requireStudent as jest.Mock).mockReturnValue(true);
  (setPostLike as jest.Mock)
    .mockReset()
    .mockResolvedValue({ code: 200, data: { liked: false, likeCount: 8 } });
  Object.assign(uni, { previewImage: jest.fn() });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

test('author, content and list replies activate once from the keyboard with encoded route IDs', async () => {
  const wrapper = card();
  expect(
    wrapper
      .findAll('button')
      .every(
        button => button.attributes('role') === 'button' && button.attributes('tabindex') === '0'
      )
  ).toBe(true);
  const author = wrapper.get('.post-author');
  await author.trigger('keyup', { key: 'Enter' });
  expect(uni.navigateTo).not.toHaveBeenCalled();
  expect((await press(author)).defaultPrevented).toBe(true);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  expect(uni.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/profile/public?id=author%2Fone' });
  expect((await press(wrapper.get('.post-content-link'), ' ')).defaultPrevented).toBe(true);
  expect(uni.navigateTo).toHaveBeenCalledTimes(2);
  expect(uni.navigateTo).toHaveBeenLastCalledWith({
    url: '/pages/community/detail?id=post%2Fone%3Fx%3D1',
  });
  await press(wrapper.get('[aria-label="查看动态回复"]'));
  expect(uni.navigateTo).toHaveBeenCalledTimes(3);
  expect(uni.navigateTo).toHaveBeenLastCalledWith({
    url: '/pages/community/detail?id=post%2Fone%3Fx%3D1',
  });
  await wrapper.setProps({ post: post({ userId: 'author/two', id: 'post/two' }) });
  await author.trigger('click');
  expect(uni.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/profile/public?id=author%2Ftwo' });
});

test('detail management and reply retain their zero-argument emits for keyboard and pointer', async () => {
  const wrapper = card(post(), true);
  expect(wrapper.find('.post-content-link').exists()).toBe(false);
  await press(wrapper.get('.post-menu'));
  await press(wrapper.get('[aria-label="查看动态回复"]'), ' ');
  expect(wrapper.emitted('manage')).toEqual([[]]);
  expect(wrapper.emitted('reply')).toEqual([[]]);
  expect(uni.navigateTo).not.toHaveBeenCalled();
  await wrapper.get('.post-menu').trigger('click');
  await wrapper.get('[aria-label="查看动态回复"]').trigger('click');
  expect(wrapper.emitted('manage')).toEqual([[], []]);
  expect(wrapper.emitted('reply')).toEqual([[], []]);
});

test('image keys preserve preview URLs and the selected image, and blur cancels a partial press', async () => {
  const value = post();
  const wrapper = card(value);
  const images = wrapper.findAll('.post-image-button');
  await images[0].trigger('keydown', { key: 'Enter' });
  await images[0].trigger('blur');
  await images[0].trigger('keyup', { key: 'Enter' });
  expect(uni.previewImage).not.toHaveBeenCalled();
  await press(images[1], ' ');
  expect(uni.previewImage).toHaveBeenCalledTimes(1);
  expect(uni.previewImage).toHaveBeenLastCalledWith({ urls: value.images, current: 'second.jpg' });
  await images[0].trigger('click');
  expect(uni.previewImage).toHaveBeenLastCalledWith({ urls: value.images, current: 'first.jpg' });
  const next = post({ images: ['next.jpg', 'last.jpg'] });
  await wrapper.setProps({ post: next });
  await press(wrapper.findAll('.post-image-button')[0]);
  expect(uni.previewImage).toHaveBeenCalledTimes(3);
  expect(uni.previewImage).toHaveBeenLastCalledWith({ urls: next.images, current: 'next.jpg' });
});

test('pending likes leave the focus sequence and ignore repeated keyboard or pointer activation', async () => {
  let resolve!: (value: any) => void;
  (setPostLike as jest.Mock).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    })
  );
  const wrapper = card();
  const like = wrapper.get('[aria-label="点赞动态"]');
  await press(like, ' ');
  expect(setPostLike).toHaveBeenCalledTimes(1);
  expect(setPostLike).toHaveBeenLastCalledWith('post/one?x=1', true);
  expect(like.attributes()).toHaveProperty('disabled');
  expect(like.attributes('tabindex')).toBe('-1');
  await press(like);
  await like.trigger('click');
  expect(setPostLike).toHaveBeenCalledTimes(1);
  resolve({ code: 200, data: { liked: true, likeCount: 9 } });
  await flushPromises();
  expect(like.attributes('tabindex')).toBe('0');
  expect(like.attributes('aria-pressed')).toBe('true');
  expect(like.text()).toContain('9');
  await press(like);
  expect(setPostLike).toHaveBeenCalledTimes(2);
  expect(setPostLike).toHaveBeenLastCalledWith('post/one?x=1', false);
});

test.each(['pending', 'rejected'] as const)(
  'nonpublic %s posts retain reading actions without an unavailable like action',
  async status => {
    const wrapper = card(post({ status }));
    expect(wrapper.find('[aria-label="点赞动态"]').exists()).toBe(false);
    await press(wrapper.get('.post-content-link'));
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(setPostLike).not.toHaveBeenCalled();
    expect(requireStudent).not.toHaveBeenCalled();
  }
);
