import { effectScope, reactive } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';
import AllCommentsPanel from '@/pages/dish/components/AllCommentsPanel.vue';
import { useComment, useCommentPanel } from '@/pages/dish/composables/use-comment';
import { useReport } from '@/pages/dish/composables/use-report';
import {
  getCommentsByReview,
  createComment,
  reportComment,
  deleteComment,
} from '@/api/modules/comment';
import { reportReview } from '@/api/modules/review';

const mockSession = reactive({ sessionVersion: 1, userInfo: { id: 'A' }, isLoggedIn: true });
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockSession }));
jest.mock('@/api/modules/comment', () => ({
  getCommentsByReview: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
  reportComment: jest.fn(),
}));
jest.mock('@/api/modules/review', () => ({ reportReview: jest.fn() }));
const scopes: ReturnType<typeof effectScope>[] = [];
const makeSavedReply = () => ({
  id: 'saved-reply',
  reviewId: 'review',
  userId: 'A',
  userNickname: 'A',
  userAvatar: '',
  content: '已保存的回复',
  floor: 26,
  status: 'pending',
  parentComment: null,
  createdAt: '2026-10-08T12:00:26Z',
});
const firstReplyPage = () => ({
  code: 200,
  data: {
    items: Array.from({ length: 10 }, (_, i) => ({
      ...makeSavedReply(),
      id: 'public-' + i,
      userId: 'B',
      status: 'approved',
      floor: i + 1,
      createdAt: new Date(Date.UTC(2026, 9, 8, 12, 0, i)).toISOString(),
    })),
    canReply: true,
    meta: { page: 1, pageSize: 10, total: 25, totalPages: 3 },
  },
});
const scoped = <T>(fn: () => T): T => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(fn)!;
};
beforeEach(() => {
  jest.clearAllMocks();
  mockSession.sessionVersion++;
});
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));

it.each(['panel', 'session'])(
  'does not carry a confirmed unpaged reply into a new %s owner',
  async owner => {
    let resolve!: (value: any) => void;
    (getCommentsByReview as jest.Mock)
      .mockResolvedValueOnce(firstReplyPage())
      .mockReturnValueOnce(
        new Promise(done => {
          resolve = done;
        })
      )
      .mockResolvedValueOnce(firstReplyPage());
    (createComment as jest.Mock).mockResolvedValueOnce({ code: 201, data: makeSavedReply() });
    const panel = scoped(() => useCommentPanel(() => 'review'));
    await panel.fetchPanelComments();
    panel.replyContent.value = '已保存的回复';
    const submission = panel.submitReply();
    await flushPromises();
    expect(panel.comments.value.some(reply => reply.id === 'saved-reply')).toBe(true);
    if (owner === 'panel') panel.resetPanel();
    else mockSession.sessionVersion++;
    resolve(firstReplyPage());
    expect(await submission).toBe(false);
    await panel.fetchPanelComments();
    expect(panel.comments.value.some(reply => reply.id === 'saved-reply')).toBe(false);
  }
);

it('removes a confirmed unpaged reply after an explicit successful delete', async () => {
  (getCommentsByReview as jest.Mock).mockResolvedValue(firstReplyPage());
  (createComment as jest.Mock).mockResolvedValueOnce({ code: 201, data: makeSavedReply() });
  (deleteComment as jest.Mock).mockResolvedValueOnce({ code: 200 });
  const panel = scoped(() => useCommentPanel(() => 'review'));
  await panel.fetchPanelComments();
  panel.replyContent.value = '已保存的回复';
  expect(await panel.submitReply()).toBe(true);
  expect(await panel.removePanelComment('saved-reply')).toBe(true);
  expect(panel.comments.value.some(reply => reply.id === 'saved-reply')).toBe(false);
  await panel.refreshComments();
  expect(panel.comments.value.some(reply => reply.id === 'saved-reply')).toBe(false);
});

it('drops an unpaged write no longer returned after all pages have been read', async () => {
  const first = firstReplyPage();
  const rows = Array.from({ length: 15 }, (_, i) => ({
    ...makeSavedReply(),
    id: 'public-' + (10 + i),
    userId: 'B',
    status: 'approved',
    floor: i + 11,
    createdAt: new Date(Date.UTC(2026, 9, 8, 12, 0, i + 10)).toISOString(),
  }));
  (getCommentsByReview as jest.Mock)
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce({ ...first, data: { ...first.data, items: rows.slice(0, 10) } })
    .mockResolvedValueOnce({
      ...first,
      data: { ...first.data, items: rows.slice(10), meta: { ...first.data.meta, totalPages: 3 } },
    });
  (createComment as jest.Mock).mockResolvedValueOnce({ code: 201, data: makeSavedReply() });
  const panel = scoped(() => useCommentPanel(() => 'review'));
  await panel.fetchPanelComments();
  panel.replyContent.value = '已保存的回复';
  await panel.submitReply();
  expect(panel.comments.value.some(reply => reply.id === 'saved-reply')).toBe(true);
  await panel.loadMoreComments();
  await panel.loadMoreComments();
  expect(panel.comments.value.some(reply => reply.id === 'saved-reply')).toBe(false);
  expect(panel.comments.value).toHaveLength(25);
});

