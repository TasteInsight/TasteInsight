import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { onLoad, onBackPress } from '@dcloudio/uni-app';
import Editor from '@/pages/community/editor.vue';
import { createPost, getPost, updatePost } from '@/api/modules/social';
import { uploadImage } from '@/api/modules/upload';
import { useUserStore } from '@/store/modules/use-user-store';
import { openCampus } from '@/utils/campus-navigation';
jest.mock('@dcloudio/uni-app', () => ({ onLoad: jest.fn(), onBackPress: jest.fn() }));
jest.mock('@/api/modules/social', () => ({
  createPost: jest.fn(),
  getPost: jest.fn(),
  updatePost: jest.fn(),
}));
jest.mock('@/api/modules/upload', () => ({ uploadImage: jest.fn() }));
jest.mock('@/utils/student-access', () => ({ requireStudent: () => true }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/utils/campus-navigation', () => ({ openCampus: jest.fn() }));
const storage = new Map<string, string>();
const wrappers: any[] = [];
let user: any;
beforeEach(() => {
  jest.resetAllMocks();
  storage.clear();
  user = reactive({ sessionVersion: 0, userInfo: { id: 'A' } });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  Object.assign(uni, {
    getStorageSync: jest.fn((key: string) => storage.get(key)),
    setStorageSync: jest.fn((key: string, value: string) => storage.set(key, value)),
    removeStorageSync: jest.fn((key: string) => storage.delete(key)),
    chooseImage: jest.fn(),
    previewImage: jest.fn(),
    redirectTo: jest.fn(),
    navigateBack: jest.fn(),
    showModal: jest.fn(),
  });
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
});
async function editor(options = {}) {
  const wrapper = mount(Editor);
  wrappers.push(wrapper);
  (onLoad as jest.Mock).mock.calls.slice(-1)[0][0](options);
  await flushPromises();
  return wrapper;
}
async function choose(wrapper: any, paths: string[] | string = ['/local/one.jpg']) {
  await wrapper.get('.editor-add').trigger('click');
  (uni.chooseImage as jest.Mock).mock.calls.slice(-1)[0][0].success({ tempFilePaths: paths });
  await flushPromises();
}
const saved = { code: 201, data: { id: 'saved' } };

test('image selection stays local, text draft is owner-scoped, and submit uploads before creating', async () => {
  const wrapper = await editor();
  await wrapper.get('textarea').setValue('今天在食堂吃饭');
  await choose(wrapper);
  expect(uploadImage).not.toHaveBeenCalled();
  expect(createPost).not.toHaveBeenCalled();
  expect(storage.has('community-draft:A:new')).toBe(true);
  expect([...storage.values()][0]).not.toContain('/local/');
  (uploadImage as jest.Mock).mockResolvedValue({ url: 'https://images.example/one.jpg' });
  (createPost as jest.Mock).mockResolvedValue(saved);
  await wrapper.get('.campus-primary').trigger('click');
  await flushPromises();
  expect(createPost).toHaveBeenCalledWith({
    content: '今天在食堂吃饭',
    images: ['https://images.example/one.jpg'],
  });
  expect(storage.has('community-draft:A:new')).toBe(false);
  expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/community/detail?id=saved' });
});
test('normalizes the Uni single-path result and reuses uploaded files on a failed submit retry', async () => {
  const wrapper = await editor();
  await wrapper.get('textarea').setValue('重试的动态');
  await choose(wrapper, '/local/one.jpg');
  (uploadImage as jest.Mock).mockResolvedValue({ url: 'https://images.example/one.jpg' });
  (createPost as jest.Mock)
    .mockRejectedValueOnce(new Error('网络中断'))
    .mockResolvedValueOnce(saved);
  await wrapper.get('.campus-primary').trigger('click');
  await flushPromises();
  expect(wrapper.text()).toContain('网络中断');
  await wrapper.get('.campus-primary').trigger('click');
  await flushPromises();
  expect(uploadImage).toHaveBeenCalledTimes(1);
  expect(createPost).toHaveBeenCalledTimes(2);
});
test('switching accounts during an upload prevents creating the old draft as the next account', async () => {
  const wrapper = await editor();
  await wrapper.get('textarea').setValue('A 的草稿');
  await choose(wrapper);
  let finish!: (value: any) => void;
  (uploadImage as jest.Mock).mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    })
  );
  await wrapper.get('.campus-primary').trigger('click');
  user.sessionVersion++;
  user.userInfo = { id: 'B' };
  finish({ url: 'https://images.example/a.jpg' });
  await flushPromises();
  expect(createPost).not.toHaveBeenCalled();
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(storage.has('community-draft:B:new')).toBe(false);
  expect(storage.get('community-draft:A:new')).toContain('A 的草稿');
});
test('edits include the exact fetched optimistic concurrency version', async () => {
  (getPost as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      id: 'old',
      userId: 'A',
      content: '旧内容',
      images: [],
      updatedAt: '2026-10-09T01:02:03.000Z',
    },
  });
  (updatePost as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'old' } });
  const wrapper = await editor({ id: 'old' });
  await wrapper.get('textarea').setValue('新内容');
  await wrapper.get('.campus-primary').trigger('click');
  await flushPromises();
  expect(updatePost).toHaveBeenCalledWith('old', {
    content: '新内容',
    images: [],
    expectedUpdatedAt: '2026-10-09T01:02:03.000Z',
  });
  expect(createPost).not.toHaveBeenCalled();
});

