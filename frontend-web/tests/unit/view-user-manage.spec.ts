import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

import UserManage from '@/views/UserManage.vue'

const mocks = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
  authStoreMock: {
    user: { username: 'admin', role: 'staff' },
    permissions: ['admin:view', 'canteen:view', 'dish:view', 'dish:edit', 'dish:create'],
    token: 't',
    hasPermission: vi.fn((p: string) =>
      [
        'admin:view',
        'admin:create',
        'admin:edit',
        'admin:delete',
        'canteen:view',
        'dish:view',
        'dish:create',
        'dish:edit',
      ].includes(p),
    ),
  },
  permissionApiMock: {
    getAdmins: vi.fn(),
    deleteAdmin: vi.fn(),
    createAdmin: vi.fn(),
    updateAdminPermissions: vi.fn(),
  },
  canteenApiMock: {
    getCanteens: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => mocks.routerMock,
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/api/modules/permission', () => ({
  permissionApi: mocks.permissionApiMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

describe('views/UserManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.canteenApiMock.getCanteens.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1', name: 'C1' }] },
    })
    mocks.permissionApiMock.getAdmins.mockResolvedValue({
      code: 200,
      data: { items: [], meta: { totalPages: 1 } },
    })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
  })

  it('loads canteens/admins on mount and supports search + canteen filter', async () => {
    mocks.permissionApiMock.getAdmins.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          { id: 1, username: 'alice', role: 'kitchen_operator', canteenId: 'c1', createdAt: '2025-01-01' },
          { id: 2, username: 'bob', role: 'custom_role', canteenId: null, createdAt: '2025-01-02' },
        ],
        meta: { totalPages: 2 },
      },
    })

    const wrapper = mount(UserManage, {
      global: { stubs: { Header: true } },
    })

    await Promise.resolve()
    await nextTick()

    expect(mocks.canteenApiMock.getCanteens).toHaveBeenCalled()
    expect(mocks.permissionApiMock.getAdmins).toHaveBeenCalled()
    expect(wrapper.vm.totalPages).toBe(2)

    // search filter
    wrapper.vm.searchQuery = 'ali'
    await nextTick()
    expect(wrapper.vm.filteredAdmins).toHaveLength(1)

    // canteen filter: all => no canteenId
    wrapper.vm.searchQuery = ''
    wrapper.vm.canteenFilter = 'all'
    await nextTick()
    expect(wrapper.vm.filteredAdmins).toHaveLength(1)
    expect(wrapper.vm.filteredAdmins[0].username).toBe('bob')

    // specific canteen
    wrapper.vm.canteenFilter = 'c1'
    await nextTick()
    expect(wrapper.vm.filteredAdmins).toHaveLength(1)
    expect(wrapper.vm.filteredAdmins[0].username).toBe('alice')

    wrapper.unmount()
  })

  it('loadAdmins handles non-200 and thrown errors', async () => {
    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })

    await Promise.resolve()

    mocks.permissionApiMock.getAdmins.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.loadAdmins()
    expect(window.alert).toHaveBeenCalledWith('加载子管理员列表失败，请刷新重试')
    expect(wrapper.vm.adminList).toEqual([])

    ;(window.alert as any).mockClear()
    mocks.permissionApiMock.getAdmins.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.loadAdmins()
    expect(window.alert).toHaveBeenCalledWith('加载子管理员列表失败，请刷新重试')

    wrapper.unmount()
  })

  it('createNewAdmin switches to edit view and resetForm defaults', async () => {
    const wrapper = mount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    expect(wrapper.vm.viewMode).toBe('list')

    // click create button in template
    const btn = wrapper.find('button .iconify[data-icon="carbon:add"]').element.parentElement as HTMLButtonElement
    await btn.click()
    await nextTick()

    expect(wrapper.vm.viewMode).toBe('edit')
    expect(wrapper.vm.editingAdmin).toBe(null)
    expect(wrapper.vm.formData.password).toBe('Tsinghua@2025')

    wrapper.unmount()
  })

  it('editAdmin fills form for preset vs custom role and filters permissions based on current user', async () => {
    // user is not superadmin => should filter assigned perms
    mocks.authStoreMock.user = { username: 'admin', role: 'staff' } as any
    mocks.authStoreMock.permissions = ['dish:view', 'dish:edit']

    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    await wrapper.vm.editAdmin({
      id: 1,
      username: 'u1',
      role: 'kitchen_operator',
      canteenId: 'c1',
      permissions: ['dish:view', 'dish:edit', 'admin:delete'],
    })

    expect(wrapper.vm.formData.username).toBe('u1')
    expect(wrapper.vm.formData.role).toBe('kitchen_operator')
    expect(wrapper.vm.formData.customRole).toBe('')
    expect(wrapper.vm.formData.permissions).toEqual(['dish:view', 'dish:edit'])

    await wrapper.vm.editAdmin({
      id: 2,
      username: 'u2',
      role: 'my_custom',
      canteenId: '',
      permissions: ['dish:view'],
    })

    expect(wrapper.vm.formData.role).toBe('custom')
    expect(wrapper.vm.formData.customRole).toBe('my_custom')

    wrapper.unmount()
  })

  it('togglePermission enforces assignable permissions and adds dependencies', async () => {
    mocks.authStoreMock.permissions = ['dish:view', 'dish:edit', 'canteen:view']

    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    // cannot assign admin:delete
    wrapper.vm.togglePermission('admin:delete')
    expect(wrapper.vm.errors.permissions).toContain('无法分配')

    // can assign dish:edit, should add dish:view + canteen:view dependencies
    wrapper.vm.togglePermission('dish:edit')
    expect(wrapper.vm.formData.permissions).toContain('dish:edit')
    expect(wrapper.vm.formData.permissions).toContain('dish:view')
    expect(wrapper.vm.formData.permissions).toContain('canteen:view')

    // unselect
    wrapper.vm.togglePermission('dish:edit')
    expect(wrapper.vm.formData.permissions).not.toContain('dish:edit')

    wrapper.unmount()
  })

  it('toggleGroupPermissions and toggleAllPermissions work on available groups', async () => {
    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    // pick first computed group
    const groups = wrapper.vm.permissionGroups
    expect(Array.isArray(groups)).toBe(true)
    expect(groups.length).toBeGreaterThan(0)

    const group = groups[0]
    wrapper.vm.toggleGroupPermissions(group)
    expect(wrapper.vm.formData.permissions.length).toBeGreaterThan(0)
    expect(wrapper.vm.isGroupSelected(group)).toBe(true)

    wrapper.vm.toggleGroupPermissions(group)
    expect(wrapper.vm.isGroupSelected(group)).toBe(false)

    wrapper.vm.toggleAllPermissions()
    expect(wrapper.vm.isAllPermissionsSelected).toBe(true)

    wrapper.vm.toggleAllPermissions()
    expect(wrapper.vm.formData.permissions).toEqual([])

    wrapper.unmount()
  })

  it('submitForm validates and calls create/update APIs (and handles deleteAdmin branches)', async () => {
    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    // validation: missing username
    wrapper.vm.formData.username = ''
    wrapper.vm.formData.password = ''
    wrapper.vm.formData.permissions = []
    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.username).toBe('请填写用户名')

    // create path success
    mocks.permissionApiMock.createAdmin.mockResolvedValueOnce({ code: 200, data: { id: 1 } })
    mocks.permissionApiMock.getAdmins.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 1 } } })

    wrapper.vm.formData.username = ' new '
    wrapper.vm.formData.password = ' pw '
    wrapper.vm.formData.canteenId = ' '
    wrapper.vm.formData.permissions = ['dish:view']

    await wrapper.vm.submitForm()
    expect(mocks.permissionApiMock.createAdmin).toHaveBeenCalledWith({
      username: 'new',
      password: 'pw',
      canteenId: undefined,
      permissions: ['dish:view'],
    })

    // edit path updateAdminPermissions
    wrapper.vm.editingAdmin = { id: 9 } as any
    mocks.permissionApiMock.updateAdminPermissions.mockResolvedValueOnce({ code: 200 })
    mocks.permissionApiMock.getAdmins.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 1 } } })

    // create path success will backToList() + resetForm(); re-fill required fields for edit validation
    wrapper.vm.formData.username = 'u'
    wrapper.vm.formData.canteenId = ' c1 '
    wrapper.vm.formData.permissions = ['dish:view']
    await wrapper.vm.submitForm()
    expect(mocks.permissionApiMock.updateAdminPermissions).toHaveBeenCalledWith(9, ['dish:view'], 'c1')

    // delete confirm false
    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.deleteAdmin({ id: 1, username: 'u' })
    expect(mocks.permissionApiMock.deleteAdmin).not.toHaveBeenCalled()

    // delete success
    ;(window.confirm as any).mockReturnValueOnce(true)
    mocks.permissionApiMock.deleteAdmin.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.deleteAdmin({ id: 1, username: 'u' })
    expect(mocks.permissionApiMock.deleteAdmin).toHaveBeenCalledWith(1)

    wrapper.unmount()
  })

  it('password strength helpers, generatePassword, selectRole toggling, handleFilterChange, and superadmin permissionGroups', async () => {
    const origUser = mocks.authStoreMock.user
    const origPerms = mocks.authStoreMock.permissions

    const wrapper = mount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()
    await nextTick()

    wrapper.vm.createNewAdmin()
    await nextTick()

    wrapper.vm.formData.password = ''
    await nextTick()
    expect(wrapper.vm.passwordStrengthText).toBe('密码强度：弱')

    wrapper.vm.formData.password = 'abc'
    await nextTick()
    expect(wrapper.vm.passwordStrengthClass).toBe('bg-red-500')

    wrapper.vm.formData.password = 'Abcdef12'
    await nextTick()
    expect(wrapper.vm.passwordStrengthClass).toBe('bg-orange-500')

    wrapper.vm.formData.password = 'Abcdef12!'
    await nextTick()
    expect(wrapper.vm.passwordStrengthClass).toBe('bg-green-500')

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    wrapper.vm.generatePassword()
    expect(wrapper.vm.formData.password).toHaveLength(12)
    randomSpy.mockRestore()

    // selectRole: selecting same role again cancels
    wrapper.vm.formData.permissions = ['dish:view']
    wrapper.vm.selectRole('custom')
    expect(wrapper.vm.formData.role).toBe('custom')
    expect(wrapper.vm.formData.permissions).toEqual(['dish:view'])

    wrapper.vm.selectRole('custom')
    expect(wrapper.vm.formData.role).toBe('')
    expect(wrapper.vm.formData.customRole).toBe('')

    wrapper.vm.selectRole('kitchen_operator')
    expect(wrapper.vm.formData.role).toBe('kitchen_operator')
    expect(wrapper.vm.formData.permissions.length).toBeGreaterThan(0)

    // handleFilterChange just resets page
    wrapper.vm.currentPage = 3
    wrapper.vm.handleFilterChange()
    expect(wrapper.vm.currentPage).toBe(1)

    // superadmin permissionGroups shows all groups
    mocks.authStoreMock.user = { username: 'sa', role: 'superadmin' } as any
    mocks.authStoreMock.permissions = []
    const wrapper2 = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    expect(wrapper2.vm.permissionGroups.length).toBeGreaterThan(0)
    expect(wrapper2.vm.permissionGroups.some((g: any) => g.id === 'admin')).toBe(true)

    wrapper2.unmount()
    wrapper.unmount()

    mocks.authStoreMock.user = origUser
    mocks.authStoreMock.permissions = origPerms
  })

  it('submitForm blocks invalid permissions assignment and respects isSubmitting guard', async () => {
    mocks.authStoreMock.user = { username: 'admin', role: 'staff' } as any
    mocks.authStoreMock.permissions = ['admin:view', 'canteen:view']

    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    wrapper.vm.formData.username = 'u'
    wrapper.vm.formData.password = 'pw'
    wrapper.vm.formData.permissions = ['admin:view', 'admin:delete']

    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.permissions).toContain('您没有以下权限')
    expect(mocks.permissionApiMock.createAdmin).not.toHaveBeenCalled()

    wrapper.vm.errors.permissions = ''
    wrapper.vm.isSubmitting = true
    await wrapper.vm.submitForm()
    expect(mocks.permissionApiMock.createAdmin).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('deleteAdmin handles non-200 and thrown errors with alert message', async () => {
    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    ;(window.confirm as any).mockReturnValueOnce(true)
    mocks.permissionApiMock.deleteAdmin.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.deleteAdmin({ id: 1, username: 'u' })
    expect(window.alert).toHaveBeenCalledWith('bad')

    ;(window.alert as any).mockClear()
    ;(window.confirm as any).mockReturnValueOnce(true)
    mocks.permissionApiMock.deleteAdmin.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.deleteAdmin({ id: 2, username: 'u2' })
    expect(window.alert).toHaveBeenCalledWith('boom')

    wrapper.unmount()
  })

  it('changePage respects bounds and resetFilters resets state', async () => {
    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    wrapper.vm.totalPages = 3
    wrapper.vm.currentPage = 1

    await wrapper.vm.changePage(0)
    expect(wrapper.vm.currentPage).toBe(1)

    await wrapper.vm.changePage(2)
    expect(wrapper.vm.currentPage).toBe(2)

    wrapper.vm.searchQuery = 'x'
    wrapper.vm.canteenFilter = 'c1'
    wrapper.vm.resetFilters()
    expect(wrapper.vm.searchQuery).toBe('')
    expect(wrapper.vm.canteenFilter).toBe('')
    expect(wrapper.vm.currentPage).toBe(1)

    wrapper.unmount()
  })
})
