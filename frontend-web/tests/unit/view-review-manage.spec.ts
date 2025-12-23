import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  authStoreMock: {
    hasPermission: vi.fn((p: string) => ['review:approve', 'comment:approve'].includes(p)),
  },
  reviewApiMock: {
    getPendingReviews: vi.fn(),
    getPendingComments: vi.fn(),
    approveReview: vi.fn(),
    rejectReview: vi.fn(),
    approveComment: vi.fn(),
    rejectComment: vi.fn(),
  },
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/api/modules/review', () => ({
  reviewApi: mocks.reviewApiMock,
}))

import ReviewManage from '@/views/ReviewManage.vue'

function flushMicrotasks() {
  return Promise.resolve()
}

async function flushAll() {
  await flushMicrotasks()
  await nextTick()
  await flushMicrotasks()
  await nextTick()
}

describe('views/ReviewManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.reviewApiMock.getPendingReviews.mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            id: 'rv1',
            dishName: 'D1',
            dishImage: 'img',
            userNickname: 'u1',
            userAvatar: '',
            rating: 5,
            content: 'nice',
            createdAt: '2025-01-01T10:00:00',
            status: 'pending',
            images: ['a', 'b'],
            ratingDetails: { spicyLevel: 1, sweetness: null, saltiness: 2, oiliness: undefined },
          },
        ],
        meta: { total: 1 },
      },
    })

    mocks.reviewApiMock.getPendingComments.mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            id: 'cm1',
            dishName: 'D1',
            userNickname: 'u2',
            userAvatar: '',
            content: 'c',
            reviewContent: 'r',
            createdAt: '2025-01-02T10:00:00',
            status: 'pending',
          },
        ],
        meta: { total: 1 },
      },
    })

    mocks.reviewApiMock.approveReview.mockResolvedValue({ code: 200 })
    mocks.reviewApiMock.rejectReview.mockResolvedValue({ code: 200 })
    mocks.reviewApiMock.approveComment.mockResolvedValue({ code: 200 })
    mocks.reviewApiMock.rejectComment.mockResolvedValue({ code: 200 })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'addEventListener')
    vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.addEventListener as any).mockRestore?.()
    ;(window.removeEventListener as any).mockRestore?.()
  })

  it('loads pending reviews on mount; handles non-200 and thrown errors', async () => {
    // non-200
    mocks.reviewApiMock.getPendingReviews.mockResolvedValueOnce({ code: 500, message: 'bad' })

    const wrapper = shallowMount(ReviewManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    expect(mocks.reviewApiMock.getPendingReviews).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    expect(wrapper.vm.reviews).toEqual([])
    expect(wrapper.vm.totalReviews).toBe(0)

    // thrown
    mocks.reviewApiMock.getPendingReviews.mockRejectedValueOnce(new Error('boom'))
    wrapper.vm.handlePageChangeReviews(2)
    await flushAll()

    expect(window.alert).toHaveBeenCalledWith('加载评价列表失败，请刷新重试')
    expect(wrapper.vm.reviews).toEqual([])

    wrapper.unmount()
    expect(window.removeEventListener).toHaveBeenCalled()
  })

  it('switchTab loads reviews or comments and pagination triggers correct loaders', async () => {
    const wrapper = shallowMount(ReviewManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    wrapper.vm.switchTab('comments')
    await flushAll()
    expect(wrapper.vm.activeTab).toBe('comments')
    expect(mocks.reviewApiMock.getPendingComments).toHaveBeenCalledWith({ page: 1, pageSize: 20 })

    wrapper.vm.handlePageChangeComments(3)
    await flushAll()
    expect(wrapper.vm.currentPageComments).toBe(3)
    expect(mocks.reviewApiMock.getPendingComments).toHaveBeenLastCalledWith({ page: 3, pageSize: 20 })

    wrapper.vm.switchTab('reviews')
    await flushAll()
    expect(wrapper.vm.activeTab).toBe('reviews')

    wrapper.unmount()
  })

  it('open/close detail dialogs and reject modals reset reasons', async () => {
    const wrapper = shallowMount(ReviewManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    const review = wrapper.vm.reviews[0]
    wrapper.vm.openReviewDetail(review)
    expect(wrapper.vm.selectedReview?.id).toBe('rv1')

    wrapper.vm.rejectReviewReason = 'x'
    wrapper.vm.openRejectReviewModal()
    expect(wrapper.vm.isRejectReviewModalOpen).toBe(true)
    expect(wrapper.vm.rejectReviewReason).toBe('')

    wrapper.vm.rejectReviewReason = 'y'
    wrapper.vm.closeRejectReviewModal()
    expect(wrapper.vm.isRejectReviewModalOpen).toBe(false)
    expect(wrapper.vm.rejectReviewReason).toBe('')

    wrapper.vm.closeReviewDetail()
    expect(wrapper.vm.selectedReview).toBe(null)

    const comment = {
      id: 'cm1',
      dishName: 'D1',
      userNickname: 'u2',
      content: 'c',
      reviewContent: 'r',
      createdAt: '2025-01-02T10:00:00',
      status: 'pending',
    }
    wrapper.vm.openCommentDetail(comment)
    expect(wrapper.vm.selectedComment?.id).toBe('cm1')

    wrapper.vm.rejectCommentReason = 'z'
    wrapper.vm.openRejectCommentModal()
    expect(wrapper.vm.isRejectCommentModalOpen).toBe(true)
    expect(wrapper.vm.rejectCommentReason).toBe('')

    wrapper.vm.rejectCommentReason = 't'
    wrapper.vm.closeRejectCommentModal()
    expect(wrapper.vm.isRejectCommentModalOpen).toBe(false)
    expect(wrapper.vm.rejectCommentReason).toBe('')

    wrapper.vm.closeCommentDetail()
    expect(wrapper.vm.selectedComment).toBe(null)

    wrapper.unmount()
  })

  it('approve/reject review covers permission, missing reason, success, non-200, catch', async () => {
    const wrapper = shallowMount(ReviewManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    // no permission
    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleApproveReview()
    expect(window.alert).toHaveBeenCalledWith('您没有权限审核评价')

    // missing selectedReview => no-op
    await wrapper.vm.handleApproveReview()

    wrapper.vm.openReviewDetail(wrapper.vm.reviews[0])

    // approve non-200
    mocks.reviewApiMock.approveReview.mockResolvedValueOnce({ code: 400, message: 'bad' })
    await wrapper.vm.handleApproveReview()
    expect(window.alert).toHaveBeenCalledWith('bad')

    // approve catch
    mocks.reviewApiMock.approveReview.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleApproveReview()
    expect(window.alert).toHaveBeenCalledWith('审核评价失败，请重试')

    // approve success reload + close detail
    mocks.reviewApiMock.approveReview.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.handleApproveReview()
    expect(window.alert).toHaveBeenCalledWith('审核通过')
    expect(wrapper.vm.selectedReview).toBe(null)

    // reject: no permission
    wrapper.vm.openReviewDetail(wrapper.vm.reviews[0])
    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleRejectReview()
    expect(window.alert).toHaveBeenCalledWith('您没有权限审核评价')

    // reject: missing reason
    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    wrapper.vm.rejectReviewReason = ''
    await wrapper.vm.handleRejectReview()
    expect(window.alert).toHaveBeenCalledWith('请填写拒绝原因')

    // reject: non-200
    wrapper.vm.rejectReviewReason = 'no'
    mocks.reviewApiMock.rejectReview.mockResolvedValueOnce({ code: 400, message: 'nope' })
    await wrapper.vm.handleRejectReview()
    expect(window.alert).toHaveBeenCalledWith('nope')

    // reject: catch
    mocks.reviewApiMock.rejectReview.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleRejectReview()
    expect(window.alert).toHaveBeenCalledWith('拒绝评价失败，请重试')

    // reject: success closes modal + detail and reloads
    wrapper.vm.openRejectReviewModal()
    wrapper.vm.rejectReviewReason = 'reason'
    mocks.reviewApiMock.rejectReview.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.handleRejectReview()
    expect(window.alert).toHaveBeenCalledWith('已拒绝')
    expect(wrapper.vm.isRejectReviewModalOpen).toBe(false)
    expect(wrapper.vm.selectedReview).toBe(null)

    wrapper.unmount()
  })

  it('approve/reject comment covers permission, missing reason, success, non-200, catch', async () => {
    const wrapper = shallowMount(ReviewManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    wrapper.vm.switchTab('comments')
    await flushAll()

    const comment = wrapper.vm.comments[0]

    // no permission
    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    await wrapper.vm.handleApproveComment()
    expect(window.alert).toHaveBeenCalledWith('您没有权限审核评论')

    // no selectedComment => no-op
    await wrapper.vm.handleApproveComment()

    wrapper.vm.openCommentDetail(comment)

    // approve non-200
    mocks.reviewApiMock.approveComment.mockResolvedValueOnce({ code: 400, message: 'bad' })
    await wrapper.vm.handleApproveComment()
    expect(window.alert).toHaveBeenCalledWith('bad')

    // approve catch
    mocks.reviewApiMock.approveComment.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleApproveComment()
    expect(window.alert).toHaveBeenCalledWith('审核评论失败，请重试')

    // approve success
    mocks.reviewApiMock.approveComment.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.handleApproveComment()
    expect(window.alert).toHaveBeenCalledWith('审核通过')
    expect(wrapper.vm.selectedComment).toBe(null)

    // reject: no permission
    wrapper.vm.openCommentDetail(comment)
    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    await wrapper.vm.handleRejectComment()
    expect(window.alert).toHaveBeenCalledWith('您没有权限审核评论')

    // reject: missing reason
    mocks.authStoreMock.hasPermission.mockImplementation(() => true)
    wrapper.vm.rejectCommentReason = ''
    await wrapper.vm.handleRejectComment()
    expect(window.alert).toHaveBeenCalledWith('请填写拒绝原因')

    // reject: non-200
    wrapper.vm.rejectCommentReason = 'no'
    mocks.reviewApiMock.rejectComment.mockResolvedValueOnce({ code: 400, message: 'nope' })
    await wrapper.vm.handleRejectComment()
    expect(window.alert).toHaveBeenCalledWith('nope')

    // reject: catch
    mocks.reviewApiMock.rejectComment.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleRejectComment()
    expect(window.alert).toHaveBeenCalledWith('拒绝评论失败，请重试')

    // reject: success closes modal + detail
    wrapper.vm.openRejectCommentModal()
    wrapper.vm.rejectCommentReason = 'reason'
    mocks.reviewApiMock.rejectComment.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.handleRejectComment()
    expect(window.alert).toHaveBeenCalledWith('已拒绝')
    expect(wrapper.vm.isRejectCommentModalOpen).toBe(false)
    expect(wrapper.vm.selectedComment).toBe(null)

    wrapper.unmount()
  })

  it('comments loader handles non-200 and thrown errors', async () => {
    const wrapper = shallowMount(ReviewManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    // non-200
    mocks.reviewApiMock.getPendingComments.mockResolvedValueOnce({ code: 500 })
    wrapper.vm.switchTab('comments')
    await flushAll()
    expect(wrapper.vm.comments).toEqual([])
    expect(wrapper.vm.totalComments).toBe(0)

    // thrown
    mocks.reviewApiMock.getPendingComments.mockRejectedValueOnce(new Error('boom'))
    wrapper.vm.handlePageChangeComments(2)
    await flushAll()
    expect(window.alert).toHaveBeenCalledWith('加载评论列表失败，请刷新重试')

    wrapper.unmount()
  })

  it('image preview open/close, navigation, and keyboard shortcuts', async () => {
    const wrapper = shallowMount(ReviewManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    wrapper.vm.openImagePreview(['a', 'b', 'c'], 1)
    expect(wrapper.vm.imagePreview.show).toBe(true)
    expect(wrapper.vm.imagePreview.currentIndex).toBe(1)

    wrapper.vm.previousImage()
    expect(wrapper.vm.imagePreview.currentIndex).toBe(0)

    wrapper.vm.previousImage()
    expect(wrapper.vm.imagePreview.currentIndex).toBe(0)

    wrapper.vm.nextImage()
    wrapper.vm.nextImage()
    expect(wrapper.vm.imagePreview.currentIndex).toBe(2)

    wrapper.vm.nextImage()
    expect(wrapper.vm.imagePreview.currentIndex).toBe(2)

    // keyboard
    wrapper.vm.openImagePreview(['a', 'b'], 0)

    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })
    window.dispatchEvent(right)
    await nextTick()
    expect(right.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.currentIndex).toBe(1)

    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true })
    window.dispatchEvent(left)
    await nextTick()
    expect(left.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.currentIndex).toBe(0)

    const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    window.dispatchEvent(esc)
    await nextTick()
    expect(esc.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.show).toBe(false)

    wrapper.unmount()
  })
})
