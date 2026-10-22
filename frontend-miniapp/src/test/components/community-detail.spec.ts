import { flushPromises, shallowMount } from '@vue/test-utils';
import { reactive } from 'vue';
import { onLoad, onShow, onHide, onPullDownRefresh } from '@dcloudio/uni-app';
import Page from '@/pages/community/detail.vue';
import PostCard from '@/pages/community/components/PostCard.vue';
import {
  getPost,
  getPostComments,
  createPostComment,
  deletePost,
  setPostCommentLike,
} from '@/api/modules/social';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
  onBackPress: jest.fn(),
}));
jest.mock('@/api/modules/social', () => ({
  getPost: jest.fn(),
  getPostComments: jest.fn(),
  createPostComment: jest.fn(),
  deletePost: jest.fn(),
  deletePostComment: jest.fn(),
  reportPost: jest.fn(),
  reportPostComment: jest.fn(),
  setPostCommentLike: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/utils/student-access', () => ({ requireStudent: jest.fn() }));
const post = {
  id: 'P',
  userId: 'A',
  userNickname: '同学A',
  userAvatar: '',
  content: '今天的午餐',
  images: [],
  status: 'approved',
  likeCount: 0,
  likedByMe: false,
  commentCount: 0,
  createdAt: '2026-10-09T00:00:00Z',
  updatedAt: '2026-10-09T00:00:00Z',
};
const reply = (id = 'C', status = 'approved') => ({
  id,
  postId: 'P',
  userId: 'A',
  userNickname: '同学A',
  userAvatar: '',
  content: '我的回复',
  parentComment: null,
  status,
  likeCount: 0,
  likedByMe: false,
  createdAt: '2026-10-09T01:00:00Z',
  updatedAt: '2026-10-09T01:00:00Z',
});
const comments = (items: any[] = [], page = 1, totalPages = 1) => ({
  code: 200,
  data: { items, canReply: true, meta: { page, totalPages, total: items.length } },
});
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(yes => {
    resolve = yes;
  });
  return { resolve, promise };
};
let user: any;
const wrappers: any[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  (getPost as jest.Mock).mockReset();
  (getPostComments as jest.Mock).mockReset();
  user = reactive({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'A' } });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (requireStudent as jest.Mock).mockReturnValue(true);
  (getPost as jest.Mock).mockResolvedValue({ code: 200, data: { ...post } });
  (getPostComments as jest.Mock).mockResolvedValue(comments());
  (createPostComment as jest.Mock).mockResolvedValue({ code: 201, data: reply() });
  Object.assign(uni, {
    showActionSheet: jest.fn(),
    showModal: jest.fn(),
    navigateBack: jest.fn(),
    redirectTo: jest.fn(),
    pageScrollTo: jest.fn(),
  });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
async function page() {
  const wrapper = shallowMount(Page, {
    global: { stubs: { AsyncState: false, EmptyState: false } },
  });
  wrappers.push(wrapper);
  (onLoad as jest.Mock).mock.calls.slice(-1)[0][0]({ id: 'P' });
  (onShow as jest.Mock).mock.calls.slice(-1)[0][0]();
  await flushPromises();
  return wrapper;
}
test('failed reply loading keeps the post and withholds an unverified reply count', async () => {
  (getPostComments as jest.Mock).mockRejectedValueOnce(new Error('回复读取失败'));
  const wrapper = await page();
  expect(wrapper.findComponent(PostCard).exists()).toBe(true);
  expect(wrapper.text()).toContain('回复读取失败');
  expect(wrapper.find('.reply-heading .campus-hint').exists()).toBe(false);
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(wrapper.get('.reply-heading .campus-hint').text()).toBe('0');
});

test('a failed post refresh retains the post, replies and composer draft until recovery', async () => {
  (getPostComments as jest.Mock).mockResolvedValueOnce(comments([reply('retained')]));
  const wrapper = await page();
  (wrapper.vm as any).content = '尚未发送的回复';
  (getPost as jest.Mock).mockRejectedValueOnce(new Error('刷新失败'));
  await (onPullDownRefresh as jest.Mock).mock.calls.slice(-1)[0][0]();
  await flushPromises();
  expect(wrapper.findComponent(PostCard).exists()).toBe(true);
  expect(wrapper.findAll('.post-reply')).toHaveLength(1);
  expect((wrapper.vm as any).content).toBe('尚未发送的回复');
  expect(wrapper.text()).toContain('刷新失败');
  (getPostComments as jest.Mock).mockResolvedValueOnce(comments([reply('fresh')]));
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(wrapper.find('.error-feedback').exists()).toBe(false);
  expect((wrapper.vm as any).comments.map((item: any) => item.id)).toEqual(['fresh']);
  expect((wrapper.vm as any).content).toBe('尚未发送的回复');
});

test('shows the owner pending reply as ordinary content and does not offer unavailable interactions', async () => {
  (getPostComments as jest.Mock).mockResolvedValue(comments([reply('pending', 'pending')]));
  const wrapper = await page();
  expect(wrapper.text()).toContain('我的回复');
  expect(wrapper.text()).not.toMatch(/待审核|已提交|未通过/);
  expect(wrapper.find('.reply-actions button').exists()).toBe(false);
});
test('reply selection sends its parent id and an in-flight write remains locked while hidden', async () => {
  (getPostComments as jest.Mock).mockResolvedValue(comments([reply('parent')]));
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.replyingTo = reply('parent');
  vm.content = '回复同学';
  const pending = deferred();
  (createPostComment as jest.Mock).mockReturnValue(pending.promise);
  const send = vm.sendReply();
  (onHide as jest.Mock).mock.calls.slice(-1)[0][0]();
  expect(vm.submitting).toBe(true);
  (onShow as jest.Mock).mock.calls.slice(-1)[0][0]();
  await flushPromises();
  await vm.sendReply();
  expect(createPostComment).toHaveBeenCalledTimes(1);
  expect(createPostComment).toHaveBeenCalledWith('P', {
    content: '回复同学',
    parentCommentId: 'parent',
  });
  pending.resolve({ code: 201, data: reply('new') });
  await send;
  await flushPromises();
  expect(vm.content).toBe('');
  expect(vm.comments.some((item: any) => item.id === 'new')).toBe(true);
});
test('a changed session discards the previous writer result and draft', async () => {
  const wrapper = await page();
  const vm = wrapper.vm as any;
  vm.content = 'A的回复';
  const pending = deferred();
  (createPostComment as jest.Mock).mockReturnValue(pending.promise);
  const send = vm.sendReply();
  user.sessionVersion++;
  expect(getPost).toHaveBeenCalledTimes(1);
  user.userInfo = { id: 'B' };
  pending.resolve({ code: 201, data: reply('private', 'pending') });
  await send;
  await flushPromises();
  expect(vm.content).toBe('');
  expect(vm.comments.some((item: any) => item.id === 'private')).toBe(false);
});
test('revoked student contribution still allows the owner to delete existing content', async () => {
  const wrapper = await page();
  (requireStudent as jest.Mock).mockReturnValue(false);
  (deletePost as jest.Mock).mockResolvedValue({ code: 200 });
  wrapper.findComponent(PostCard).vm.$emit('manage');
  (uni.showActionSheet as jest.Mock).mock.calls[0][0].success({ tapIndex: 1 });
  (uni.showModal as jest.Mock).mock.calls[0][0].success({ confirm: true });
  await flushPromises();
  expect(deletePost).toHaveBeenCalledWith('P');
  expect(requireStudent).not.toHaveBeenCalled();
  expect(uni.navigateBack).toHaveBeenCalled();
});
test('comment pagination retry keeps its successful first page', async () => {
  (getPostComments as jest.Mock)
    .mockResolvedValueOnce(comments([reply('first')], 1, 2))
    .mockRejectedValueOnce(new Error('暂时断网'))
    .mockResolvedValueOnce(comments([reply('second')], 2, 2));
  const wrapper = await page();
  const vm = wrapper.vm as any;
  await vm.loadComments(true);
  expect(vm.comments.map((item: any) => item.id)).toEqual(['first']);
  expect(vm.commentsError).toBe('暂时断网');
  await vm.loadComments(true);
  expect(getPostComments).toHaveBeenLastCalledWith('P', { page: 2, pageSize: 20 });
  expect(vm.comments.map((item: any) => item.id)).toEqual(['first', 'second']);
});
test('approved reply likes use the common server-authoritative state', async () => {
  (getPostComments as jest.Mock).mockResolvedValue(comments([reply()]));
  (setPostCommentLike as jest.Mock).mockResolvedValue({
    code: 200,
    data: { liked: true, likeCount: 4 },
  });
  const wrapper = await page();
  await wrapper.get('[aria-label="点赞回复"]').trigger('click');
  await flushPromises();
  expect(setPostCommentLike).toHaveBeenCalledWith('C', true);
  expect(wrapper.get('[aria-label="取消点赞"]').text()).toContain('4');
});

test('post and reply reads expose independent loading states within the page layout', async () => {
  const postRequest = deferred();
  const replyRequest = deferred();
  (getPost as jest.Mock).mockReturnValueOnce(postRequest.promise);
  (getPostComments as jest.Mock).mockReturnValueOnce(replyRequest.promise);
  const wrapper = await page();
  expect(wrapper.classes()).toEqual(expect.arrayContaining(['page-content', 'page-state-layout']));
  expect(wrapper.text()).toContain('正在加载动态');
  expect(wrapper.find('.campus-skeleton').exists()).toBe(false);
  postRequest.resolve({ code: 200, data: { ...post } });
  await flushPromises();
  expect(wrapper.findComponent(PostCard).exists()).toBe(true);
  expect(wrapper.attributes('aria-busy')).toBe('false');
  expect(wrapper.text()).toContain('正在加载回复');
  expect(wrapper.text()).not.toContain('还没有回复');
  replyRequest.resolve(comments());
  await flushPromises();
  expect(wrapper.text()).toContain('还没有回复');
});

test('refreshing empty replies replaces empty feedback with loading and retains the composer draft', async () => {
  const wrapper = await page();
  const pending = deferred();
  (getPostComments as jest.Mock).mockReturnValueOnce(pending.promise);
  const vm = wrapper.vm as any;
  vm.content = '未发送的回复';
  const request = vm.loadComments();
  await flushPromises();
  expect(wrapper.text()).toContain('正在加载回复');
  expect(wrapper.text()).not.toContain('还没有回复');
  expect(vm.content).toBe('未发送的回复');
  pending.resolve(comments());
  await request;
  await flushPromises();
  expect(wrapper.text()).toContain('还没有回复');
});
