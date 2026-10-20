vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: mocks.showAlertMock, error: mocks.showAlertMock, info: mocks.showAlertMock }), notify: { success: mocks.showAlertMock, error: mocks.showAlertMock, info: mocks.showAlertMock } }))
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DOMWrapper, mount, flushPromises, shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
  authStoreMock: {
    user: { scope: 'GLOBAL' as const, canteenIds: [], canteens: [], username: 'admin', role: 'staff' },
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
    handoverAdmin: vi.fn(),
    createAdmin: vi.fn(),
    updateAdminPermissions: vi.fn(),
  },
  canteenApiMock: {
    getCanteenOptions: vi.fn(),
  },
  showAlertMock: vi.fn(() => Promise.resolve()),
  showConfirmDangerMock: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('vue-router', () => ({
  useRouter: () => mocks.routerMock,
}))

vi.mock('@/store/modules/use-auth-store', async () => { const { authorization } = await import('../fixtures/authorization'); return { useAuthStore: () => Object.assign(mocks.authStoreMock, { authorization }) } })

vi.mock('@/api/modules/permission', () => ({
  permissionApi: mocks.permissionApiMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlertMock,
  showConfirm: vi.fn(() => Promise.resolve(true)),
  showConfirmDanger: mocks.showConfirmDangerMock,
}))

import UserManage from '../../src/views/UserManage.vue'