const originalPost = {
  id: 'old',
  userId: 'A',
  content: '旧内容',
  images: ['https://images.example/original.jpg'],
  updatedAt: '2026-10-09T01:02:03.000Z',
};
const latestPost = {
  ...originalPost,
  content: '其他设备保存的内容',
  images: ['https://images.example/latest.jpg'],
  updatedAt: '2026-10-09T02:03:04.000Z',
};
const conflictError = () =>
  Object.assign(new Error('网络开小差了，请稍后再试'), { statusCode: 409 });

async function conflictedEditor() {
  (getPost as jest.Mock).mockResolvedValueOnce({ code: 200, data: originalPost });
  (updatePost as jest.Mock).mockRejectedValueOnce(conflictError());
  const wrapper = await editor({ id: 'old' });
  await wrapper.get('textarea').setValue('我的未保存修改');
  await wrapper.get('.campus-primary').trigger('click');
  await flushPromises();
  return wrapper;
}

async function readLatest(wrapper: any) {
  (getPost as jest.Mock).mockResolvedValueOnce({ code: 200, data: latestPost });
  await wrapper.get('[aria-label="读取动态最新版本"]').trigger('click');
  await flushPromises();
}

async function answerModal(confirm: boolean) {
  (uni.showModal as jest.Mock).mock.calls.slice(-1)[0][0].success({ confirm, cancel: !confirm });
  await flushPromises();
}

test('409 preserves the draft and photos, stops stale resubmission, and provides a latest-version action', async () => {
  const wrapper = await conflictedEditor();
  expect(wrapper.text()).toContain('动态已更新');
  expect(wrapper.get('textarea').element.value).toBe('我的未保存修改');
  expect(wrapper.get('.editor-images .editor-preview image').attributes('src')).toBe(
    originalPost.images[0]
  );
  expect(wrapper.get('.campus-heading .campus-primary').attributes('disabled')).toBeDefined();
  await wrapper.get('.campus-heading .campus-primary').trigger('click');
  expect(updatePost).toHaveBeenCalledTimes(1);
  await readLatest(wrapper);
  expect(wrapper.get('.editor-latest-content').text()).toBe(latestPost.content);
  expect(wrapper.get('.editor-latest-images image').attributes('src')).toBe(latestPost.images[0]);
  expect(wrapper.get('textarea').element.value).toBe('我的未保存修改');
});

test('keeping a conflicting draft requires confirmation and a separate save with the reviewed version', async () => {
  const wrapper = await conflictedEditor();
  await readLatest(wrapper);
  await wrapper.get('[aria-label="保留我的修改继续编辑"]').trigger('click');
  await answerModal(false);
  expect(wrapper.find('.editor-conflict').exists()).toBe(true);
  expect(wrapper.get('textarea').element.value).toBe('我的未保存修改');
  expect(updatePost).toHaveBeenCalledTimes(1);
  await wrapper.get('[aria-label="保留我的修改继续编辑"]').trigger('click');
  await answerModal(true);
  expect(wrapper.find('.editor-conflict').exists()).toBe(false);
  expect(wrapper.get('textarea').element.value).toBe('我的未保存修改');
  expect(updatePost).toHaveBeenCalledTimes(1);
  expect(JSON.parse(storage.get('community-draft:A:old')!).expectedUpdatedAt).toBe(
    latestPost.updatedAt
  );
  (updatePost as jest.Mock).mockResolvedValueOnce({ code: 200, data: { id: 'old' } });
  await wrapper.get('.campus-heading .campus-primary').trigger('click');
  await flushPromises();
  expect(updatePost).toHaveBeenLastCalledWith('old', {
    content: '我的未保存修改',
    images: originalPost.images,
    expectedUpdatedAt: latestPost.updatedAt,
  });
});

test('adopting the latest version never discards local edits before the explicit confirmation', async () => {
  const wrapper = await conflictedEditor();
  await readLatest(wrapper);
  await wrapper.get('[aria-label="采用动态最新内容"]').trigger('click');
  await answerModal(false);
  expect(wrapper.get('textarea').element.value).toBe('我的未保存修改');
  expect(wrapper.get('.editor-images .editor-preview image').attributes('src')).toBe(
    originalPost.images[0]
  );
  await wrapper.get('[aria-label="采用动态最新内容"]').trigger('click');
  await answerModal(true);
  expect(wrapper.find('.editor-conflict').exists()).toBe(false);
  expect(wrapper.get('textarea').element.value).toBe(latestPost.content);
  expect(wrapper.get('.editor-images .editor-preview image').attributes('src')).toBe(
    latestPost.images[0]
  );
  expect(storage.has('community-draft:A:old')).toBe(false);
  expect(updatePost).toHaveBeenCalledTimes(1);
});

