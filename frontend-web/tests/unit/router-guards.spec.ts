import { describe, expect, it, vi, beforeEach } from 'vitest'

let guard: any
let capturedRoutes: any[] | undefined

const authState: any = {
  isLoggedIn: false,
  hasPermission: (p: string) => p === 'dish:view',
}

vi.mock('vue-router', () => {
  return {
    createWebHistory: vi.fn(() => ({})),
    createRouter: vi.fn((opts: any) => {
      capturedRoutes = opts.routes
      return {
        afterEach: vi.fn(),
        beforeEach: (cb: any) => {
          guard = cb
        },
      }
    }),
  }
})

vi.mock('@/store/modules/use-auth-store', () => {
  return {
    useAuthStore: () => authState,
  }
})

// stub out all route components imported by router/index.ts
vi.mock('../../src/components/Layout/MainLayout.vue', () => ({ default: {} }))
vi.mock('@/views/SingleAdd.vue', () => ({ default: {} }))
vi.mock('@/views/BatchAdd.vue', () => ({ default: {} }))
vi.mock('@/views/ModifyDish.vue', () => ({ default: {} }))
vi.mock('@/views/EditDish.vue', () => ({ default: {} }))
vi.mock('@/views/AddSubDish.vue', () => ({ default: {} }))
vi.mock('@/views/AddCanteen.vue', () => ({ default: {} }))
vi.mock('@/views/ReviewDish.vue', () => ({ default: {} }))
vi.mock('@/views/ReviewDishDetail.vue', () => ({ default: {} }))
vi.mock('@/views/ViewDishDetail.vue', () => ({ default: {} }))
vi.mock('@/views/UserManage.vue', () => ({ default: {} }))
vi.mock('@/views/NewsManage.vue', () => ({ default: {} }))
vi.mock('@/views/LogView.vue', () => ({ default: {} }))
vi.mock('@/views/ReportManage.vue', () => ({ default: {} }))
vi.mock('@/views/CommentManage.vue', () => ({ default: {} }))
vi.mock('@/views/ReviewManage.vue', () => ({ default: {} }))
vi.mock('@/views/ConfigManage.vue', () => ({ default: {} }))
vi.mock('@/views/Login.vue', () => ({ default: {} }))

