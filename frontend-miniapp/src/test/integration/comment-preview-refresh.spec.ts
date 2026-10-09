import { effectScope, reactive } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { useDishDetail } from '@/pages/dish/composables/use-dish-detail';
import { useComment } from '@/pages/dish/composables/use-comment';
import { getDishById } from '@/api/modules/dish';
import { getOwnReviewByDish, getReviewsByDish } from '@/api/modules/review';
import { getCommentsByReview } from '@/api/modules/comment';

const mockSession = reactive({ sessionVersion: 1, userInfo: { id: 'A' }, isLoggedIn: true });
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockSession }));
jest.mock('@/api/modules/dish', () => ({
  getDishById: jest.fn(),
  favoriteDish: jest.fn(),
  unfavoriteDish: jest.fn(),
}));
jest.mock('@/api/modules/review', () => ({
  getReviewsByDish: jest.fn(),
  getOwnReviewByDish: jest.fn(),
  createReview: jest.fn(),
  deleteReview: jest.fn(),
}));
jest.mock('@/api/modules/comment', () => ({
  getCommentsByReview: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
}));

const scopes: ReturnType<typeof effectScope>[] = [];
const setup = <T>(factory: () => T): T => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(factory)!;
};
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<any>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const reply = (id: string, status = 'approved') => ({
  id,
  reviewId: 'r1',
  userId: 'A',
  userNickname: '作者',
  userAvatar: '',
  content: id,
  status,
  floor: 1,
  createdAt: '2026-10-08T00:00:00Z',
  parentComment: null,
});
const commentResponse = (items: any[]) => ({
  code: 200,
  data: {
    items,
    canReply: true,
    meta: { page: 1, pageSize: 5, total: items.length, totalPages: items.length ? 1 : 0 },
  },
});
const publicResponse = (ids: string[]) => ({
  code: 200,
  data: {
    items: ids.map(id => ({
      id,
      dishId: 'd1',
      userId: 'other',
      rating: 5,
      content: id,
      images: [],
      createdAt: '2026-10-08T00:00:00Z',
    })),
    rating: { average: 5, total: ids.length, detail: { 5: ids.length } },
    meta: { page: 1, pageSize: 10, total: ids.length, totalPages: 1 },
  },
});

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.sessionVersion++;
  mockSession.userInfo = { id: 'A' };
  (getDishById as jest.Mock).mockResolvedValue({
    code: 200,
    data: { id: 'd1', subDishId: [], parentDishId: null },
  });
  (getReviewsByDish as jest.Mock).mockResolvedValue(publicResponse(['r1', 'r2']));
  (getOwnReviewByDish as jest.Mock).mockResolvedValue({ code: 200, data: null });
  (getCommentsByReview as jest.Mock).mockResolvedValue(commentResponse([]));
});
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop());
  jest.restoreAllMocks();
});

it('refreshes loaded visible previews after a detail refresh without fetching unmounted or removed previews', async () => {
  const state = setup(useDishDetail);
  await state.fetchDishDetail('d1');
  expect(getCommentsByReview).not.toHaveBeenCalled();
  (getCommentsByReview as jest.Mock).mockResolvedValue(commentResponse([reply('old')]));
  await state.fetchComments('r1');
  await state.fetchComments('removed');
  (getCommentsByReview as jest.Mock).mockResolvedValue(commentResponse([]));

  await state.fetchDishDetail('d1');

  expect(state.reviewComments.value.r1.items).toEqual([]);
  expect(state.reviewComments.value.removed.items[0].id).toBe('old');
  expect((getCommentsByReview as jest.Mock).mock.calls.map(call => call[0])).toEqual([
    'r1',
    'removed',
    'r1',
  ]);
});

it('refreshes the same owned-review preview when moderation changes its reply status', async () => {
  (getOwnReviewByDish as jest.Mock).mockResolvedValue({
    code: 200,
    data: { id: 'mine', dishId: 'd1', userId: 'A', status: 'approved', images: [] },
  });
  const state = setup(useDishDetail);
  await state.fetchDishDetail('d1');
  (getCommentsByReview as jest.Mock).mockResolvedValue(commentResponse([reply('own', 'pending')]));
  await state.fetchComments('mine');
  (getCommentsByReview as jest.Mock).mockResolvedValue(commentResponse([reply('own')]));
  await state.fetchDishDetail('d1');
  expect(state.reviewComments.value.mine.items[0].status).toBe('approved');
});

