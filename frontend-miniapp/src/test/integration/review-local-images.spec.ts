import { createPinia, setActivePinia } from 'pinia';
import { effectScope } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { useUserStore } from '@/store/modules/use-user-store';
import { useReviewForm } from '@/pages/dish/composables/use-review';
import ReviewForm from '@/pages/dish/components/ReviewForm.vue';
import DishPage from '@/pages/dish/index.vue';
import { onBackPress } from '@dcloudio/uni-app';

jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onBackPress: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
  onHide: jest.fn(),
}));

const storage = new Map<string, any>();
const requests: any[] = [];
const uploads: any[] = [];
const saves: any[] = [];
const wrappers: any[] = [];
const scopes: ReturnType<typeof effectScope>[] = [];
const profile = (id: string) => ({ id, openId: `${id}-openid`, nickname: id });
const success = (data: any) => ({ statusCode: 200, data: { code: 200, data } });
const reviewRequests = () => requests.filter(item => new URL(item.url).pathname === '/reviews');
const fileSystem = { saveFile: jest.fn(), removeSavedFile: jest.fn() };
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
  setStorageSync: jest.fn(),
  removeStorageSync: (key: string) => storage.delete(key),
  getFileSystemManager: jest.fn(),
  request: jest.fn(),
  uploadFile: jest.fn(),
  showToast: jest.fn(),
  reLaunch: jest.fn(),
  navigateBack: jest.fn(),
  chooseImage: jest.fn(),
  previewImage: jest.fn(),
  getSystemInfoSync: () => ({ windowWidth: 375 }),
  hideTabBar: jest.fn(),
  showTabBar: jest.fn(),
};
(global as any).uni = uniMock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  storage.clear();
  storage.set('token', 'A-access');
  storage.set('refreshToken', 'A-refresh');
  storage.set('userInfo', JSON.stringify(profile('A')));
  requests.length = 0;
  uploads.length = 0;
  saves.length = 0;
  setActivePinia(createPinia());
  uniMock.setStorageSync.mockImplementation((key, value) =>
    storage.set(key, JSON.parse(JSON.stringify(value)))
  );
  uniMock.getFileSystemManager.mockReturnValue(fileSystem);
  fileSystem.saveFile.mockImplementation(options => saves.push(options));
  fileSystem.removeSavedFile.mockImplementation(options => options.success?.({}));
  uniMock.request.mockImplementation(options => {
    requests.push(options);
    const path = new URL(options.url).pathname;
    if (path === '/auth/wechat/login') {
      const id = options.data.code;
      options.success(
        success({
          token: { accessToken: `${id}-access`, refreshToken: `${id}-refresh` },
          user: profile(id),
        })
      );
    } else if (path === '/user/profile') {
      const id = options.header.Authorization.split(' ')[1].split('-')[0];
      options.success(success(profile(id)));
    }
    return { abort: jest.fn() };
  });
  uniMock.uploadFile.mockImplementation(options => {
    uploads.push(options);
    return { abort: jest.fn() };
  });
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  scopes.splice(0).forEach(scope => scope.stop());
  jest.clearAllTimers();
  jest.useRealTimers();
});

function form() {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useReviewForm())!;
}

test('forwards the saved review moderation state to its success consumer', async () => {
  const state = form();
  state.rating.value = 4;
  state.content.value = '保存的评价';
  const onSuccess = jest.fn();
  const pending = state.handleSubmit('dish', onSuccess);
  await flushPromises();
  const review = {
    id: 'saved-review',
    dishId: 'dish',
    userId: 'A',
    userNickname: 'A',
    userAvatar: '',
    rating: 4,
    ratingDetails: null,
    content: '保存的评价',
    images: [],
    status: 'pending',
    createdAt: '2026-10-08T12:00:00Z',
  };
  reviewRequests()[0].success(success(review));
  await pending;
  expect(onSuccess).toHaveBeenCalledWith(review);
});

function mountForm(props: Record<string, any> = {}) {
  const wrapper = shallowMount(ReviewForm, { props: { dishId: 'dish', dishName: '菜', ...props } });
  wrappers.push(wrapper);
  return wrapper;
}

