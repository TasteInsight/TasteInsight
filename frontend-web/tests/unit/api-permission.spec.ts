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

describe('api/permissionApi', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    deleteMock.mockReset()
  })

  it('getAdmins builds query string and calls GET', async () => {
    getMock.mockResolvedValueOnce({ code: 200 })

    const { permissionApi } = await import('@/api/modules/permission')
    await permissionApi.getAdmins({ page: 2, pageSize: 20, username: 'u' } as any)

    const calledUrl = getMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('/admin/admins?')
    expect(calledUrl).toContain('page=2')
    expect(calledUrl).toContain('pageSize=20')
    expect(calledUrl).toContain('username=u')
  })

  it('updateAdminPermissions sends canteenId when provided', async () => {
    putMock.mockResolvedValueOnce({ code: 200 })

    const { permissionApi } = await import('@/api/modules/permission')
    await permissionApi.updateAdminPermissions('a1', ['p1'], 'c1')

    expect(putMock).toHaveBeenCalledWith('/admin/admins/a1/permissions', {
      permissions: ['p1'],
      canteenId: 'c1',
    })
  })

  it('createAdmin posts to /admin/admins', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { permissionApi } = await import('@/api/modules/permission')
    await permissionApi.createAdmin({ username: 'u1' } as any)

    expect(postMock).toHaveBeenCalledWith('/admin/admins', { username: 'u1' })
  })

  it('deleteAdmin deletes /admin/admins/:id', async () => {
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { permissionApi } = await import('@/api/modules/permission')
    await permissionApi.deleteAdmin('a1')

    expect(deleteMock).toHaveBeenCalledWith('/admin/admins/a1')
  })

  it('updateAdminPermissions omits canteenId when not provided', async () => {
    putMock.mockResolvedValueOnce({ code: 200 })

    const { permissionApi } = await import('@/api/modules/permission')
    await permissionApi.updateAdminPermissions('a1', ['p1'])

    expect(putMock).toHaveBeenCalledWith('/admin/admins/a1/permissions', {
      permissions: ['p1'],
    })
  })

  it('updateAdminPermissions includes canteenId when null', async () => {
    putMock.mockResolvedValueOnce({ code: 200 })

    const { permissionApi } = await import('@/api/modules/permission')
    await permissionApi.updateAdminPermissions('a1', ['p1'], null)

    expect(putMock).toHaveBeenCalledWith('/admin/admins/a1/permissions', {
      permissions: ['p1'],
      canteenId: null,
    })
  })
})
