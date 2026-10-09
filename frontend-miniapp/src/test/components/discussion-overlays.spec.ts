import { defineComponent, h, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AllCommentsPanel from '@/pages/dish/components/AllCommentsPanel.vue';
import ReviewList from '@/pages/dish/components/ReviewList.vue';
import TasteProfile from '@/pages/dish/components/TasteProfile.vue';
import ReportDialog from '@/pages/dish/components/ReportDialog.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { getCommentsByReview, reportComment } from '@/api/modules/comment';
import type { Comment, Review, User } from '@/types/api';

jest.mock('@/api/modules/comment', () => ({
  getCommentsByReview: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
  reportComment: jest.fn(),
}));

const comment: Comment = {
  id: 'comment',
  reviewId: 'review',
  userId: 'author',
  userNickname: '回复作者',
  userAvatar: '',
  content: '晚餐也有供应。',
  floor: 1,
  parentComment: null,
  status: 'approved',
  createdAt: '2026-10-08T08:00:00.000Z',
};
const viewer: User = {
  id: 'viewer',
  openId: 'mock_viewer',
  nickname: '阅读者',
  avatar: '',
  createdAt: '2026-10-08T08:00:00.000Z',
  updatedAt: '2026-10-08T08:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  setActivePinia(createPinia());
  const user = useUserStore();
  user.userInfo = { ...viewer };
  user.token = 'unit-test-token';
  (getCommentsByReview as jest.Mock).mockResolvedValue({
    code: 200,
    message: 'success',
    data: {
      items: [comment],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    },
  });
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => success({ confirm: false }));
});

async function mountReplies() {
  const wrapper = mount(
    defineComponent({
      setup() {
        const visible = ref(true);
        return () =>
          h(AllCommentsPanel, {
            reviewId: 'review',
            isVisible: visible.value,
            onClose: () => {
              visible.value = false;
            },
          });
      },
    }),
    { global: { stubs: { 'page-container': true } } }
  );
  await flushPromises();
  return wrapper;
}