const ReviewHelper = {
  name: 'ReviewHelper',
  props: ['show'],
  emits: ['leave', 'afterleave'],
  template: '<div />',
};

async function mountDishForm(initialReview: any = null) {
  const wrapper = shallowMount(DishPage, {
    global: {
      stubs: {
        ReviewForm: false,
        'page-container': ReviewHelper,
        RatingBars: { template: '<div />', methods: { refresh: jest.fn() } },
      },
    },
  });
  wrappers.push(wrapper);
  const vm = wrapper.vm as any;
  vm.dishId = 'dish';
  vm.myReview = initialReview;
  vm.ownReviewLoaded = true;
  vm.showReviewForm();
  await flushPromises();
  return { wrapper, child: wrapper.getComponent(ReviewForm) };
}

test.each(['create', 'edit'])(
  'review success blocks immediate %s reopen until its saved baseline arrives',
  async mode => {
    const initial =
      mode === 'edit' ? { id: 'review', rating: 4, content: 'Old content', images: [] } : null;
    const { wrapper, child } = await mountDishForm(initial);
    const page = wrapper.vm as any;
    const composer = child.vm as any;
    composer.rating = 4;
    composer.content = 'Just submitted';
    const submission = composer.handleSubmit();
    await flushPromises();
    reviewRequests()[0].success(success({ id: 'review' }));
    await submission;

    page.showReviewForm();
    expect(page.isReviewFormVisible).toBe(false);
    expect(page.ownReviewLoaded).toBe(false);
    const detail = requests.find(item => new URL(item.url).pathname === '/dishes/dish');
    expect(detail).toBeDefined();
    detail.success(success({ id: 'dish', name: '菜', images: [] }));
    await flushPromises();
    const mine = requests.find(item => new URL(item.url).pathname.endsWith('/reviews/mine'));
    mine.success(
      success({
        id: 'review',
        userId: 'A',
        rating: 4,
        content: 'Just submitted',
        images: [],
        status: 'pending',
      })
    );
    await flushPromises();
    page.showReviewForm();
    await flushPromises();
    const freshComposer = wrapper.getComponent(ReviewForm).vm as any;
    expect(freshComposer.content).toBe('Just submitted');
    freshComposer.content = 'Next draft';
    requests
      .find(item => new URL(item.url).pathname === '/dishes/dish/reviews')
      .success(success({ items: [] }));
    await flushPromises();
    expect(freshComposer.content).toBe('Next draft');
  }
);

test('review success never reopens an empty composer when the saved baseline refresh fails', async () => {
  const { wrapper, child } = await mountDishForm();
  const page = wrapper.vm as any;
  (child.vm as any).rating = 4;
  const submission = (child.vm as any).handleSubmit();
  await flushPromises();
  reviewRequests()[0].success(success({ id: 'review' }));
  await submission;
  expect(page.ownReviewLoaded).toBe(false);
  requests
    .find(item => new URL(item.url).pathname === '/dishes/dish')
    .success(success({ id: 'dish', name: '菜', images: [] }));
  await flushPromises();
  requests
    .find(item => new URL(item.url).pathname === '/dishes/dish/reviews')
    .success(success({ items: [] }));
  requests
    .find(item => new URL(item.url).pathname.endsWith('/reviews/mine'))
    .fail({ errMsg: 'request:fail offline' });
  await flushPromises();
  page.showReviewForm();
  expect(page.ownReviewError).toBeTruthy();
  expect(page.isReviewFormVisible).toBe(false);
});

function select(vm: any, paths = ['http://tmp/selected.jpg']) {
  uniMock.chooseImage.mockImplementation(options => options.success({ tempFilePaths: paths }));
  vm.handleChooseImage();
}

function finishUpload(index = 0, url = 'https://images.test/submitted.jpg') {
  uploads[index].success({ statusCode: 200, data: JSON.stringify({ code: 200, data: { url } }) });
}

