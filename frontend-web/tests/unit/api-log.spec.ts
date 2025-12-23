import { describe, expect, it, vi, beforeEach } from 'vitest'

const getMock = vi.fn()

vi.mock('@/utils/request', () => {
  return {
    default: {
      get: getMock,
    },
  }
})

describe('api/logApi', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('getLogs calls GET /admin/logs with params', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { logApi } = await import('@/api/modules/log')
    await logApi.getLogs({ page: 1 } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/logs', { params: { page: 1 } })
  })
})