describe('discussion overlay ownership', () => {
  it('renders own private replies normally without exposing moderation or reply targets', async () => {
    (getCommentsByReview as jest.Mock).mockResolvedValue({
      code: 200,
      message: 'success',
      data: {
        items: [
          comment,
          { ...comment, id: 'pending', userId: viewer.id, status: 'pending' },
          { ...comment, id: 'rejected', userId: viewer.id, status: 'rejected' },
        ],
        canReply: true,
        meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
      },
    });
    const wrapper = await mountReplies();
    try {
      const rows = wrapper.findAll('.comment-row');
      expect(rows[0].find('.comment-reply-action').exists()).toBe(true);
      expect(rows[1].text()).toContain(comment.content);
      expect(rows[1].text()).not.toMatch(/待审核|仅你可见|未通过/);
      expect(rows[1].find('.comment-reply-action').exists()).toBe(false);
      expect(rows[2].text()).toContain(comment.content);
      expect(rows[2].text()).not.toMatch(/待审核|仅你可见|未通过/);
      expect(rows[2].find('.comment-reply-action').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
  it('does not expose a composer or invite replies when the review cannot be replied to', async () => {
    (getCommentsByReview as jest.Mock).mockResolvedValue({
      code: 200,
      message: 'success',
      data: {
        items: [],
        canReply: false,
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      },
    });
    const wrapper = await mountReplies();
    try {
      expect(wrapper.text()).toContain('还没有回复');
      expect(wrapper.text()).not.toMatch(/聊聊|尚未公开|待审核|审核/);
      expect(wrapper.find('.reply-composer').exists()).toBe(false);
      expect(wrapper.find('.sheet-footer').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
  it('consumes the report backdrop tap before the underlying layer can handle it', async () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          const reportVisible = ref(true);
          const underlyingClosed = ref(false);
          return () =>
            h(
              'div',
              {
                onTap: () => {
                  underlyingClosed.value = true;
                },
              },
              [
                h(
                  'span',
                  { class: 'underlying-state' },
                  underlyingClosed.value ? 'closed' : 'open'
                ),
                reportVisible.value
                  ? h(ReportDialog, {
                      onClose: () => {
                        reportVisible.value = false;
                      },
                    })
                  : null,
              ]
            );
        },
      }),
      { global: { stubs: { 'page-container': true } } }
    );
    try {
      await wrapper.get('.report-overlay').trigger('tap');
      await flushPromises();
      expect(wrapper.find('.report-overlay').exists()).toBe(false);
      expect(wrapper.get('.underlying-state').text()).toBe('open');
    } finally {
      wrapper.unmount();
    }
  });

  it('dismisses only the action menu on an outside tap, then allows the replies to close separately', async () => {
    const wrapper = await mountReplies();
    try {
      await wrapper.get('.comment-more').trigger('tap');
      expect(wrapper.find('.action-menu-overlay').exists()).toBe(true);
      await wrapper.get('.action-menu-overlay').trigger('tap');
      await flushPromises();
      expect(wrapper.find('.action-menu-overlay').exists()).toBe(false);
      expect(wrapper.find('#acp-root').exists()).toBe(true);
      expect(wrapper.text()).toContain('晚餐也有供应。');
      expect(uni.showModal).not.toHaveBeenCalled();

      await wrapper.get('.review-overlay').trigger('tap');
      await flushPromises();
      expect(wrapper.find('#acp-root').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it('dismisses the menu without treating an unsent reply as a panel-close attempt', async () => {
    const wrapper = await mountReplies();
    try {
      await wrapper.get('.reply-input').setValue('尚未发送的回复');
      await wrapper.get('.comment-more').trigger('tap');
      await wrapper.get('.action-menu-overlay').trigger('tap');
      await flushPromises();
      expect(uni.showModal).not.toHaveBeenCalled();
      expect(wrapper.find('#acp-root').exists()).toBe(true);
      expect((wrapper.get('.reply-input').element as HTMLInputElement).value).toBe(
        '尚未发送的回复'
      );
    } finally {
      wrapper.unmount();
    }
  });

  it('keeps replies open when cancelling the menu or dismissing the report dialog', async () => {
    const wrapper = await mountReplies();
    try {
      await wrapper.get('.comment-more').trigger('tap');
      await wrapper.get('.menu-cancel').trigger('tap');
      await flushPromises();
      expect(wrapper.find('#acp-root').exists()).toBe(true);

      await wrapper.get('.comment-more').trigger('tap');
      await wrapper.get('.menu-action').trigger('tap');
      await flushPromises();
      expect(wrapper.find('.action-menu-overlay').exists()).toBe(false);
      expect(wrapper.find('.report-overlay').exists()).toBe(true);
      expect(reportComment).not.toHaveBeenCalled();
      await wrapper.get('.report-overlay').trigger('tap');
      await flushPromises();
      expect(wrapper.find('.report-overlay').exists()).toBe(false);
      expect(wrapper.find('#acp-root').exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it('opens the named reply action control by keyboard without closing the replies', async () => {
    const wrapper = await mountReplies();
    try {
      const control = wrapper.get('[aria-label="管理 回复作者 的回复"]');
      await control.trigger('keydown', { key: 'Enter' });
      expect(wrapper.find('.action-menu-overlay').exists()).toBe(true);
      expect(wrapper.find('#acp-root').exists()).toBe(true);
      expect(wrapper.find('.menu-delete').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it('keeps delete available only for the current user’s own replies', async () => {
    useUserStore().userInfo = {
      ...viewer,
      id: 'author',
      openId: 'mock_author',
      nickname: '回复作者',
    };
    const wrapper = await mountReplies();
    try {
      await wrapper.get('.comment-more').trigger('tap');
      expect(wrapper.find('.menu-delete').exists()).toBe(true);
      expect(reportComment).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });

  it('opens review actions by keyboard without opening the replies', async () => {
    const review: Review = {
      id: 'review',
      dishId: 'dish',
      userId: 'author',
      userNickname: '评价作者',
      userAvatar: '',
      content: '口味不错。',
      rating: 4,
      images: [],
      status: 'approved',
      createdAt: '2026-10-08T08:00:00.000Z',
    };
    const wrapper = mount(ReviewList, {
      props: {
        dishId: 'dish',
        reviews: [review],
        loading: false,
        initialized: true,
        error: '',
        hasMore: false,
        reviewComments: {},
        fetchComments: async () => undefined,
      },
    });
    try {
      await wrapper.get('[aria-label="管理 评价作者 的评价"]').trigger('keydown', { key: ' ' });
      expect(wrapper.find('.action-menu-overlay').exists()).toBe(true);
      expect(wrapper.emitted('viewAllComments')).toBeUndefined();
    } finally {
      wrapper.unmount();
    }
  });

  it('expands taste details for only the selected review without opening replies', async () => {
    const review: Review = {
      id: 'review',
      dishId: 'dish',
      userId: 'author',
      userNickname: '评价作者',
      userAvatar: '',
      content: '口味不错。',
      rating: 4,
      images: [],
      status: 'approved',
      createdAt: '2026-10-08T08:00:00.000Z',
      ratingDetails: { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 },
    };
    const wrapper = mount(ReviewList, {
      props: {
        dishId: 'dish',
        reviews: [
          review,
          { ...review, id: 'second-review' },
          { ...review, id: 'no-details', ratingDetails: undefined },
        ],
        loading: false,
        initialized: true,
        error: '',
        hasMore: false,
        reviewComments: {},
        fetchComments: async () => undefined,
      },
    });
    try {
      const rows = wrapper.findAll('.review-item');
      expect(rows[0].get('.taste-grid').isVisible()).toBe(false);
      expect(rows[1].get('.taste-grid').isVisible()).toBe(false);
      expect(rows[0].get('.review-text').text()).toBe('口味不错。');
      expect(rows[0].findAll('.star-icon')).toHaveLength(5);
      expect(rows[0].getComponent(TasteProfile).get('.star-icon').isVisible()).toBe(true);
      expect(rows[2].findAll('.star-icon')).toHaveLength(5);
      expect(rows[2].find('.taste-toggle').exists()).toBe(false);
      expect(rows[2].find('.taste-grid').exists()).toBe(false);
      const firstToggle = rows[0].get('.taste-toggle');
      const secondToggle = rows[1].get('.taste-toggle');
      expect(firstToggle.attributes('aria-controls')).not.toBe(
        secondToggle.attributes('aria-controls')
      );
      await firstToggle.trigger('tap');
      expect(rows[0].get('.taste-grid').isVisible()).toBe(true);
      expect(rows[1].get('.taste-grid').isVisible()).toBe(false);
      expect(wrapper.emitted('viewAllComments')).toBeUndefined();
      expect(wrapper.find('.action-menu-overlay').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
});