it('does not repeat a first preview fetch started while the initial detail read is completing', async () => {
  const publicRead = deferred();
  const previewRead = deferred();
  (getReviewsByDish as jest.Mock).mockReturnValue(publicRead.promise);
  (getCommentsByReview as jest.Mock).mockReturnValue(previewRead.promise);
  const state = setup(useDishDetail);
  const initial = state.fetchDishDetail('d1');
  await flushPromises();
  const preview = state.fetchComments('r1');
  publicRead.resolve(publicResponse(['r1']));
  await initial;
  expect(getCommentsByReview).toHaveBeenCalledTimes(1);
  previewRead.resolve(commentResponse([reply('initial')]));
  await preview;
});

it.each([false, true])(
  'supersedes an in-flight preview and ignores its old response/finally, newest settles first: %s',
  async newestFirst => {
    const state = setup(useDishDetail);
    await state.fetchDishDetail('d1');
    const oldRead = deferred();
    const newRead = deferred();
    (getCommentsByReview as jest.Mock)
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(newRead.promise);
    const old = state.fetchComments('r1');
    const refresh = state.fetchDishDetail('d1');
    await flushPromises();
    const finishNew = async () => {
      newRead.resolve(commentResponse([reply('new')]));
      await refresh;
    };
    if (newestFirst) await finishNew();
    oldRead.resolve(commentResponse([reply('old')]));
    await old;
    expect(state.reviewComments.value.r1.loading).toBe(!newestFirst);
    if (!newestFirst) await finishNew();
    expect(state.reviewComments.value.r1.items[0].content).toBe('new');
  }
);

it('preserves loaded content when the preview refresh fails', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const state = setup(useDishDetail);
  await state.fetchDishDetail('d1');
  (getCommentsByReview as jest.Mock).mockResolvedValue(commentResponse([reply('cached')]));
  await state.fetchComments('r1');
  (getCommentsByReview as jest.Mock).mockRejectedValue(new Error('offline'));
  await state.fetchDishDetail('d1');
  expect(getCommentsByReview).toHaveBeenCalledTimes(2);
  expect(state.reviewComments.value.r1).toMatchObject({
    items: [{ content: 'cached' }],
    total: 1,
    loading: false,
  });
  expect(errorLog).toHaveBeenCalledWith('获取评论失败', expect.any(Error));
});

it('does not let an obsolete detail refresh trigger an extra preview request', async () => {
  const state = setup(useDishDetail);
  await state.fetchDishDetail('d1');
  (getCommentsByReview as jest.Mock).mockResolvedValue(commentResponse([reply('cached')]));
  await state.fetchComments('r1');
  const oldDetail = deferred();
  (getDishById as jest.Mock).mockReturnValueOnce(oldDetail.promise);
  const obsolete = state.fetchDishDetail('d1');
  (getCommentsByReview as jest.Mock).mockResolvedValue(commentResponse([reply('current')]));
  await state.fetchDishDetail('d1');
  oldDetail.resolve({ code: 200, data: { id: 'd1', subDishId: [], parentDishId: null } });
  expect(await obsolete).toBe(false);
  expect(state.reviewComments.value.r1.items[0].id).toBe('current');
  expect(getCommentsByReview).toHaveBeenCalledTimes(2);
});

it('ignores a replaced preview failure without clearing the current loading state', async () => {
  const state = setup(useComment);
  const oldRead = deferred();
  const newRead = deferred();
  (getCommentsByReview as jest.Mock)
    .mockReturnValueOnce(oldRead.promise)
    .mockReturnValueOnce(newRead.promise);
  const old = state.fetchComments('r1');
  const current = state.fetchComments('r1', true);
  oldRead.reject(new Error('old failure'));
  await old;
  expect(state.reviewComments.value.r1.loading).toBe(true);
  newRead.resolve(commentResponse([reply('latest')]));
  await current;
  expect(state.reviewComments.value.r1.items[0].id).toBe('latest');
});

it('keeps previews from an old login out of the new login cache', async () => {
  const state = setup(useComment);
  const oldRead = deferred();
  (getCommentsByReview as jest.Mock)
    .mockReturnValueOnce(oldRead.promise)
    .mockResolvedValueOnce(commentResponse([reply('B')]));
  const old = state.fetchComments('r1');
  mockSession.sessionVersion++;
  mockSession.userInfo = { id: 'B' };
  await state.fetchComments('r1');
  oldRead.resolve(commentResponse([reply('A-private', 'pending')]));
  await old;
  expect(state.reviewComments.value.r1.items[0].id).toBe('B');
});

it('does not apply a preview response after its owner is disposed', async () => {
  const state = setup(useComment);
  const read = deferred();
  (getCommentsByReview as jest.Mock).mockReturnValue(read.promise);
  const pending = state.fetchComments('r1');
  scopes[0].stop();
  read.resolve(commentResponse([reply('disposed')]));
  await pending;
  expect(state.reviewComments.value.r1.items).toEqual([]);
});
