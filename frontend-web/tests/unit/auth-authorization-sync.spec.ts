import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { permission } from '@/directives/permission'
import { getAuthSessionVersion } from '@/utils/auth-session'
import { authorization } from '../fixtures/authorization'

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/api/modules/auth', () => ({ authApi: mocks }))
const admin = { id: 'a', username: 'a', role: 'admin', scope: 'CANTEENS' as const, canteenIds: ['c1'], canteens: [{ id: 'c1', name: '食堂一' }], createdAt: '2026-10-20' }

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
describe('live administrator authorization', () => {
  it('refreshes grants and scope, persists them, and invalidates previously scoped requests', async () => {
    const store = useAuthStore()
    store.token = 'access'; store.isAuthenticated = true; store.user = admin; store.permissions = ['dish:view']
    const before = getAuthSessionVersion()
    mocks.getSession.mockResolvedValue({ code: 200, data: { admin: { ...admin, scope: 'GLOBAL', canteenIds: [] }, permissions: ['log:view'], authorization } })
    await store.refreshSession()
    expect(store.permissions).toEqual(['log:view'])
    expect(store.user?.scope).toBe('GLOBAL')
    expect(getAuthSessionVersion()).toBeGreaterThan(before)
    expect(JSON.parse(localStorage.getItem('admin_permissions')!)).toEqual(['log:view'])
  })
  it('invalidates cached views and pending requests when only the managed hierarchy changes', async () => {
    const store = useAuthStore()
    store.token = 'access'; store.isAuthenticated = true; store.user = { ...admin, hierarchyVersion: 0 }; store.permissions = ['log:view']
    const sessionVersion = getAuthSessionVersion()
    const revision = store.authorizationRevision
    mocks.getSession.mockResolvedValue({ code: 200, data: { admin: { ...admin, hierarchyVersion: 1 }, permissions: ['log:view'], authorization } })
    await store.refreshSession()
    expect(store.permissions).toEqual(['log:view'])
    expect(store.authorizationRevision).toBe(revision + 1)
    expect(getAuthSessionVersion()).toBeGreaterThan(sessionVersion)
    expect(store.token).toBe('access')
  })
  it('coalesces concurrent refreshes and rejects a late response after logout', async () => {
    const store = useAuthStore(); store.token = 'access'; store.user = admin
    let resolve!: (value: unknown) => void
    mocks.getSession.mockReturnValue(new Promise(done => { resolve = done }))
    const first = store.refreshSession(); const second = store.refreshSession()
    expect(mocks.getSession).toHaveBeenCalledTimes(1)
    store.logout()
    resolve({ code: 200, data: { admin, permissions: ['log:view'], authorization } })
    await expect(first).rejects.toThrow('登录会话已变更')
    await expect(second).rejects.toThrow('登录会话已变更')
    expect(store.user).toBeNull()
    expect(localStorage.getItem('admin_user')).toBeNull()
  })
  it('updates permission-controlled navigation in both directions without destroying its element', async () => {
    const store = useAuthStore(); store.user = admin
    const wrapper = mount({ template: '<button v-permission="\'log:view\'">操作日志</button>' }, { global: { directives: { permission } } })
    expect(wrapper.get('button').element.style.display).toBe('none')
    store.permissions = ['log:view']; await nextTick()
    expect(wrapper.get('button').element.style.display).toBe('')
    store.permissions = []; await nextTick()
    expect(wrapper.get('button').element.style.display).toBe('none')
    wrapper.unmount()
  })
})
