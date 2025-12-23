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
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('getDishById uses direct endpoint when available', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: { id: '1', name: 'X' } })

    const { dishApi } = await import('@/api/modules/dish')
    const res = await dishApi.getDishById('1')

    expect(getMock).toHaveBeenCalledWith('/admin/dishes/1')
    expect(res.data.id).toBe('1')
  })

  it('getDishById falls back to list endpoint', async () => {
    getMock
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [{ id: '2', name: 'Y' }], total: 1, page: 1, pageSize: 100 },
      })

    const { dishApi } = await import('@/api/modules/dish')
    const res = await dishApi.getDishById('2')

    expect(getMock).toHaveBeenCalledWith('/admin/dishes/2')
    expect(console.log).toHaveBeenCalledWith('直接获取失败，尝试通过列表接口获取:', expect.any(Error))
    expect(getMock).toHaveBeenCalledWith('/admin/dishes', { params: { pageSize: 100 } })
    expect(res.data.id).toBe('2')
  })

  it('getDishById falls back to list when direct response is not usable', async () => {
    getMock
      .mockResolvedValueOnce({ code: 500, data: null })
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [{ id: '9', name: 'Z' }], total: 1, page: 1, pageSize: 100 },
      })

    const { dishApi } = await import('@/api/modules/dish')
    const res = await dishApi.getDishById('9')

    expect(getMock).toHaveBeenCalledWith('/admin/dishes/9')
    expect(getMock).toHaveBeenCalledWith('/admin/dishes', { params: { pageSize: 100 } })
    expect(res.data.id).toBe('9')
  })

  it('getDishById falls back when direct response has code 200 but no data', async () => {
    getMock
      .mockResolvedValueOnce({ code: 200, data: null })
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [{ id: '10', name: 'Q' }], total: 1, page: 1, pageSize: 100 },
      })

    const { dishApi } = await import('@/api/modules/dish')
    const res = await dishApi.getDishById('10')

    expect(getMock).toHaveBeenCalledWith('/admin/dishes/10')
    expect(getMock).toHaveBeenCalledWith('/admin/dishes', { params: { pageSize: 100 } })
    expect(res.data.id).toBe('10')
  })

  it('getDishById rejects when not found in list', async () => {
    getMock
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({
        code: 200,
        data: { items: [{ id: '3' }], total: 1, page: 1, pageSize: 100 },
      })

    const { dishApi } = await import('@/api/modules/dish')
    await expect(dishApi.getDishById('missing')).rejects.toThrow('未找到该菜品')
  })

  it('getDishById rejects when list endpoint returns no usable data', async () => {
    getMock
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({ code: 500, data: null })

    const { dishApi } = await import('@/api/modules/dish')
    await expect(dishApi.getDishById('any')).rejects.toThrow('未找到该菜品')
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

  it('batchUpload posts multipart form-data', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const file = new File(['x'], 'dishes.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const { dishApi } = await import('@/api/modules/dish')
    await dishApi.batchUpload(file)

    expect(postMock).toHaveBeenCalledWith(
      '/admin/dishes/batch',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
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
})