test('selecting review photos stays local and keeps the three-photo limit', async () => {
  const wrapper = mountForm();
  const vm = wrapper.vm as any;
  select(vm, ['http://tmp/one.jpg', '/tmp/two.jpg', '/tmp/three.jpg']);
  await flushPromises();
  expect(uploads).toHaveLength(0);
  expect(saves).toHaveLength(0);
  expect(vm.images.map((image: any) => image.path)).toEqual([
    'http://tmp/one.jpg',
    '/tmp/two.jpg',
    '/tmp/three.jpg',
  ]);
  expect(wrapper.findAll('[src]').map(image => image.attributes('src'))).toEqual([
    'http://tmp/one.jpg',
    '/tmp/two.jpg',
    '/tmp/three.jpg',
  ]);
  vm.handlePreviewImage(0);
  expect(uniMock.previewImage).toHaveBeenCalledWith({
    current: 'http://tmp/one.jpg',
    urls: ['http://tmp/one.jpg', '/tmp/two.jpg', '/tmp/three.jpg'],
  });
  vm.handleChooseImage();
  expect(uniMock.chooseImage).toHaveBeenCalledTimes(1);
});

test.each(['native-back', 'page-leave', 'go-back'])(
  'the dish page %s waits for image draft persistence before hiding',
  async close => {
    const { wrapper, child } = await mountDishForm();
    select(child.vm);
    if (close === 'native-back') {
      expect((onBackPress as jest.Mock).mock.calls.slice(-1)[0][0]()).toBe(true);
    } else if (close === 'page-leave') {
      wrapper.getComponent(ReviewHelper).vm.$emit('leave');
    } else {
      (wrapper.vm as any).goBack();
    }
    await flushPromises();
    expect(saves).toHaveLength(1);
    expect(wrapper.findComponent(ReviewForm).exists()).toBe(true);
    expect(uniMock.navigateBack).not.toHaveBeenCalled();
    saves[0].success({ savedFilePath: '/saved/native-back.jpg' });
    await flushPromises();
    expect(wrapper.findComponent(ReviewForm).exists()).toBe(false);
    expect(storage.get('review_state:A:dish').images[0].path).toBe('/saved/native-back.jpg');
    expect(uploads).toHaveLength(0);
    expect(fileSystem.removeSavedFile).not.toHaveBeenCalled();
  }
);

test('native leave re-arms the back interceptor while saving and after save failure', async () => {
  const { wrapper, child } = await mountDishForm();
  select(child.vm);
  const firstHelper = wrapper.getComponent(ReviewHelper).vm;
  firstHelper.$emit('leave');
  await flushPromises();
  firstHelper.$emit('afterleave');
  await flushPromises();
  const nextHelper = wrapper.getComponent(ReviewHelper).vm;
  expect(nextHelper).not.toBe(firstHelper);
  expect(wrapper.getComponent(ReviewHelper).props('show')).toBe(true);
  nextHelper.$emit('leave');
  expect((onBackPress as jest.Mock).mock.calls.slice(-1)[0][0]()).toBe(true);
  (wrapper.vm as any).goBack();
  await flushPromises();
  expect(saves).toHaveLength(1);
  expect(wrapper.findComponent(ReviewForm).exists()).toBe(true);
  expect(uniMock.navigateBack).not.toHaveBeenCalled();
  saves[0].fail(new Error('disk full'));
  await flushPromises();
  nextHelper.$emit('afterleave');
  await flushPromises();
  expect(wrapper.getComponent(ReviewHelper).vm).not.toBe(nextHelper);
  expect(wrapper.findComponent(ReviewForm).exists()).toBe(true);
  wrapper.getComponent(ReviewHelper).vm.$emit('leave');
  expect(saves).toHaveLength(2);
  saves[1].success({ savedFilePath: '/saved/retried-back.jpg' });
  await flushPromises();
  expect(wrapper.findComponent(ReviewForm).exists()).toBe(false);
});

