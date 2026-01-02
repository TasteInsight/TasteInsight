import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const adminLoginMock = vi.fn()

vi.mock('@/api/modules/auth', () => {
  return {
    authApi: {
      adminLogin: adminLoginMock,
    },
    default: {
      adminLogin: adminLoginMock,
    },
  }
})

describe('store/use-auth-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    adminLoginMock.mockReset()
  })

  it('hasPermission returns false when no user', async () => {
    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    store.user = null as any
    expect(store.hasPermission('dish:view')).toBe(false)
  })

  it('hasAnyPermission returns false when no user', async () => {
    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    store.user = null as any
    expect(store.hasAnyPermission(['a', 'b'])).toBe(false)
  })

  it('permissions defaults to empty array when not stored', async () => {
    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    expect(store.permissions).toEqual([])
  })

  it('superadmin has all permissions (role)', async () => {
    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    store.user = { username: 'any', role: 'superadmin' } as any
    expect(store.hasPermission('anything')).toBe(true)
    expect(store.hasAnyPermission(['a', 'b'])).toBe(true)
  })

  it('testadmin has all permissions (username)', async () => {
    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    store.user = { username: 'testadmin', role: 'admin' } as any
    expect(store.hasPermission('anything')).toBe(true)
    expect(store.hasAnyPermission(['x', 'y'])).toBe(true)
  })

  it('initializes token/refresh/user from storage', async () => {
    sessionStorage.setItem('admin_token', 'st')
    sessionStorage.setItem('admin_refresh_token', 'sr')
    sessionStorage.setItem('admin_user', JSON.stringify({ username: 'u', role: 'admin' }))
    sessionStorage.setItem('admin_permissions', JSON.stringify(['dish:view']))

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    expect(store.token).toBe('st')
    expect(store.refreshToken).toBe('sr')
    expect(store.user?.username).toBe('u')
    expect(store.permissions).toContain('dish:view')
    expect(store.isLoggedIn).toBe(true)
  })

  it('hasPermission/hasAnyPermission checks stored permissions', async () => {
    localStorage.setItem('admin_permissions', JSON.stringify(['dish:view', 'news:view']))

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()
    store.user = { username: 'u', role: 'admin' } as any

    expect(store.hasPermission('dish:view')).toBe(true)
    expect(store.hasPermission('missing')).toBe(false)

    expect(store.hasAnyPermission(['missing', 'news:view'])).toBe(true)
    expect(store.hasAnyPermission(['a', 'b'])).toBe(false)
  })

  it('login stores to localStorage when remember=true', async () => {
    adminLoginMock.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: {
        token: { accessToken: 't1', refreshToken: 'r1' },
        admin: { username: 'u1', role: 'admin' },
        permissions: ['dish:view'],
      },
    })

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    const res = await store.login({ username: 'u1', password: 'p', remember: true } as any)

    expect(localStorage.getItem('admin_token')).toBe('t1')
    expect(localStorage.getItem('admin_refresh_token')).toBe('r1')
    expect(localStorage.getItem('admin_permissions')).toContain('dish:view')
    expect(sessionStorage.getItem('admin_token')).toBeNull()
    expect(res).toEqual({
      token: 't1',
      data: { user: { username: 'u1', role: 'admin' }, permissions: ['dish:view'] },
    })
  })

  it('login stores to sessionStorage when remember=false', async () => {
    adminLoginMock.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: {
        token: { accessToken: 't2', refreshToken: 'r2' },
        admin: { username: 'u2', role: 'admin' },
        permissions: ['news:view'],
      },
    })

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    await store.login({ username: 'u2', password: 'p', remember: false } as any)

    expect(sessionStorage.getItem('admin_token')).toBe('t2')
    expect(sessionStorage.getItem('admin_refresh_token')).toBe('r2')
    expect(localStorage.getItem('admin_token')).toBeNull()
  })

  it('login throws on non-200 response and clears state', async () => {
    adminLoginMock.mockResolvedValue({ code: 500, message: 'bad', data: null })

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    await expect(store.login({ username: 'u', password: 'p', remember: true } as any)).rejects.toThrow('bad')

    expect(store.token).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it("login throws default message when response.message is empty", async () => {
    adminLoginMock.mockResolvedValue({ code: 500, message: '', data: null })

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    await expect(store.login({ username: 'u', password: 'p' } as any)).rejects.toThrow('登录失败')
  })

  it('login throws when data missing and clears state', async () => {
    adminLoginMock.mockResolvedValue({ code: 200, message: 'ok', data: null })

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    await expect(store.login({ username: 'u', password: 'p' } as any)).rejects.toThrow('ok')
    expect(store.isLoggedIn).toBe(false)
  })

  it('login propagates thrown error and clears state', async () => {
    adminLoginMock.mockRejectedValue(new Error('network'))

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    await expect(store.login({ username: 'u', password: 'p' } as any)).rejects.toThrow('network')
    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('isLoggedIn depends on both token and isAuthenticated', async () => {
    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    store.token = 't' as any
    store.isAuthenticated = false as any
    expect(store.isLoggedIn).toBe(false)
  })

  it('logout clears storage and state', async () => {
    localStorage.setItem('admin_token', 't')
    localStorage.setItem('admin_refresh_token', 'r')
    localStorage.setItem('admin_user', JSON.stringify({ username: 'u', role: 'admin' }))
    localStorage.setItem('admin_permissions', JSON.stringify(['dish:view']))

    const { useAuthStore } = await import('@/store/modules/use-auth-store')
    const store = useAuthStore()

    store.logout()

    expect(store.token).toBeNull()
    expect(localStorage.getItem('admin_token')).toBeNull()
    expect(localStorage.getItem('admin_permissions')).toBeNull()
  })
})
