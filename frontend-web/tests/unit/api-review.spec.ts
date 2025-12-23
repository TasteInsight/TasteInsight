import { describe, expect, it, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const postMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/utils/request', () => {
  return {
    default: {
      get: getMock,
      post: postMock,
      delete: deleteMock,
    },
  }
})

describe('api/reviewApi', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    deleteMock.mockReset()
  })

  it('getPendingReviews uses default pagination', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.getPendingReviews()

    expect(getMock).toHaveBeenCalledWith('/admin/reviews/pending', { params: { page: 1, pageSize: 20 } })
  })

  it('rejectReview posts reason payload', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.rejectReview('r1', 'bad')

    expect(postMock).toHaveBeenCalledWith('/admin/reviews/r1/reject', { reason: 'bad' })
  })

  it('approveReview posts to approve endpoint', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.approveReview('r1')

    expect(postMock).toHaveBeenCalledWith('/admin/reviews/r1/approve')
  })

  it('deleteReview deletes by id', async () => {
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.deleteReview('r1')

    expect(deleteMock).toHaveBeenCalledWith('/admin/reviews/r1')
  })

  it('getPendingComments uses default pagination', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.getPendingComments()

    expect(getMock).toHaveBeenCalledWith('/admin/comments/pending', { params: { page: 1, pageSize: 20 } })
  })

  it('approveComment posts to approve endpoint', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.approveComment('c1')

    expect(postMock).toHaveBeenCalledWith('/admin/comments/c1/approve')
  })

  it('rejectComment posts reason payload', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.rejectComment('c1', 'spam')

    expect(postMock).toHaveBeenCalledWith('/admin/comments/c1/reject', { reason: 'spam' })
  })

  it('getReports passes params to GET /admin/reports', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.getReports({ page: 2, status: 'pending' } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/reports', { params: { page: 2, status: 'pending' } })
  })

  it('handleReport posts to handle endpoint with data', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.handleReport('rp1', { action: 'warn_user', result: 'ok' })

    expect(postMock).toHaveBeenCalledWith('/admin/reports/rp1/handle', { action: 'warn_user', result: 'ok' })
  })

  it('upload review flows: list/detail/approve/reject/revoke', async () => {
    getMock.mockResolvedValue({ code: 200 })
    postMock.mockResolvedValue({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')

    await reviewApi.getPendingUploads({ page: 1, status: 'pending' } as any)
    expect(getMock).toHaveBeenCalledWith('/admin/dishes/uploads', { params: { page: 1, status: 'pending' } })

    await reviewApi.getPendingUploadById('u1')
    expect(getMock).toHaveBeenCalledWith('/admin/dishes/uploads/u1')

    await reviewApi.approveUpload('u1')
    expect(postMock).toHaveBeenCalledWith('/admin/dishes/uploads/u1/approve')

    await reviewApi.rejectUpload('u2', 'bad')
    expect(postMock).toHaveBeenCalledWith('/admin/dishes/uploads/u2/reject', { reason: 'bad' })

    await reviewApi.revokeUpload('u3')
    expect(postMock).toHaveBeenCalledWith('/admin/dishes/uploads/u3/revoke')
  })

  it('getReviewComments uses default pagination', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.getReviewComments('r1')

    expect(getMock).toHaveBeenCalledWith('/admin/reviews/r1/comments', { params: { page: 1, pageSize: 20 } })
  })

  it('deleteComment deletes by id', async () => {
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { reviewApi } = await import('@/api/modules/review')
    await reviewApi.deleteComment('c1')

    expect(deleteMock).toHaveBeenCalledWith('/admin/comments/c1')
  })
})