it('retries the failed second comment page while retaining the first', async () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: `${index}` }));
  (getCommentsByReview as jest.Mock)
    .mockResolvedValueOnce({ code: 200, data: { items } })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ code: 200, data: { items: [{ id: '10' }] } });
  const panel = scoped(() => useCommentPanel(() => 'review'));
  await panel.fetchPanelComments();
  await panel.loadMoreComments();
  expect(panel.comments.value).toEqual(items);
  expect(panel.error.value).toBeTruthy();
  expect(await panel.loadMoreComments()).toBe(false);
  await panel.retryComments();
  expect((getCommentsByReview as jest.Mock).mock.calls.map(call => call[1].page)).toEqual([
    1, 2, 2,
  ]);
});

it('does not restore an old account reply preview after an account switch', async () => {
  let resolve!: (value: any) => void;
  (getCommentsByReview as jest.Mock).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    })
  );
  const preview = scoped(useComment);
  const pending = preview.fetchComments('review');
  mockSession.sessionVersion++;
  resolve({ code: 200, data: { items: [{ id: 'private' }], meta: { total: 1 } } });
  await pending;
  expect(preview.reviewComments.value).toEqual({});
});

it.each(['send', 'delete'])(
  'retries page one after a %s refresh failure through the real panel retry control',
  async operation => {
    const pageItems = (page: number) =>
      Array.from({ length: 10 }, (_, index) => ({
        id: `${page}-${index}`,
        userId: 'A',
        userNickname: 'A',
      }));
    (getCommentsByReview as jest.Mock)
      .mockResolvedValueOnce({ code: 200, data: { items: pageItems(1) } })
      .mockResolvedValueOnce({ code: 200, data: { items: pageItems(2) } })
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce({ code: 200, data: { items: [{ id: 'refreshed' }] } });
    (createComment as jest.Mock).mockResolvedValueOnce({ code: 201 });
    (deleteComment as jest.Mock).mockResolvedValueOnce({ code: 200 });
    const wrapper = shallowMount(AllCommentsPanel, {
      props: { reviewId: 'review', isVisible: true },
    });
    try {
      await flushPromises();
      const panel = wrapper.vm as any;
      await panel.loadMoreComments();
      if (operation === 'send') {
        panel.replyContent = 'New reply';
        await panel.submitReply();
      } else await panel.removePanelComment('1-0');
      await flushPromises();
      expect(panel.error).toBeTruthy();
      await wrapper.get('.comment-state button').trigger('tap');
      await flushPromises();
      expect((getCommentsByReview as jest.Mock).mock.calls.map(call => call[1].page)).toEqual([
        1, 2, 1, 1,
      ]);
      expect(panel.comments).toEqual([{ id: 'refreshed' }]);
    } finally {
      wrapper.unmount();
    }
  }
);

it.each(['panel', 'session'])(
  'ignores a failed-page retry after its %s owner changes',
  async owner => {
    (getCommentsByReview as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const panel = scoped(() => useCommentPanel(() => 'review'));
    await panel.fetchPanelComments();
    let resolve!: (value: any) => void;
    (getCommentsByReview as jest.Mock).mockReturnValueOnce(
      new Promise(done => {
        resolve = done;
      })
    );
    const retry = panel.retryComments();
    if (owner === 'panel') panel.resetPanel();
    else mockSession.sessionVersion++;
    panel.replyContent.value = 'New owner draft';
    resolve({ code: 200, data: { items: [{ id: 'obsolete' }] } });
    expect(await retry).toBe(false);
    expect(panel.comments.value).toEqual([]);
    expect(panel.replyContent.value).toBe('New owner draft');
    expect(await panel.retryComments()).toBe(false);
  }
);

it('locks a reply request and does not clear a reopened panel draft', async () => {
  let resolve!: (value: any) => void;
  (createComment as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const added = jest.fn();
  const panel = scoped(() => useCommentPanel(() => 'review', added));
  panel.replyContent.value = 'First';
  const pending = panel.submitReply();
  expect(await panel.submitReply()).toBe(false);
  expect(createComment).toHaveBeenCalledTimes(1);
  panel.resetPanel();
  panel.replyContent.value = 'New draft';
  resolve({ code: 201 });
  expect(await pending).toBe(false);
  expect(panel.replyContent.value).toBe('New draft');
  expect(added).not.toHaveBeenCalled();
});

it('ignores a reply after an account switch', async () => {
  let resolve!: (value: any) => void;
  (createComment as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const panel = scoped(() => useCommentPanel(() => 'review'));
  panel.replyContent.value = 'First';
  const pending = panel.submitReply();
  mockSession.sessionVersion++;
  panel.replyContent.value = 'Second account';
  resolve({ code: 201 });
  expect(await pending).toBe(false);
  expect(panel.replyContent.value).toBe('Second account');
});

it('keeps a reopened report visible when the previous report finishes', async () => {
  let resolve!: (value: any) => void;
  (reportReview as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const report = scoped(useReport);
  report.openReportModal('review', 'old');
  const pending = report.submitReport({ type: 'spam', reason: 'Reason' });
  expect(await report.submitReport({ type: 'spam', reason: 'Reason' })).toBe(false);
  report.closeReportModal();
  report.openReportModal('comment', 'new');
  resolve({ code: 201 });
  expect(await pending).toBe(false);
  expect(report.isReportVisible.value).toBe(true);
  expect(reportComment).not.toHaveBeenCalled();
});

it('does not report success for an API error response', async () => {
  (reportReview as jest.Mock).mockResolvedValue({ code: 500, message: 'Try again' });
  const report = scoped(useReport);
  report.openReportModal('review', 'review');
  expect(await report.submitReport({ type: 'spam', reason: 'Reason' })).toBe(false);
  expect(report.isReportVisible.value).toBe(true);
});