describe('router/index route guard & redirect', () => {
  let loaded = false
  const loadOnce = async () => {
    if (!loaded) {
      await import('@/router')
      loaded = true
      expect(typeof guard).toBe('function')
      expect(Array.isArray(capturedRoutes)).toBe(true)
    }
  }

  beforeEach(async () => {
    authState.isLoggedIn = false
    authState.hasPermission = (p: string) => p === 'dish:view'
    sessionStorage.clear()

    await loadOnce()
  })

  it('redirects / to /login when not logged in', () => {
    const root = capturedRoutes!.find((r: any) => r.path === '/')
    expect(root).toBeTruthy()

    const out = root.redirect()
    expect(out).toBe('/login')
  })

  it('redirects / to first accessible route when logged in', () => {
    authState.isLoggedIn = true
    authState.hasPermission = (p: string) => p === 'news:view'

    const root = capturedRoutes!.find((r: any) => r.path === '/')
    const out = root.redirect()

    expect(out).toBe('/news-manage')
  })

  it('uses action permissions for dish write routes', () => {
    const children = capturedRoutes!.find((route: any) => route.path === '/').children
    const permissionFor = (name: string) =>
      children.find((route: any) => route.name === name).meta.requiredPermission

    expect(permissionFor('SingleAdd')).toBe('dish:create')
    expect(permissionFor('BatchAdd')).toBe('dish:create')
    expect(permissionFor('AddSubDish')).toBe('dish:create')
    expect(permissionFor('EditDish')).toBe('dish:edit')
    expect(permissionFor('ViewDishDetail')).toBe('dish:view')
  })

  it('declares either-permission access for combined moderation routes', () => {
    const children = capturedRoutes!.find((route: any) => route.path === '/').children
    const permissionsFor = (name: string) =>
      children.find((route: any) => route.name === name).meta.requiredPermissions

    expect(permissionsFor('ReviewManage')).toEqual(['review:approve', 'comment:approve'])
    expect(permissionsFor('CommentManage')).toEqual(['review:delete', 'comment:delete'])
    expect(
      children.find((route: any) => route.name === 'CommentManage').meta.requiredPermission,
    ).toBe('dish:view')
  })

  it('provides an authenticated route for users with no permissions', () => {
    const forbidden = capturedRoutes!.find((route: any) => route.path === '/forbidden')

    expect(forbidden).toBeTruthy()
    expect(forbidden.meta).toEqual({ requiresAuth: true })
  })

  it('requiresAuth route sends unauthenticated users to /login and stores redirect', () => {
    const next = vi.fn()

    guard(
      { meta: { requiresAuth: true }, fullPath: '/single-add' },
      { path: '/' },
      next,
    )

    expect(sessionStorage.getItem('login_redirect')).toBe('/single-add')
    expect(next).toHaveBeenCalledWith('/login')
  })

  it('requiresAuth route without permission redirects to first accessible route', () => {
    authState.isLoggedIn = true
    authState.hasPermission = (p: string) => p === 'news:view'

    const next = vi.fn()

    guard(
      { meta: { requiresAuth: true, requiredPermission: 'dish:view' }, fullPath: '/single-add' },
      { path: '/' },
      next,
    )

    expect(next).toHaveBeenCalledWith('/news-manage')
  })

  it('redirects a user with no permissions once to /forbidden', () => {
    authState.isLoggedIn = true
    authState.hasPermission = () => false

    const next = vi.fn()

    guard(
      { meta: { requiresAuth: true, requiredPermission: 'dish:create' }, fullPath: '/single-add' },
      { path: '/' },
      next,
    )

    expect(next).toHaveBeenCalledWith('/forbidden')
  })

  it('logged-in user visiting /login is redirected to first accessible route', () => {
    authState.isLoggedIn = true
    authState.hasPermission = (p: string) => p === 'config:view'

    const next = vi.fn()

    guard({ meta: { requiresAuth: false }, path: '/login' }, { path: '/' }, next)

    expect(next).toHaveBeenCalledWith('/config-manage')
  })

  it('requiresAuth route with permission calls next() with no args', () => {
    authState.isLoggedIn = true
    authState.hasPermission = (p: string) => p === 'dish:view'

    const next = vi.fn()

    guard(
      { meta: { requiresAuth: true, requiredPermission: 'dish:view' }, fullPath: '/single-add' },
      { path: '/' },
      next,
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0].length).toBe(0)
  })

  it('allows a route when any required permission is present', () => {
    authState.isLoggedIn = true
    authState.hasPermission = (permission: string) => permission === 'comment:approve'
    const next = vi.fn()

    guard(
      {
        meta: {
          requiresAuth: true,
          requiredPermissions: ['review:approve', 'comment:approve'],
        },
        fullPath: '/review-manage',
      },
      { path: '/' },
      next,
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0].length).toBe(0)
  })

  it('requires dish browsing as well as one deletion permission for deletion management', () => {
    authState.isLoggedIn = true
    authState.hasPermission = (permission: string) => permission === 'comment:delete'
    const next = vi.fn()

    guard(
      {
        meta: {
          requiresAuth: true,
          requiredPermission: 'dish:view',
          requiredPermissions: ['review:delete', 'comment:delete'],
        },
        fullPath: '/comment-manage',
      },
      { path: '/' },
      next,
    )

    expect(next).toHaveBeenCalledWith('/forbidden')
  })

  it('redirects when none of the required permissions is present', () => {
    authState.isLoggedIn = true
    authState.hasPermission = (permission: string) => permission === 'news:view'
    const next = vi.fn()

    guard(
      {
        meta: {
          requiresAuth: true,
          requiredPermissions: ['review:approve', 'comment:approve'],
        },
        fullPath: '/review-manage',
      },
      { path: '/' },
      next,
    )

    expect(next).toHaveBeenCalledWith('/news-manage')
  })

  it('non-auth route (not /login) calls next() with no args', () => {
    authState.isLoggedIn = false

    const next = vi.fn()

    guard({ meta: { requiresAuth: false }, path: '/news-manage' }, { path: '/' }, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0].length).toBe(0)
  })
})
