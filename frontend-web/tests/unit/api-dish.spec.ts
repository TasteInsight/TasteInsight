import { describe, expect, it, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const postMock = vi.fn()
const putMock = vi.fn()
const deleteMock = vi.fn()
const patchMock = vi.fn()

vi.mock('@/utils/request', () => {
  return {
    default: {
      get: getMock,
      post: postMock,
      put: putMock,
      delete: deleteMock,
      patch: patchMock,
    },
  }
})

describe('api/dishApi', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    deleteMock.mockReset()
    patchMock.mockReset()
  })

  it('getDishById uses direct endpoint when available', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: { id: '1', name: 'X' } })

    const { dishApi } = await import('@/api/modules/dish')
    const res = await dishApi.getDishById('1')

    expect(getMock).toHaveBeenCalledWith('/admin/dishes/1')
    expect(res.data.id).toBe('1')
  })

  it.each(['菜品不存在', '无权限访问该资源', '登录会话已变更，请重试'])(
    'getDishById preserves detail failure %s without another request', async (message) => {
      const error = new Error(message)
      getMock.mockRejectedValueOnce(error)
      const { dishApi } = await import('@/api/modules/dish')

      await expect(dishApi.getDishById('missing')).rejects.toBe(error)
      expect(getMock).toHaveBeenCalledTimes(1)
      expect(getMock).toHaveBeenCalledWith('/admin/dishes/missing')
    },
  )

  it('getDishById returns the detail response unchanged for caller validation', async () => {
    const response = { code: 500, data: null, message: '详情读取失败' }
    getMock.mockResolvedValueOnce(response)
    const { dishApi } = await import('@/api/modules/dish')

    await expect(dishApi.getDishById('d1')).resolves.toBe(response)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('getDishes calls GET /admin/dishes with params', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { dishApi } = await import('@/api/modules/dish')
    await dishApi.getDishes({ page: 2 } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/dishes', { params: { page: 2 } })
  })

  it('create/update/delete dish call correct endpoints', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })
    putMock.mockResolvedValueOnce({ code: 200 })
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { dishApi } = await import('@/api/modules/dish')

    await dishApi.createDish({ name: 'N' } as any)
    expect(postMock).toHaveBeenCalledWith('/admin/dishes', { name: 'N' })

    await dishApi.updateDish('d1', { name: 'N2' } as any)
    expect(putMock).toHaveBeenCalledWith('/admin/dishes/d1', { name: 'N2' })

    await dishApi.deleteDish('d2')
    expect(deleteMock).toHaveBeenCalledWith('/admin/dishes/d2')
  })

  it('updateDishStatus patches status payload', async () => {
    patchMock.mockResolvedValueOnce({ code: 200 })

    const { dishApi } = await import('@/api/modules/dish')
    await dishApi.updateDishStatus('d1', 'online')

    expect(patchMock).toHaveBeenCalledWith('/admin/dishes/d1/status', { status: 'online' })
  })

  it('uploadImage posts multipart form-data to /upload/image', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const file = new File(['img'], 'a.png', { type: 'image/png' })
    const { dishApi } = await import('@/api/modules/dish')
    await dishApi.uploadImage(file)

    expect(postMock).toHaveBeenCalledWith(
      '/upload/image',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  })

  it('getDishReviews calls GET /admin/dishes/:id/reviews with params', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { dishApi } = await import('@/api/modules/dish')
    await dishApi.getDishReviews('d1', { page: 1 } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/dishes/d1/reviews', { params: { page: 1 } })
  })

  it('batch import helpers call parse/confirm endpoints', async () => {
    postMock.mockResolvedValue({ code: 200 })

    const file = new File(['x'], 'dishes.xlsx')
    const { dishApi } = await import('@/api/modules/dish')

    await dishApi.parseBatchExcel(file)
    expect(postMock).toHaveBeenCalledWith(
      '/admin/dishes/batch/parse',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )

    await dishApi.confirmBatchImport({ items: [] } as any)
    expect(postMock).toHaveBeenCalledWith('/admin/dishes/batch/confirm', { items: [] })
  })

  it('refreshDishEmbedding calls POST /admin/dishes/:id/embedding/refresh', async () => {
    postMock.mockResolvedValueOnce({ code: 200, data: { jobId: 'job1' } })

    const { dishApi } = await import('@/api/modules/dish')
    const res = await dishApi.refreshDishEmbedding('d1')

    expect(postMock).toHaveBeenCalledWith('/admin/dishes/d1/embedding/refresh')
    expect(res.data.jobId).toBe('job1')
  })

  it('refreshDishesEmbeddingByCanteen calls POST with canteenId query', async () => {
    postMock.mockResolvedValueOnce({ code: 200, data: { jobId: 'job2' } })

    const { dishApi } = await import('@/api/modules/dish')
    await dishApi.refreshDishesEmbeddingByCanteen('c1')

    expect(postMock).toHaveBeenCalledWith('/admin/dishes/embedding/refresh?canteenId=c1')
  })

  it('getEmbeddingJobStatus calls GET with cache-control headers', async () => {
    getMock.mockResolvedValueOnce({
      code: 200,
      data: { jobId: 'job1', status: 'processing', progress: 50 },
    })

    const { dishApi } = await import('@/api/modules/dish')
    await dishApi.getEmbeddingJobStatus('job1')

    expect(getMock).toHaveBeenCalledWith(
      '/admin/dishes/embedding/job/job1',
      expect.objectContaining({
        params: { _t: expect.any(Number) },
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      }),
    )
  })

  it('cancelEmbeddingJob calls DELETE /admin/dishes/embedding/job/:jobId', async () => {
    deleteMock.mockResolvedValueOnce({ code: 200, data: { success: true } })

    const { dishApi } = await import('@/api/modules/dish')
    await dishApi.cancelEmbeddingJob('job1')

    expect(deleteMock).toHaveBeenCalledWith('/admin/dishes/embedding/job/job1')
  })
})