test('a session switch closes the previous account form and discards stale saved files', async () => {
  const { wrapper, child } = await mountDishForm();
  select(child.vm);
  wrapper.getComponent(ReviewHelper).vm.$emit('leave');
  await useUserStore().loginAction('B');
  saves[0].success({ savedFilePath: '/saved/stale-back.jpg' });
  await flushPromises();
  wrapper.getComponent(ReviewHelper).vm.$emit('afterleave');
  await flushPromises();
  expect(wrapper.findComponent(ReviewForm).exists()).toBe(false);
  expect(wrapper.getComponent(ReviewHelper).props('show')).toBe(false);
  expect(storage.has('review_state:A:dish')).toBe(false);
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/stale-back.jpg' })
  );
});

test('native leave during submit does not unmount the form or start a draft save', async () => {
  const { wrapper, child } = await mountDishForm();
  const vm = child.vm as any;
  vm.rating = 4;
  select(vm);
  const submitting = vm.handleSubmit();
  const helper = wrapper.getComponent(ReviewHelper).vm;
  helper.$emit('leave');
  helper.$emit('afterleave');
  await flushPromises();
  expect(wrapper.findComponent(ReviewForm).exists()).toBe(true);
  expect(wrapper.getComponent(ReviewHelper).vm).not.toBe(helper);
  expect(saves).toHaveLength(0);
  uploads[0].fail(new Error('upload failed'));
  await submitting;
  expect(wrapper.findComponent(ReviewForm).exists()).toBe(true);
});

test('a delayed helper teardown cannot remove the interceptor for a reopened form', async () => {
  const { wrapper, child } = await mountDishForm();
  await (child.vm as any).handleClose();
  await flushPromises();
  (wrapper.vm as any).showReviewForm();
  await flushPromises();
  jest.advanceTimersByTime(300);
  await flushPromises();
  expect(wrapper.findComponent(ReviewForm).exists()).toBe(true);
  expect(wrapper.getComponent(ReviewHelper).props('show')).toBe(true);
});

test.each(['session', 'dispose', 'route'])(
  'the review success refresh cannot continue after a %s change',
  async change => {
    const { wrapper, child } = await mountDishForm();
    const vm = child.vm as any;
    vm.rating = 4;
    const submitted = vm.handleSubmit();
    await flushPromises();
    reviewRequests()[0].success(success({ id: 'review' }));
    await submitted;
    if (change === 'session') await useUserStore().loginAction('B');
    else if (change === 'dispose') wrapper.unmount();
    else (wrapper.vm as any).dishId = 'another-dish';
    const detail = requests.find(item => new URL(item.url).pathname === '/dishes/dish');
    detail.success(success({ id: 'dish', name: '菜', images: [] }));
    await flushPromises();
    expect(requests.filter(item => new URL(item.url).pathname.includes('/reviews'))).toHaveLength(
      1
    );
    expect(uniMock.showToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: '评价已提交' })
    );
  }
);

test('an opened composer keeps its captured baseline when a background owned-review read returns', async () => {
  const { wrapper, child } = await mountDishForm();
  const page = wrapper.vm as any;
  (child.vm as any).content = 'New local draft';
  const read = page.fetchOwnReview('dish');
  await flushPromises();
  requests
    .find(item => new URL(item.url).pathname.endsWith('/reviews/mine'))
    .success(success({ id: 'late-review', rating: 4, content: 'Remote content', images: [] }));
  await read;
  await flushPromises();
  expect((child.vm as any).content).toBe('New local draft');
  expect(child.props('initialReview')).toBeNull();
});

test('the review success refresh cannot show a success toast in a later session', async () => {
  const { wrapper } = await mountDishForm();
  const pending = (wrapper.vm as any).handleReviewSuccess();
  await flushPromises();
  const detail = requests.find(item => new URL(item.url).pathname === '/dishes/dish');
  detail.success(success({ id: 'dish', name: '菜', images: [] }));
  await flushPromises();
  const reviews = requests.find(item => new URL(item.url).pathname === '/dishes/dish/reviews');
  reviews.success(success({ items: [] }));
  const mine = requests.find(item => new URL(item.url).pathname === '/dishes/dish/reviews/mine');
  await useUserStore().loginAction('B');
  mine.success(success(null));
  await pending;
  expect(uniMock.showToast).not.toHaveBeenCalledWith(
    expect.objectContaining({ title: '评价已提交' })
  );
});

