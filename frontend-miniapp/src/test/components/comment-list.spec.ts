import { mount } from '@vue/test-utils';
import CommentList from '@/pages/dish/components/CommentList.vue';
import type { Comment } from '@/types/api';

const makeComment = (id: string, overrides: Partial<Comment> = {}): Comment => ({
  id,
  reviewId: 'review',
  userId: id,
  userNickname: `同学${id}`,
  userAvatar: '',
  floor: 1,
  content: `回复${id}`,
  status: 'approved',
  createdAt: '2026-10-04T10:00:00Z',
  ...overrides,
});

describe('CommentList', () => {
  it('renders own private replies without moderation labels', () => {
    const wrapper = mount(CommentList, {
      props: {
        reviewId: 'review',
        fetchComments: jest.fn().mockResolvedValue(undefined),
        commentsData: {
          items: [
            makeComment('1', { status: 'pending' }),
            makeComment('2', { status: 'rejected' }),
          ],
          total: 2,
          loading: false,
        },
      },
    });
    expect(wrapper.text()).toContain('回复1');
    expect(wrapper.text()).toContain('回复2');
    expect(wrapper.text()).not.toMatch(/待审核|仅你可见|未通过/);
    wrapper.unmount();
  });
  it('fetches the current review preview on mount and when the review changes', async () => {
    const fetchComments = jest.fn().mockResolvedValue(undefined);
    const wrapper = mount(CommentList, {
      props: { reviewId: 'first', fetchComments },
    });

    expect(fetchComments).toHaveBeenCalledWith('first');
    await wrapper.setProps({ reviewId: 'second' });
    expect(fetchComments.mock.calls).toEqual([['first'], ['second']]);
    wrapper.unmount();
  });

  it('shows four preview replies and the server total', () => {
    const wrapper = mount(CommentList, {
      props: {
        reviewId: 'review',
        fetchComments: jest.fn().mockResolvedValue(undefined),
        commentsData: {
          items: Array.from({ length: 5 }, (_, index) => makeComment(String(index + 1))),
          total: 23,
          loading: false,
        },
      },
    });

    expect(wrapper.text()).toContain('回复4');
    expect(wrapper.text()).not.toContain('回复5');
    expect(wrapper.get('button').text()).toContain('23');
    wrapper.unmount();
  });

  it('retains nested reply attribution and hides the deleted parent name', () => {
    const wrapper = mount(CommentList, {
      props: {
        reviewId: 'review',
        fetchComments: jest.fn().mockResolvedValue(undefined),
        commentsData: {
          items: [
            makeComment('1', {
              parentComment: { id: 'parent', userNickname: '很长的回复对象名称', deleted: false },
            }),
            makeComment('2', {
              parentComment: { id: 'deleted', userNickname: '已删除的名称', deleted: true },
            }),
          ],
          total: 2,
          loading: false,
        },
      },
    });

    expect(wrapper.text()).toContain('@很长的回复对象名称');
    expect(wrapper.text()).toContain('回复的评论已删除');
    expect(wrapper.text()).not.toContain('已删除的名称');
    wrapper.unmount();
  });

  it('opens all replies once without bubbling to the surrounding review', async () => {
    const wrapper = mount(CommentList, {
      props: {
        reviewId: 'review',
        fetchComments: jest.fn().mockResolvedValue(undefined),
        commentsData: { items: [makeComment('1')], total: 1, loading: false },
      },
    });
    const parentTap = jest.fn();
    wrapper.element.addEventListener('tap', parentTap);

    await wrapper.get('button').trigger('tap');
    expect(wrapper.emitted('viewAllComments')).toEqual([[]]);
    expect(parentTap).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
