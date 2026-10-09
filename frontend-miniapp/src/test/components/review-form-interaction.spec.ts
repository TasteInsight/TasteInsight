import { shallowMount, flushPromises } from '@vue/test-utils';
import ReviewForm from '@/pages/dish/components/ReviewForm.vue';
import ReportDialog from '@/pages/dish/components/ReportDialog.vue';
import AllCommentsPanel from '@/pages/dish/components/AllCommentsPanel.vue';
jest.mock('@/store/modules/use-user-store', () => ({
  useUserStore: () => ({ sessionVersion: 0, isLoggedIn: true, userInfo: { id: 'A' } }),
}));
jest.mock('@/api/modules/comment', () => ({
  getCommentsByReview: jest.fn().mockResolvedValue({ code: 200, data: { items: [] } }),
}));
const review = {
  id: 'r',
  userId: 'A',
  rating: 4,
  content: 'Original',
  images: [],
  status: 'pending',
} as any;
beforeEach(() => {
  jest.clearAllMocks();
});

it('closes unchanged editing without a modal and retains cancelled edits', async () => {
  const wrapper = shallowMount(ReviewForm, {
    props: { dishId: 'dish', dishName: 'Dish', initialReview: review, existingReviewId: 'r' },
  });
  expect(wrapper.get('.sheet-footer button').attributes('disabled')).toBeDefined();
  await (wrapper.vm as any).requestClose();
  expect(uni.showModal).not.toHaveBeenCalled();
  expect(wrapper.emitted('close')).toHaveLength(1);
  (wrapper.vm as any).content = 'Changed';
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => success({ confirm: false }));
  expect(await (wrapper.vm as any).requestClose()).toBe(false);
  expect((wrapper.vm as any).content).toBe('Changed');
  expect(wrapper.emitted('close')).toHaveLength(1);
  wrapper.unmount();
});

it('uses stable five-target overall stars and four independent five-target strength rows', async () => {
  const wrapper = shallowMount(ReviewForm, { props: { dishId: 'dish', dishName: 'Dish' } });
  await wrapper.get('[aria-label="总体评分 4 星"]').trigger('tap');
  expect(wrapper.findAll('.rating-option')).toHaveLength(5);
  expect(wrapper.findAll('.flavor-option')).toHaveLength(20);
  expect(wrapper.get('.flavor-options').text()).not.toContain('★');
  expect(wrapper.text()).toContain('四项全部填写或全部留空');
  expect(wrapper.find('.sheet-header').exists()).toBe(true);
  expect(wrapper.find('.sheet-footer').exists()).toBe(true);
  wrapper.unmount();
});

it.each([
  ['review', ReviewForm, 'review-content', 'review-content-field'],
  ['report', ReportDialog, 'report-reason', 'report-reason-field'],
] as const)(
  'keeps the complete focused %s field targeted after the keyboard resizes its scroll body',
  async (kind, component, inputId, fieldId) => {
    const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const listeners: Record<string, () => void> = {};
    const viewport = {
      height: window.innerHeight,
      offsetTop: 0,
      addEventListener: jest.fn((event: string, listener: () => void) => {
        listeners[event] = listener;
      }),
      removeEventListener: jest.fn(),
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    const wrapper = shallowMount(component as any, {
      props: kind === 'review' ? { dishId: 'dish', dishName: 'Dish' } : {},
    });
    try {
      if (kind === 'review') {
        await wrapper.get('[aria-label="总体评分 4 星"]').trigger('tap');
        expect(wrapper.findAll('.flavor-row')).toHaveLength(4);
      }
      await wrapper.get('#' + inputId).trigger('focus');
      viewport.height = window.innerHeight - 280;
      listeners.resize();
      await flushPromises();
      expect(wrapper.get('.sheet-body').attributes('scroll-into-view')).toBe(fieldId);
      expect(wrapper.find('#' + fieldId).exists()).toBe(true);
      expect(
        wrapper
          .get('#' + fieldId)
          .find('#' + inputId)
          .exists()
      ).toBe(true);
      await wrapper.get('#' + inputId).trigger('blur');
      viewport.height = window.innerHeight;
      listeners.resize();
      await flushPromises();
      expect(wrapper.get('.sheet-body').attributes('scroll-into-view')).toBe('');
    } finally {
      wrapper.unmount();
      if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
      else delete (window as any).visualViewport;
    }
  }
);

it('retains report content when closing is cancelled', async () => {
  const wrapper = shallowMount(ReportDialog);
  (wrapper.vm as any).reason = 'Reason';
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => success({ confirm: false }));
  expect(await (wrapper.vm as any).requestClose()).toBe(false);
  expect(wrapper.emitted('close')).toBeUndefined();
  expect((wrapper.vm as any).reason).toBe('Reason');
  wrapper.unmount();
});

it('offers explicit discard after local draft persistence fails without uploading photos', async () => {
  const wrapper = shallowMount(ReviewForm, { props: { dishId: 'dish', dishName: 'Dish' } });
  (wrapper.vm as any).addImages(['/temporary/photo.jpg']);
  expect(await (wrapper.vm as any).requestClose()).toBe(false);
  expect(wrapper.emitted('close')).toBeUndefined();
  await wrapper.vm.$nextTick();
  expect(wrapper.get('.draft-discard').text()).toBe('放弃草稿并关闭');
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => success({ confirm: true }));
  await wrapper.get('.draft-discard').trigger('tap');
  await flushPromises();
  expect(wrapper.emitted('close')).toHaveLength(1);
  wrapper.unmount();
});

it('renders replies inside a fixed cross-platform sheet and protects the reply draft', async () => {
  const wrapper = shallowMount(AllCommentsPanel, {
    props: { reviewId: 'review', isVisible: true },
  });
  await flushPromises();
  expect(wrapper.find('.review-overlay #acp-root').exists()).toBe(true);
  (wrapper.vm as any).replyContent = 'Draft';
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => success({ confirm: false }));
  expect(await (wrapper.vm as any).requestClose()).toBe(false);
  expect((wrapper.vm as any).replyContent).toBe('Draft');
  expect(wrapper.emitted('close')).toBeUndefined();
  wrapper.unmount();
});