test('an image-only close waits for durable local save and reopens after relogin without network', async () => {
  const wrapper = mountForm();
  const vm = wrapper.vm as any;
  select(vm);
  const closing = vm.handleClose();
  expect(wrapper.emitted('close')).toBeUndefined();
  expect(saves[0].tempFilePath).toBe('http://tmp/selected.jpg');
  saves[0].success({ savedFilePath: '/saved/A-review.jpg' });
  await closing;
  expect(wrapper.emitted('close')).toHaveLength(1);
  expect(uploads).toHaveLength(0);
  expect(reviewRequests()).toHaveLength(0);
  expect(storage.get('review_state:A:dish').images).toEqual([
    { source: 'saved', path: '/saved/A-review.jpg' },
  ]);
  wrapper.unmount();
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalled();

  await useUserStore().loginAction('B');
  expect(form().hasSavedReviewState('dish')).toBe(false);
  await useUserStore().loginAction('A');
  const reopened = form();
  expect(reopened.loadReviewState('dish')).toBe(true);
  expect(reopened.images.value).toEqual([{ source: 'saved', path: '/saved/A-review.jpg' }]);
  expect(uploads).toHaveLength(0);
});

test('failed local saving leaves the form open and moved images available for retry', async () => {
  const wrapper = mountForm();
  const vm = wrapper.vm as any;
  select(vm, ['/tmp/one.jpg', '/tmp/two.jpg']);
  const closing = vm.handleClose();
  saves[0].success({ savedFilePath: '/saved/one.jpg' });
  await flushPromises();
  saves[1].fail(new Error('disk full'));
  await closing;
  expect(wrapper.emitted('close')).toBeUndefined();
  expect(storage.has('review_state:A:dish')).toBe(false);
  expect(vm.images.map((image: any) => image.path)).toEqual(['/saved/one.jpg', '/tmp/two.jpg']);
  expect(uploads).toHaveLength(0);

  const retry = vm.handleClose();
  expect(saves).toHaveLength(3);
  expect(saves[2].tempFilePath).toBe('/tmp/two.jpg');
  saves[2].success({ savedFilePath: '/saved/two.jpg' });
  await retry;
  expect(wrapper.emitted('close')).toHaveLength(1);
  expect(storage.get('review_state:A:dish').images.map((image: any) => image.path)).toEqual([
    '/saved/one.jpg',
    '/saved/two.jpg',
  ]);
});

test('unsupported local persistence cannot close the draft or fall back to uploading', async () => {
  uniMock.getFileSystemManager.mockReturnValue(undefined);
  const wrapper = mountForm();
  select(wrapper.vm);
  await (wrapper.vm as any).handleClose();
  expect(wrapper.emitted('close')).toBeUndefined();
  expect(uploads).toHaveLength(0);
  expect(storage.has('review_state:A:dish')).toBe(false);
  expect(uniMock.showToast).toHaveBeenCalledWith(
    expect.objectContaining({ title: expect.stringContaining('当前平台不支持图片草稿') })
  );
  const vm = wrapper.vm as any;
  vm.rating = 5;
  const pending = vm.handleSubmit();
  expect(uploads[0].filePath).toBe('http://tmp/selected.jpg');
  finishUpload();
  await flushPromises();
  reviewRequests()[0].success(success({ id: 'review' }));
  await pending;
  expect(wrapper.emitted('success')).toHaveLength(1);
});

test('storage failure retains moved images and the previous draft until a successful replacement', async () => {
  const draft = form();
  draft.addImages(['/tmp/first.jpg']);
  const first = draft.saveReviewState('dish');
  saves[0].success({ savedFilePath: '/saved/first.jpg' });
  await first;
  draft.removeImage(0);
  draft.addImages(['/tmp/replacement.jpg']);
  uniMock.setStorageSync.mockImplementationOnce(() => {
    throw new Error('storage quota exceeded');
  });
  const replacement = draft.saveReviewState('dish');
  saves[1].success({ savedFilePath: '/saved/replacement.jpg' });
  await expect(replacement).resolves.toBe(false);
  expect(storage.get('review_state:A:dish').images[0].path).toBe('/saved/first.jpg');
  expect(draft.images.value[0].path).toBe('/saved/replacement.jpg');
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalled();
  await expect(draft.saveReviewState('dish')).resolves.toBe(true);
  expect(saves).toHaveLength(2);
  expect(storage.get('review_state:A:dish').images[0].path).toBe('/saved/replacement.jpg');
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/first.jpg' })
  );
});

