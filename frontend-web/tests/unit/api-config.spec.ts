import { describe, expect, it, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const putMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/utils/request', () => {
  return {
    default: {
      get: getMock,
      put: putMock,
      delete: deleteMock,
    },
  }
})

describe('api/configApi', () => {
  beforeEach(() => {
    getMock.mockReset()
    putMock.mockReset()
    deleteMock.mockReset()
  })

  it('getGlobalConfig calls GET /admin/config/global', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { configApi } = await import('@/api/modules/config')
    await configApi.getGlobalConfig()

    expect(getMock).toHaveBeenCalledWith('/admin/config/global')
  })

  it('deleteCanteenConfigItem calls DELETE with canteen and key', async () => {
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { configApi } = await import('@/api/modules/config')
    await configApi.deleteCanteenConfigItem('c1', 'k1')

    expect(deleteMock).toHaveBeenCalledWith('/admin/config/canteen/c1/k1')
  })

  it('getTemplates calls GET /admin/config/templates with params', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { configApi } = await import('@/api/modules/config')
    await configApi.getTemplates({ page: 2, pageSize: 10 } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/config/templates', { params: { page: 2, pageSize: 10 } })
  })

  it('updateGlobalConfig calls PUT /admin/config/global', async () => {
    putMock.mockResolvedValueOnce({ code: 200 })

    const { configApi } = await import('@/api/modules/config')
    await configApi.updateGlobalConfig({ items: [] } as any)

    expect(putMock).toHaveBeenCalledWith('/admin/config/global', { items: [] })
  })

  it('getCanteenConfig calls GET /admin/config/canteen/:id', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { configApi } = await import('@/api/modules/config')
    await configApi.getCanteenConfig('c1')

    expect(getMock).toHaveBeenCalledWith('/admin/config/canteen/c1')
  })

  it('updateCanteenConfig calls PUT /admin/config/canteen/:id', async () => {
    putMock.mockResolvedValueOnce({ code: 200 })

    const { configApi } = await import('@/api/modules/config')
    await configApi.updateCanteenConfig('c1', { items: [{ key: 'k', value: 'v' }] } as any)

    expect(putMock).toHaveBeenCalledWith('/admin/config/canteen/c1', { items: [{ key: 'k', value: 'v' }] })
  })

  it('getEffectiveConfig calls GET /admin/config/canteen/:id/effective', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { configApi } = await import('@/api/modules/config')
    await configApi.getEffectiveConfig('c1')

    expect(getMock).toHaveBeenCalledWith('/admin/config/canteen/c1/effective')
  })
})
