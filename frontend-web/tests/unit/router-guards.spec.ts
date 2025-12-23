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
vi.mock('@/components/Layout/MainLayout.vue', () => ({ default: {} }))
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

  it('non-auth route (not /login) calls next() with no args', () => {
    authState.isLoggedIn = false

    const next = vi.fn()

    guard({ meta: { requiresAuth: false }, path: '/news-manage' }, { path: '/' }, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0].length).toBe(0)
  })
})