test('disposing a failed draft releases only uncommitted saved files, leaving original and other-owner files alone', async () => {
  storage.set('review_state:B:dish', {
    images: [{ source: 'saved', path: '/saved/B.jpg' }],
    timestamp: Date.now(),
  });
  const draft = form();
  draft.addImages(['/tmp/one.jpg', '/tmp/two.jpg']);
  const saving = draft.saveReviewState('dish');
  saves[0].success({ savedFilePath: '/saved/one.jpg' });
  await flushPromises();
  saves[1].fail(new Error('disk full'));
  await saving;
  scopes[0].stop();
  expect(fileSystem.removeSavedFile).toHaveBeenCalledTimes(1);
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/one.jpg' })
  );
  expect(storage.has('review_state:B:dish')).toBe(true);
});

test('saving an open draft after its prior timestamp expires retains its in-use images', async () => {
  const draft = form();
  draft.addImages(['/tmp/active.jpg']);
  const first = draft.saveReviewState('dish');
  saves[0].success({ savedFilePath: '/saved/active.jpg' });
  await first;
  jest.advanceTimersByTime(24 * 60 * 60 * 1000);
  draft.content.value = 'continued draft';
  await expect(draft.saveReviewState('dish')).resolves.toBe(true);
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalled();
  expect(storage.get('review_state:A:dish').timestamp).toBe(Date.now());
  expect(storage.get('review_state:A:dish').images[0].path).toBe('/saved/active.jpg');
});

test.each(['success', 'failure'])(
  'a stale local save %s cannot settle the new owner save',
  async outcome => {
    const draft = form();
    draft.addImages(['/tmp/A.jpg']);
    const old = draft.saveReviewState('dish');
    await useUserStore().loginAction('B');
    draft.addImages(['/tmp/B.jpg']);
    const current = draft.saveReviewState('dish');
    if (outcome === 'success') saves[0].success({ savedFilePath: '/saved/A-stale.jpg' });
    else saves[0].fail(new Error('old save failed'));
    await expect(old).resolves.toBe(false);
    expect(draft.isSaving.value).toBe(true);
    expect(uniMock.showToast).not.toHaveBeenCalled();
    saves[1].success({ savedFilePath: '/saved/B.jpg' });
    await expect(current).resolves.toBe(true);
    expect(storage.get('review_state:B:dish').images[0].path).toBe('/saved/B.jpg');
    expect(fileSystem.removeSavedFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ filePath: '/saved/B.jpg' })
    );
  }
);

test('a stale review response cannot clear a new owner draft or invoke success', async () => {
  const draft = form();
  draft.rating.value = 4;
  const callback = jest.fn();
  const old = draft.handleSubmit('dish', callback);
  await flushPromises();
  const oldRequest = reviewRequests()[0];
  await useUserStore().loginAction('B');
  draft.addImages(['/tmp/B.jpg']);
  const saving = draft.saveReviewState('dish');
  saves[0].success({ savedFilePath: '/saved/B.jpg' });
  await saving;
  oldRequest.success(success({ id: 'A-review' }));
  await old;
  expect(callback).not.toHaveBeenCalled();
  expect(storage.get('review_state:B:dish').images[0].path).toBe('/saved/B.jpg');
  expect(draft.images.value[0].path).toBe('/saved/B.jpg');
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalled();
});

test('dismissing a saved draft preserves its files and starting new explicitly discards them', async () => {
  const draft = form();
  draft.addImages(['/tmp/draft.jpg']);
  const saved = draft.saveReviewState('dish');
  saves[0].success({ savedFilePath: '/saved/draft.jpg' });
  await saved;
  const wrapper = mountForm();
  await (wrapper.vm as any).handleClose();
  expect(storage.has('review_state:A:dish')).toBe(true);
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalled();
  (wrapper.vm as any).startNewReview();
  expect(storage.has('review_state:A:dish')).toBe(false);
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/draft.jpg' })
  );
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/tmp/draft.jpg' })
  );
});

