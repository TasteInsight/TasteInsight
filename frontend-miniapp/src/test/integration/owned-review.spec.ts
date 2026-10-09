import { effectScope, reactive } from 'vue';
import { useReview } from '@/pages/dish/composables/use-review';
import { getOwnReviewByDish, getReviewsByDish } from '@/api/modules/review';

const mockSession = reactive({ sessionVersion: 1, isLoggedIn: true, userInfo: { id: 'A' } });
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockSession }));
jest.mock('@/api/modules/review', () => ({
  getOwnReviewByDish: jest.fn(),
  getReviewsByDish: jest.fn(),
  createReview: jest.fn(),
  deleteReview: jest.fn(),
}));
const scopes: ReturnType<typeof effectScope>[] = [];
const setup = () => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(useReview)!;
};
beforeEach(() => {
  jest.clearAllMocks();
  mockSession.userInfo = { id: 'A' };
  mockSession.sessionVersion++;
});
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));

it.each(['pending', 'rejected', 'approved'])(
  'retrieves an owned %s review outside public pagination',
  async status => {
    const review = {
      id: 'old-review',
      userId: 'A',
      status,
      createdAt: '2020-01-01',
      content: 'Preserve me',
    };
    (getOwnReviewByDish as jest.Mock).mockResolvedValue({ code: 200, data: review });
    const state = setup();
    expect(await state.fetchOwnReview('dish')).toBe(true);
    expect(state.ownReview.value).toEqual(review);
    expect(state.ownReviewLoaded.value).toBe(true);
    expect(getReviewsByDish).not.toHaveBeenCalled();
  }
);

it('keeps failed ownership reads distinct from a confirmed absent review', async () => {
  const state = setup();
  (getOwnReviewByDish as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  expect(await state.fetchOwnReview('dish')).toBe(false);
  expect(state.ownReviewLoaded.value).toBe(false);
  expect(state.ownReviewError.value).toBeTruthy();
  (getOwnReviewByDish as jest.Mock).mockResolvedValueOnce({ code: 200, data: null });
  expect(await state.fetchOwnReview('dish')).toBe(true);
  expect(state.ownReview.value).toBeNull();
  expect(state.ownReviewError.value).toBe('');
});

it('ignores private data returning after an account switch', async () => {
  let resolve!: (value: any) => void;
  (getOwnReviewByDish as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const state = setup();
  const pending = state.fetchOwnReview('dish');
  mockSession.userInfo = { id: 'B' };
  mockSession.sessionVersion++;
  resolve({ code: 200, data: { userId: 'A', content: 'Private pending review' } });
  expect(await pending).toBe(false);
  expect(state.ownReview.value).toBeNull();
  expect(state.ownReviewLoaded.value).toBe(false);
});

it('invalidates a pre-write read so it cannot re-enable an obsolete editing baseline', async () => {
  let resolve!: (value: any) => void;
  (getOwnReviewByDish as jest.Mock).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    })
  );
  const state = setup();
  const oldRead = state.fetchOwnReview('dish');
  state.invalidateOwnReview();
  (getOwnReviewByDish as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { id: 'review', content: 'Saved' },
  });
  expect(await state.fetchOwnReview('dish')).toBe(true);
  resolve({ code: 200, data: null });
  expect(await oldRead).toBe(false);
  expect(state.ownReview.value).toMatchObject({ content: 'Saved' });
  expect(state.ownReviewLoaded.value).toBe(true);
});

it('lets the latest owned-review refresh supersede an in-flight read', async () => {
  let resolve!: (value: any) => void;
  (getOwnReviewByDish as jest.Mock).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    })
  );
  const state = setup();
  const oldRead = state.fetchOwnReview('dish');
  (getOwnReviewByDish as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { id: 'review', content: 'Latest' },
  });
  expect(await state.fetchOwnReview('dish')).toBe(true);
  resolve({ code: 200, data: null });
  expect(await oldRead).toBe(false);
  expect(state.ownReview.value).toMatchObject({ content: 'Latest' });
  expect(state.ownReviewLoading.value).toBe(false);
});

it('preserves reviews and retries the same failed append page', async () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `${i}` }));
  (getReviewsByDish as jest.Mock)
    .mockResolvedValueOnce({ code: 200, data: { items, meta: { totalPages: 3 } } })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ code: 200, data: { items: [{ id: '10' }], meta: { totalPages: 3 } } });
  const state = setup();
  await state.fetchReviews('dish', true);
  await state.fetchReviews('dish');
  expect(state.reviews.value).toEqual(items);
  await state.fetchReviews('dish');
  expect((getReviewsByDish as jest.Mock).mock.calls.map(call => call[1].page)).toEqual([1, 2, 2]);
});
