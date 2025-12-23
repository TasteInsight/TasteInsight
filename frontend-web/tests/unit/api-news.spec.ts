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

describe('api/newsApi', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    deleteMock.mockReset()
  })

  it('getNews calls GET /admin/news with params', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { newsApi } = await import('@/api/modules/news')
    await newsApi.getNews({ page: 1 } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/news', { params: { page: 1 } })
  })

  it('publishNews posts to publish endpoint', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { newsApi } = await import('@/api/modules/news')
    await newsApi.publishNews('n1')

    expect(postMock).toHaveBeenCalledWith('/admin/news/n1/publish')
  })

  it('create/update/delete news call correct endpoints', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })
    putMock.mockResolvedValueOnce({ code: 200 })
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { newsApi } = await import('@/api/modules/news')

    await newsApi.createNews({ title: 't' } as any)
    expect(postMock).toHaveBeenCalledWith('/admin/news', { title: 't' })

    await newsApi.updateNews('n1', { title: 't2' } as any)
    expect(putMock).toHaveBeenCalledWith('/admin/news/n1', { title: 't2' })

    await newsApi.deleteNews('n2')
    expect(deleteMock).toHaveBeenCalledWith('/admin/news/n2')
  })

  it('revokeNews posts to revoke endpoint', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { newsApi } = await import('@/api/modules/news')
    await newsApi.revokeNews('n1')

    expect(postMock).toHaveBeenCalledWith('/admin/news/n1/revoke')
  })
})
