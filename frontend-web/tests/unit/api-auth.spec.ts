import { describe, expect, it, vi, beforeEach } from 'vitest'

const postMock = vi.fn()

vi.mock('@/utils/request', () => {
  return {
    default: {
      post: postMock,
    },
  }
})

describe('api/authApi', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('adminLogin posts to /auth/admin/login', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { authApi } = await import('@/api/modules/auth')
    await authApi.adminLogin({ username: 'u', password: 'p' } as any)

    expect(postMock).toHaveBeenCalledWith('/auth/admin/login', { username: 'u', password: 'p' })
  })

  it('refreshToken posts to /auth/refresh', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { authApi } = await import('@/api/modules/auth')
    await authApi.refreshToken()

    expect(postMock).toHaveBeenCalledWith('/auth/refresh')
  })
})