describe('views/UserManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authStoreMock.user = { scope: 'GLOBAL' as const, canteenIds: [], canteens: [], username: 'admin', role: 'staff' }
    mocks.authStoreMock.permissions = [
      'admin:view',
      'canteen:view',
      'dish:view',
      'dish:edit',
      'dish:create',
    ]
    mocks.canteenApiMock.getCanteenOptions.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1', name: 'C1' }] },
    })
    mocks.permissionApiMock.getAdmins.mockResolvedValue({
      code: 200,
      data: { items: [], meta: { totalPages: 1 } },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves role names and displays ordinary administrators without a custom technical label', async () => {
    const wrapper = shallowMount(UserManage)
    try {
      await flushPromises()
      await wrapper.vm.editAdmin({ id: 'role-account', username: 'staff', role: 'admin', scope: 'GLOBAL', canteenIds: [], permissions: ['dish:view'] })
      expect(wrapper.vm.getRoleLabel('admin')).toBe('普通管理员')
      expect(wrapper.vm.formData.role).toBe('')
      wrapper.vm.formData.role = 'custom'
      wrapper.vm.formData.customRole = '  运营专员  '
      mocks.permissionApiMock.updateAdminPermissions.mockResolvedValueOnce({ code: 200 })
      await wrapper.vm.submitForm()
      expect(mocks.permissionApiMock.updateAdminPermissions).toHaveBeenCalledWith('role-account', ['dish:view'], 'GLOBAL', [], '运营专员')
    } finally { wrapper.unmount() }
  })

  it('opens a handover before retiring a manager and submits the selected replacement atomically', async () => {
    const source = { id: 'old', username: '原负责人', scope: 'GLOBAL', directReportCount: 2 }
    const replacement = { id: 'new', username: '新负责人', scope: 'GLOBAL', managerId: 'root' }
    const descendant = { id: 'child', username: '下属', scope: 'GLOBAL', managerId: 'old' }
    mocks.permissionApiMock.getAdmins.mockResolvedValue({ code: 200, data: { items: [source, replacement, descendant], meta: { totalPages: 1 } } })
    mocks.permissionApiMock.handoverAdmin.mockResolvedValue({ code: 200 })
    const wrapper = mount(UserManage, { global: { stubs: { Header: true, AdminDialog: { template: '<div><slot /></div>' } } } })
    try {
      await flushPromises()
      await wrapper.vm.deleteAdmin(source)
      await flushPromises()
      expect(mocks.permissionApiMock.deleteAdmin).not.toHaveBeenCalled()
      expect(wrapper.vm.handoverRetireSource).toBe(true)
      const select = wrapper.get('#handover-manager')
      expect(select.findAll('option').map(option => option.text())).toEqual(['请选择新负责人', '新负责人 · 全局范围'])
      await select.setValue('new')
      expect(wrapper.text()).toContain('确认移交并停用')
      await wrapper.vm.submitHandover()
      expect(mocks.permissionApiMock.handoverAdmin).toHaveBeenCalledWith('old', 'new', true)
      expect(wrapper.vm.handoverTarget).toBeNull()
    } finally { wrapper.unmount() }
  })

  it('keeps the handover open with the server validation error and supports transfer without retirement', async () => {
    const wrapper = shallowMount(UserManage)
    try {
      await flushPromises()
      await wrapper.vm.openHandover({ id: 'old', username: '原负责人' })
      wrapper.vm.handoverManagerId = 'new'
      mocks.permissionApiMock.handoverAdmin.mockRejectedValue(new Error('新负责人的权限须覆盖下属的现有权限'))
      await wrapper.vm.submitHandover()
      expect(mocks.permissionApiMock.handoverAdmin).toHaveBeenCalledWith('old', 'new', false)
      expect(wrapper.vm.handoverTarget?.id).toBe('old')
      expect(wrapper.vm.handoverError).toContain('新负责人的权限须覆盖')
      expect(wrapper.vm.handoverSubmitting).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('keeps paginated replacement loading from reopening a cancelled handover', async () => {
    const wrapper = shallowMount(UserManage)
    try {
      await flushPromises()
      let resolve!: (value: unknown) => void
      mocks.permissionApiMock.getAdmins.mockImplementationOnce(() => new Promise(done => { resolve = done }))
      const pending = wrapper.vm.openHandover({ id: 'old', username: '原负责人' })
      wrapper.vm.closeHandover()
      resolve({ code: 200, data: { items: [{ id: 'new', username: '新负责人' }], meta: { totalPages: 1 } } })
      await pending
      expect(wrapper.vm.handoverTarget).toBeNull()
      expect(wrapper.vm.handoverCandidates).toEqual([])
    } finally { wrapper.unmount() }
  })

  it('creates an account with two selected canteens from the native multi-select controls', async () => {
    mocks.canteenApiMock.getCanteenOptions.mockResolvedValue({ code: 200, data: { items: [{ id: 'c1', name: '食堂一' }, { id: 'c2', name: '食堂二' }] } })
    mocks.permissionApiMock.createAdmin.mockResolvedValue({ code: 200, data: { id: 'new' } })
    const wrapper = mount(UserManage, { global: { stubs: { Header: true } } })
    try {
      await flushPromises()
      wrapper.vm.createNewAdmin()
      wrapper.vm.formData.scope = 'CANTEENS'
      wrapper.vm.formData.username = 'operator'
      wrapper.vm.formData.password = 'Password123!'
      wrapper.vm.formData.permissions = ['dish:view']
      await nextTick()
      const options = wrapper.findAll('fieldset input[type="checkbox"]')
      expect(options).toHaveLength(2)
      await options[0].setValue(true)
      await options[1].setValue(true)
      await wrapper.vm.submitForm()
      expect(mocks.permissionApiMock.createAdmin).toHaveBeenCalledWith(expect.objectContaining({ scope: 'CANTEENS', canteenIds: ['c1', 'c2'] }))
    } finally { wrapper.unmount() }
  })

  it('opens password reset in a native dialog and clears its target on cancel', async () => {
    const wrapper = mount(UserManage, { global: { stubs: { Header: true } } })
    try {
      wrapper.vm.openResetPasswordModal({ id: 'admin-2', username: 'staff' })
      await nextTick()
      const dialog = new DOMWrapper(document.body).get('dialog[aria-label="重置密码"]')
      expect(dialog.attributes('open')).toBeDefined()
      expect(dialog.get('button[type="submit"]').classes()).toContain('bg-orange-700')
      await dialog.trigger('cancel')
      expect(wrapper.vm.showResetPasswordModal).toBe(false)
      expect(wrapper.vm.resetPasswordTarget).toBeNull()
    } finally {
      wrapper.unmount()
    }
  })

  it('exposes campus permissions, expands community dependencies, and blocks canteen-scoped assignment', async () => {
    mocks.authStoreMock.permissions = ['admin:view', 'admin:create', 'canteen:view', 'student:review', 'post:view', 'post:approve', 'post:delete']
    const wrapper = mount(UserManage, { global: { stubs: { Header: true } } })
    try {
      await Promise.resolve()
      await nextTick()
      expect(wrapper.vm.permissionGroups.find((group: any) => group.id === 'student').permissions[0].id).toBe('student:review')
      wrapper.vm.togglePermission('post:approve')
      expect(wrapper.vm.formData.permissions).toEqual(['post:approve', 'post:view'])
      wrapper.vm.formData.username = 'test-admin'
      wrapper.vm.formData.password = 'ValidPassword123!'
      wrapper.vm.formData.scope = 'CANTEENS'
      wrapper.vm.formData.canteenIds = ['c1']
      await wrapper.vm.submitForm()
      expect(wrapper.vm.errors.permissions).toContain('仅可分配给全局管理范围')
      expect(mocks.permissionApiMock.createAdmin).not.toHaveBeenCalled()
    } finally { wrapper.unmount() }
  })

  it('loads canteens/admins on mount and supports search + canteen filter', async () => {
    mocks.permissionApiMock.getAdmins.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          { id: 1, username: 'alice', role: 'kitchen_operator', scope: 'CANTEENS', canteenIds: ['c1'], canteens: [{ id: 'c1', name: 'c1' }], createdAt: '2025-01-01' },
          { id: 2, username: 'bob', role: 'custom_role', scope: 'GLOBAL', canteenIds: [], canteens: [], createdAt: '2025-01-02' },
        ],
        meta: { totalPages: 2 },
      },
    })

    const wrapper = mount(UserManage, {
      global: { stubs: { Header: true } },
    })

    await Promise.resolve()
    await nextTick()

    expect(mocks.canteenApiMock.getCanteenOptions).toHaveBeenCalled()
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

    // A global account also manages the selected canteen.
    wrapper.vm.canteenFilter = 'c1'
    await nextTick()
    expect(wrapper.vm.filteredAdmins.map((admin: { username: string }) => admin.username)).toEqual(['alice', 'bob'])

    wrapper.unmount()
  })

  it('loadAdmins handles non-200 and thrown errors', async () => {
    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })

    await Promise.resolve()

    mocks.permissionApiMock.getAdmins.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.loadAdmins()
    expect(mocks.showAlertMock).toHaveBeenCalledWith('加载子管理员列表失败，请刷新重试')
    expect(wrapper.vm.adminList).toEqual([])

    mocks.showAlertMock.mockClear()
    mocks.permissionApiMock.getAdmins.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.loadAdmins()
    expect(mocks.showAlertMock).toHaveBeenCalledWith('加载子管理员列表失败，请刷新重试')

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
    expect(wrapper.vm.formData.password).toHaveLength(16)

    wrapper.unmount()
  })

  it('editAdmin fills form for preset vs custom role and filters permissions based on current user', async () => {
    // user is not superadmin => should filter assigned perms
    mocks.authStoreMock.user = { scope: 'GLOBAL' as const, canteenIds: [], canteens: [], username: 'admin', role: 'staff' } as any
    mocks.authStoreMock.permissions = ['dish:view', 'dish:edit']

    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    await wrapper.vm.editAdmin({
      id: 1,
      username: 'u1',
      role: 'kitchen_operator',
      scope: 'CANTEENS', canteenIds: ['c1'], canteens: [{ id: 'c1', name: 'c1' }],
      permissions: ['dish:view', 'dish:edit', 'admin:delete'],
    })

    expect(wrapper.vm.formData.username).toBe('u1')
    expect(wrapper.vm.formData.role).toBe('kitchen_operator')
    expect(wrapper.vm.formData.customRole).toBe('')
    expect(wrapper.vm.formData.permissions).toEqual(['dish:view', 'dish:edit'])

    await wrapper.vm.editAdmin({ scope: 'GLOBAL' as const, canteenIds: [], canteens: [],
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

  it('adds transitive dependencies and rejects an incomplete assignable chain', async () => {
    mocks.authStoreMock.permissions = [
      'comment:delete',
      'comment:approve',
      'dish:view',
      'canteen:view',
    ]

    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    wrapper.vm.togglePermission('comment:delete')
    expect(wrapper.vm.formData.permissions).toEqual(
      expect.arrayContaining([
        'comment:delete',
        'comment:approve',
        'dish:view',
        'canteen:view',
      ]),
    )

    wrapper.vm.formData.permissions = []
    mocks.authStoreMock.permissions = ['comment:delete', 'comment:approve']
    wrapper.vm.togglePermission('comment:delete')

    expect(wrapper.vm.formData.permissions).toEqual([])
    expect(wrapper.vm.errors.permissions).toContain('dish:view')
    expect(wrapper.vm.errors.permissions).toContain('canteen:view')
    wrapper.unmount()
  })

  it('adds view permission for experiment write permissions', async () => {
    mocks.authStoreMock.permissions = ['experiment:view', 'experiment:edit']

    const wrapper = shallowMount(UserManage, { global: { stubs: { Header: true } } })
    await Promise.resolve()

    wrapper.vm.togglePermission('experiment:edit')

    expect(wrapper.vm.formData.permissions).toEqual(
      expect.arrayContaining(['experiment:view', 'experiment:edit']),
    )
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
    wrapper.vm.formData.scope = 'GLOBAL'
    wrapper.vm.formData.canteenIds = []
    wrapper.vm.formData.permissions = ['dish:view']
    wrapper.vm.formData.role = 'admin'

    await wrapper.vm.submitForm()
    expect(mocks.permissionApiMock.createAdmin).toHaveBeenCalledWith(expect.objectContaining({
      username: 'new',
      password: 'pw',
      permissions: ['dish:view'],
    }))

    // edit path updateAdminPermissions
    wrapper.vm.editingAdmin = { id: 9 } as any
    mocks.permissionApiMock.updateAdminPermissions.mockResolvedValueOnce({ code: 200 })
    mocks.permissionApiMock.getAdmins.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 1 } } })

    // create path success will backToList() + resetForm(); re-fill required fields for edit validation
    wrapper.vm.formData.username = 'u'
    wrapper.vm.formData.scope = 'CANTEENS'
    wrapper.vm.formData.canteenIds = ['c1']
    wrapper.vm.formData.permissions = ['dish:view']
    await wrapper.vm.submitForm()
    expect(mocks.permissionApiMock.updateAdminPermissions).toHaveBeenCalledWith(9, ['dish:view'], 'CANTEENS', ['c1'], 'admin')

    // delete confirm false
    mocks.showConfirmDangerMock.mockResolvedValueOnce(false)
    await wrapper.vm.deleteAdmin({ id: 1, username: 'u' })
    expect(mocks.permissionApiMock.deleteAdmin).not.toHaveBeenCalled()

    // delete success
    mocks.showConfirmDangerMock.mockResolvedValueOnce(true)
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

        wrapper.vm.generatePassword()
    expect(wrapper.vm.formData.password).toHaveLength(16)

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

    // superadmin permissionGroups shows all groups (backend returns all permissions for superadmin)
    mocks.authStoreMock.user = { scope: 'GLOBAL' as const, canteenIds: [], canteens: [], username: 'sa', role: 'superadmin' } as any
    // For superadmin, backend returns all permissions
    mocks.authStoreMock.permissions = [
      'dish:view', 'dish:create', 'dish:edit', 'dish:delete',
      'canteen:view', 'canteen:create', 'canteen:edit', 'canteen:delete',
      'review:approve', 'review:delete', 'comment:approve', 'comment:delete',
      'report:handle', 'upload:approve',
      'news:view', 'news:create', 'news:edit', 'news:publish', 'news:revoke', 'news:delete',
      'admin:view', 'admin:create', 'admin:edit', 'admin:delete',
      'config:view', 'config:edit',
      'experiment:view', 'experiment:create', 'experiment:edit', 'experiment:delete',
    ]
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
    mocks.authStoreMock.user = { scope: 'GLOBAL' as const, canteenIds: [], canteens: [], username: 'admin', role: 'staff' } as any
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

    mocks.showConfirmDangerMock.mockResolvedValueOnce(true)
    mocks.permissionApiMock.deleteAdmin.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.deleteAdmin({ id: 1, username: 'u' })
    expect(mocks.showAlertMock).toHaveBeenCalledWith('bad')

    mocks.showAlertMock.mockClear()
    mocks.showConfirmDangerMock.mockResolvedValueOnce(true)
    mocks.permissionApiMock.deleteAdmin.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.deleteAdmin({ id: 2, username: 'u2' })
    expect(mocks.showAlertMock).toHaveBeenCalledWith('boom')

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