test.each(['open', 'save'])(
  '%s another dish reclaims only expired drafts of the current owner',
  async action => {
    const state = (path: string, timestamp: number) => ({
      rating: 0,
      content: '',
      images: [{ source: 'saved', path }],
      timestamp,
    });
    const expired = Date.now() - 24 * 60 * 60 * 1000;
    storage.set('review_state:A:old-dish', state('/saved/A-expired.jpg', expired));
    storage.set('review_state:A:fresh-dish', state('/saved/A-fresh.jpg', Date.now()));
    storage.set('review_state:B:old-dish', state('/saved/B-expired.jpg', expired));
    storage.set('review_state_legacy-dish', state('/saved/unowned.jpg', expired));
    if (action === 'open') mountForm({ dishId: 'different-dish' });
    else {
      const draft = form();
      draft.content.value = 'new draft';
      await draft.saveReviewState('different-dish');
    }
    expect(storage.has('review_state:A:old-dish')).toBe(false);
    expect(storage.has('review_state:A:fresh-dish')).toBe(true);
    expect(storage.has('review_state:B:old-dish')).toBe(true);
    expect(storage.has('review_state_legacy-dish')).toBe(true);
    expect(fileSystem.removeSavedFile).toHaveBeenCalledTimes(1);
    expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: '/saved/A-expired.jpg' })
    );
  }
);

test('submission validates before uploading and snapshots content while preserving existing remote photos', async () => {
  const draft = form();
  draft.setRemoteImages(['https://images.test/existing.jpg']);
  draft.addImages(['http://tmp/new.jpg']);
  await draft.handleSubmit('dish');
  draft.rating.value = 5;
  draft.setFlavorRating('spicyLevel', 1);
  await draft.handleSubmit('dish');
  expect(uploads).toHaveLength(0);
  draft.resetFlavorRatings();
  draft.content.value = 'original text';
  const submitted = jest.fn();
  const pending = draft.handleSubmit('dish', submitted);
  expect(uploads).toHaveLength(1);
  expect(uploads[0].filePath).toBe('http://tmp/new.jpg');
  expect(reviewRequests()).toHaveLength(0);
  draft.content.value = 'later text';
  finishUpload();
  await flushPromises();
  expect(reviewRequests()[0].data).toMatchObject({
    content: 'original text',
    images: ['https://images.test/existing.jpg', 'https://images.test/submitted.jpg'],
  });
  reviewRequests()[0].success(success({ id: 'review' }));
  await pending;
  expect(submitted).toHaveBeenCalledTimes(1);
});

test('the edit component marks existing photos as remote and does not reupload them', async () => {
  const wrapper = mountForm({
    existingReviewId: 'review',
    initialReview: {
      id: 'review',
      rating: 4,
      content: 'old',
      images: ['https://images.test/existing.jpg'],
    },
  });
  (wrapper.vm as any).content = 'Updated text';
  const pending = (wrapper.vm as any).handleSubmit();
  await flushPromises();
  expect(uploads).toHaveLength(0);
  expect(reviewRequests()[0].data.images).toEqual(['https://images.test/existing.jpg']);
  reviewRequests()[0].success(success({ id: 'review' }));
  await pending;
});

test('a failed upload preserves local inputs for retry and never posts the review', async () => {
  const draft = form();
  draft.rating.value = 4;
  draft.content.value = 'keep me';
  draft.addImages(['/tmp/retry.jpg']);
  const pending = draft.handleSubmit('dish');
  uploads[0].fail(new Error('upload failed'));
  await pending;
  expect(reviewRequests()).toHaveLength(0);
  expect(draft.images.value).toEqual([{ source: 'temporary', path: '/tmp/retry.jpg' }]);
  expect(draft.content.value).toBe('keep me');
  const retry = draft.handleSubmit('dish');
  expect(uploads[1].filePath).toBe('/tmp/retry.jpg');
  finishUpload(1);
  await flushPromises();
  reviewRequests()[0].success(success({ id: 'review' }));
  await retry;
});

