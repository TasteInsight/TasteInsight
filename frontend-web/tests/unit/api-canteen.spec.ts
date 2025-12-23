import { describe, expect, it, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const postMock = vi.fn()
const putMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/utils/request', () => {
  return {
    default: {
      get: getMock,
      post: postMock,
      put: putMock,
      delete: deleteMock,
    },
  }
})

describe('api/canteenApi', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    deleteMock.mockReset()
  })

  it('getWindows calls GET with canteenId in path', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { canteenApi } = await import('@/api/modules/canteen')
    await canteenApi.getWindows('c1', { page: 2 } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/windows/c1', { params: { page: 2 } })
  })

  it('deleteCanteen deletes by id', async () => {
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { canteenApi } = await import('@/api/modules/canteen')
    await canteenApi.deleteCanteen('c1')

    expect(deleteMock).toHaveBeenCalledWith('/admin/canteens/c1')
  })

  it('getCanteens calls GET /admin/canteens with params', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { canteenApi } = await import('@/api/modules/canteen')
    await canteenApi.getCanteens({ page: 1, pageSize: 20 } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/canteens', { params: { page: 1, pageSize: 20 } })
  })

  it('create/update canteen call correct endpoints', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })
    putMock.mockResolvedValueOnce({ code: 200 })

    const { canteenApi } = await import('@/api/modules/canteen')

    await canteenApi.createCanteen({ name: 'C' } as any)
    expect(postMock).toHaveBeenCalledWith('/admin/canteens', { name: 'C' })

    await canteenApi.updateCanteen('c1', { name: 'C2' } as any)
    expect(putMock).toHaveBeenCalledWith('/admin/canteens/c1', { name: 'C2' })
  })

  it('create/update/delete window call correct endpoints', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })
    putMock.mockResolvedValueOnce({ code: 200 })
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { canteenApi } = await import('@/api/modules/canteen')

    await canteenApi.createWindow({ name: 'W', canteenId: 'c1' } as any)
    expect(postMock).toHaveBeenCalledWith('/admin/windows', { name: 'W', canteenId: 'c1' })

    await canteenApi.updateWindow('w1', { name: 'W2' } as any)
    expect(putMock).toHaveBeenCalledWith('/admin/windows/w1', { name: 'W2' })

    await canteenApi.deleteWindow('w2')
    expect(deleteMock).toHaveBeenCalledWith('/admin/windows/w2')
  })
})