test('a second concurrent update reopens conflict resolution without losing uploaded local photos', async () => {
  (getPost as jest.Mock).mockResolvedValueOnce({ code: 200, data: originalPost });
  (uploadImage as jest.Mock).mockResolvedValueOnce({ url: 'https://images.example/local.jpg' });
  (updatePost as jest.Mock).mockRejectedValue(conflictError());
  const wrapper = await editor({ id: 'old' });
  await wrapper.get('textarea').setValue('附带本地照片的草稿');
  await choose(wrapper, '/local/photo.jpg');
  await wrapper.get('.campus-heading .campus-primary').trigger('click');
  await flushPromises();
  await readLatest(wrapper);
  await wrapper.get('[aria-label="保留我的修改继续编辑"]').trigger('click');
  await answerModal(true);
  await wrapper.get('.campus-heading .campus-primary').trigger('click');
  await flushPromises();
  expect(updatePost).toHaveBeenCalledTimes(2);
  expect(updatePost).toHaveBeenLastCalledWith('old', {
    content: '附带本地照片的草稿',
    images: [...originalPost.images, 'https://images.example/local.jpg'],
    expectedUpdatedAt: latestPost.updatedAt,
  });
  expect(uploadImage).toHaveBeenCalledTimes(1);
  expect(wrapper.get('textarea').element.value).toBe('附带本地照片的草稿');
  expect(wrapper.findAll('.editor-images .editor-preview image')[1].attributes('src')).toBe(
    '/local/photo.jpg'
  );
  expect(wrapper.find('[aria-label="读取动态最新版本"]').exists()).toBe(true);
  expect(wrapper.find('.editor-latest-content').exists()).toBe(false);
});

test('reopening an old-version text draft retains it for review instead of silently replacing it', async () => {
  storage.set(
    'community-draft:A:old',
    JSON.stringify({
      content: '上次未提交的草稿',
      expectedUpdatedAt: originalPost.updatedAt,
    })
  );
  (getPost as jest.Mock).mockResolvedValueOnce({ code: 200, data: latestPost });
  const wrapper = await editor({ id: 'old' });
  expect(wrapper.get('textarea').element.value).toBe('上次未提交的草稿');
  expect(wrapper.get('.editor-latest-content').text()).toBe(latestPost.content);
  expect(wrapper.find('.editor-conflict').exists()).toBe(true);
  expect(wrapper.get('.campus-heading .campus-primary').attributes('disabled')).toBeDefined();
  expect(updatePost).not.toHaveBeenCalled();
});

test('a failed latest-version read leaves the draft recoverable and a late account-A read cannot enter account B', async () => {
  const wrapper = await conflictedEditor();
  (getPost as jest.Mock).mockRejectedValueOnce(new Error('连接失败'));
  await wrapper.get('[aria-label="读取动态最新版本"]').trigger('click');
  await flushPromises();
  expect(wrapper.get('textarea').element.value).toBe('我的未保存修改');
  expect(wrapper.text()).toContain('连接失败');
  let finish!: (value: any) => void;
  (getPost as jest.Mock).mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    })
  );
  await wrapper.get('[aria-label="读取动态最新版本"]').trigger('click');
  user.sessionVersion++;
  user.userInfo = { id: 'B' };
  finish({ code: 200, data: latestPost });
  await flushPromises();
  expect(wrapper.find('.editor-conflict').exists()).toBe(false);
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(wrapper.text()).not.toContain(latestPost.content);
  expect(storage.has('community-draft:B:old')).toBe(false);
});

test('a late conflict confirmation cannot restore private edits after the account changes', async () => {
  const wrapper = await conflictedEditor();
  await readLatest(wrapper);
  await wrapper.get('[aria-label="保留我的修改继续编辑"]').trigger('click');
  user.sessionVersion++;
  user.userInfo = { id: 'B' };
  await answerModal(true);
  expect(wrapper.find('.editor-conflict').exists()).toBe(false);
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(storage.has('community-draft:B:old')).toBe(false);
  expect(updatePost).toHaveBeenCalledTimes(1);
});
test('native back keeps a dirty editor open when the user cancels', async () => {
  const wrapper = await editor();
  await wrapper.get('textarea').setValue('未完成');
  const back = (onBackPress as jest.Mock).mock.calls.slice(-1)[0][0];
  expect(back()).toBe(true);
  (uni.showModal as jest.Mock).mock.calls[0][0].success({ confirm: false });
  await flushPromises();
  expect(uni.navigateBack).not.toHaveBeenCalled();
  expect(wrapper.get('textarea').element.value).toBe('未完成');
});

test('leaving a directly opened editor falls back to the campus tab', async () => {
  const wrapper = await editor();
  await wrapper.get('.campus-heading .campus-button').trigger('click');
  await flushPromises();
  (uni.navigateBack as jest.Mock).mock.calls[0][0].fail();
  expect(openCampus).toHaveBeenCalledWith();
  expect(uni.redirectTo).not.toHaveBeenCalled();
});