test('switching identity during save disposes only the newly moved old-session file', async () => {
  const wrapper = mountForm();
  select(wrapper.vm);
  const closing = (wrapper.vm as any).handleClose();
  await useUserStore().loginAction('B');
  const current = form();
  current.content.value = 'B draft';
  await current.saveReviewState('dish');
  saves[0].success({ savedFilePath: '/saved/A-stale.jpg' });
  await closing;
  expect(storage.has('review_state:A:dish')).toBe(false);
  expect(storage.get('review_state:B:dish').content).toBe('B draft');
  expect(wrapper.emitted('close')).toBeUndefined();
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/A-stale.jpg' })
  );
});

test('unmounting during save releases the returned file without writing or closing', async () => {
  const wrapper = mountForm();
  select(wrapper.vm);
  const closing = (wrapper.vm as any).handleClose();
  wrapper.unmount();
  saves[0].success({ savedFilePath: '/saved/disposed.jpg' });
  await closing;
  expect(storage.has('review_state:A:dish')).toBe(false);
  expect(wrapper.emitted('close')).toBeUndefined();
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/disposed.jpg' })
  );
});

test('switching identity during upload cannot start a review or finish the next submission', async () => {
  const draft = form();
  draft.rating.value = 4;
  draft.addImages(['/tmp/A.jpg']);
  const oldCallback = jest.fn();
  const old = draft.handleSubmit('dish', oldCallback);
  await useUserStore().loginAction('B');
  draft.rating.value = 5;
  const current = draft.handleSubmit('dish');
  finishUpload();
  await old;
  expect(oldCallback).not.toHaveBeenCalled();
  expect(draft.submitting.value).toBe(true);
  expect(reviewRequests()).toHaveLength(1);
  expect(reviewRequests()[0].header.Authorization).toBe('Bearer B-access');
  expect(reviewRequests()[0].data.images).toEqual([]);
  reviewRequests()[0].success(success({ id: 'B-review' }));
  await current;
});

test('replacement, discard, submission and expiry remove only files owned by that draft', async () => {
  const draft = form();
  draft.addImages(['/tmp/A-first.jpg', '/tmp/A-second.jpg']);
  const saving = draft.saveReviewState('dish');
  saves[0].success({ savedFilePath: '/saved/A-first.jpg' });
  await flushPromises();
  saves[1].success({ savedFilePath: '/saved/A-second.jpg' });
  await saving;
  await useUserStore().loginAction('B');
  draft.addImages(['/tmp/B.jpg']);
  const savingB = draft.saveReviewState('dish');
  saves[2].success({ savedFilePath: '/saved/B.jpg' });
  await savingB;
  await useUserStore().loginAction('A');
  draft.loadReviewState('dish');
  draft.removeImage(0);
  await draft.saveReviewState('dish');
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/A-first.jpg' })
  );
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/A-second.jpg' })
  );
  draft.rating.value = 5;
  const submitted = draft.handleSubmit('dish');
  expect(uploads[0].filePath).toBe('/saved/A-second.jpg');
  finishUpload();
  await flushPromises();
  reviewRequests()[0].success(success({ id: 'review' }));
  await submitted;
  expect(storage.has('review_state:A:dish')).toBe(false);
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/A-second.jpg' })
  );
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/B.jpg' })
  );

  await useUserStore().loginAction('B');
  jest.advanceTimersByTime(24 * 60 * 60 * 1000);
  expect(draft.hasSavedReviewState('dish')).toBe(false);
  expect(storage.has('review_state:B:dish')).toBe(false);
  expect(fileSystem.removeSavedFile).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: '/saved/B.jpg' })
  );
  draft.setRemoteImages(['https://images.test/existing.jpg']);
  await draft.saveReviewState('dish');
  draft.clearReviewState('dish');
  expect(fileSystem.removeSavedFile).not.toHaveBeenCalledWith(
    expect.objectContaining({ filePath: 'https://images.test/existing.jpg' })
  );
});
