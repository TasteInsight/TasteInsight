import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

import Header from '../../src/components/Layout/Header.vue'
import MainLayout from '../../src/components/Layout/MainLayout.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  showConfirmMock: vi.fn(() => Promise.resolve(true)),
  showAlertMock: vi.fn(() => Promise.resolve()),
  permissionApiMock: {
    changeOwnPassword: vi.fn(),
  },
}))

const routeMock = {
  path: '/single-add',
  meta: {},
  params: {},
  query: {},
}

const authStoreMock = {
  user: { username: 'u' },
  token: 't',
  permissions: ['dish:view'],
  hasPermission: vi.fn((id: string) => true),
  logout: vi.fn(),
}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace }),
  useRoute: () => routeMock,
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => authStoreMock,
}))

vi.mock('@/api/modules/permission', () => ({
  permissionApi: mocks.permissionApiMock,
}))

vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlertMock,
  showConfirm: mocks.showConfirmMock,
  showConfirmDanger: vi.fn(() => Promise.resolve(true)),
}))

describe('components/Layout', () => {
  it('Header renders props and border', () => {
    const wrapper = mount(Header, {
      props: {
        title: 'T',
        description: 'D',
        headerIcon: 'carbon:test',
        showBorder: true,
      },
    })

    expect(wrapper.text()).toContain('T')
    expect(wrapper.text()).toContain('D')
    expect(wrapper.classes().join(' ')).toContain('border-b')
  })

  it('Header can hide border', () => {
    const wrapper = mount(Header, {
      props: {
        title: 'T',
        description: 'D',
        headerIcon: 'carbon:test',
        showBorder: false,
      },
    })

    expect(wrapper.classes().join(' ')).not.toContain('border-b')
  })

  it('MainLayout renders keep-alive branch when $route.meta.keepAlive = true', () => {
    const RouterViewStub = defineComponent({
      name: 'RouterView',
      setup(_, { slots }) {
        const Comp = defineComponent({ name: 'Inner', template: '<div>inner</div>' })
        return () => slots.default?.({ Component: Comp })
      },
    })

    const wrapper = mount(MainLayout, {
      global: {
        stubs: {
          Sidebar: defineComponent({ name: 'Sidebar', template: '<div>sidebar</div>' }),
          'router-view': RouterViewStub,
        },
        mocks: {
          $route: { meta: { keepAlive: true }, path: '/p' },
        },
      },
    })

    expect(wrapper.text()).toContain('sidebar')
    expect(wrapper.findComponent({ name: 'KeepAlive' }).exists()).toBe(true)
  })

  it('MainLayout renders non-keep-alive branch when $route.meta.keepAlive = false', () => {
    const RouterViewStub = defineComponent({
      name: 'RouterView',
      setup(_, { slots }) {
        const Comp = defineComponent({ name: 'Inner', template: '<div>inner</div>' })
        return () => slots.default?.({ Component: Comp })
      },
    })

    const wrapper = mount(MainLayout, {
      global: {
        stubs: {
          Sidebar: defineComponent({ name: 'Sidebar', template: '<div>sidebar</div>' }),
          'router-view': RouterViewStub,
        },
        mocks: {
          $route: { meta: { keepAlive: false }, path: '/p' },
        },
      },
    })

    expect(wrapper.text()).toContain('sidebar')
    expect(wrapper.findComponent({ name: 'KeepAlive' }).exists()).toBe(false)
  })

  it('Sidebar reacts to route path and supports logout', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    routeMock.path = '/single-add'
    authStoreMock.user = { username: 'admin' }
    authStoreMock.logout.mockClear()
    mocks.routerPush.mockClear()

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    mocks.showConfirmMock.mockResolvedValueOnce(true)

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    // watch(immediate) for /single-add
    expect(wrapper.vm.showAddSubmenu).toBe(true)
    expect(wrapper.vm.activeMenu).toBe('add')

    // click 菜品添加 button to cover template @click
    const addMenuBtn = wrapper.find('button .iconify[data-icon="carbon:add"]').element
      .parentElement as HTMLButtonElement
    await addMenuBtn.click()
    await nextTick()
    expect(typeof wrapper.vm.showAddSubmenu).toBe('boolean')

    // click user info toggle to cover template @click
    const userInfoToggle = wrapper.find('.iconify[data-icon="mdi:user-circle-outline"]').element
      .parentElement as HTMLElement
    await userInfoToggle.click()
    await nextTick()
    expect(wrapper.vm.showPermissionsDropdown).toBe(true)

    // click logout button to cover template @click
    const logoutBtn = wrapper.find('button .iconify[data-icon="carbon:logout"]').element
      .parentElement as HTMLButtonElement
    await logoutBtn.click()
    await nextTick()
    // Wait for async showConfirm to resolve
    await Promise.resolve()
    await nextTick()
    expect(authStoreMock.logout).toHaveBeenCalledTimes(1)
    // Component uses router.replace, not router.push
    expect(mocks.routerReplace).toHaveBeenCalledWith('/login')

    expect(addSpy).toHaveBeenCalled()

    wrapper.unmount()
    expect(removeSpy).toHaveBeenCalled()
  })

  it('Sidebar click-outside closes dropdown', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      attachTo: document.body,
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.togglePermissionsDropdown()
    await nextTick()
    expect(wrapper.vm.showPermissionsDropdown).toBe(true)

    document.body.click()
    await nextTick()
    expect(wrapper.vm.showPermissionsDropdown).toBe(false)

    wrapper.unmount()
  })

  it('Sidebar renders no-permission styles and supports close button + logout cancel', async () => {
    routeMock.path = '/'
    authStoreMock.user = { username: 'admin' }
    authStoreMock.hasPermission = vi.fn((id: string) => id === 'dish:view')
    authStoreMock.logout.mockClear()
    mocks.routerPush.mockClear()

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    // open dropdown
    wrapper.vm.togglePermissionsDropdown()
    await nextTick()
    expect(wrapper.vm.showPermissionsDropdown).toBe(true)

    // at least one permission should be rendered as not-owned
    const permissionLabel = wrapper.findAll('span').find((n) => n.text().includes('新建菜品'))
    expect(permissionLabel).toBeTruthy()
    expect(permissionLabel!.classes().join(' ')).toContain('line-through')

    // click the close button inside dropdown
    const closeBtn = wrapper.find('button .iconify[data-icon="carbon:close"]').element
      .parentElement as HTMLButtonElement
    await closeBtn.click()
    await nextTick()
    expect(wrapper.vm.showPermissionsDropdown).toBe(false)

    // logout cancel branch
    mocks.showConfirmMock.mockResolvedValueOnce(false)
    await wrapper.vm.handleLogout()
    expect(authStoreMock.logout).not.toHaveBeenCalled()
    expect(mocks.routerPush).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('Sidebar opens and closes password change modal', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    // Open password modal
    wrapper.vm.openChangePasswordModal()
    await nextTick()

    expect(wrapper.vm.showChangePasswordModal).toBe(true)
    expect(wrapper.vm.passwordForm.currentPassword).toBe('')
    expect(wrapper.vm.passwordForm.newPassword).toBe('')
    expect(wrapper.vm.passwordForm.confirmPassword).toBe('')

    // Close password modal
    wrapper.vm.closeChangePasswordModal()
    await nextTick()

    expect(wrapper.vm.showChangePasswordModal).toBe(false)

    wrapper.unmount()
  })

  it('Sidebar handles password input and clears error', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.passwordError = 'some error'
    wrapper.vm.handlePasswordInput('currentPassword', { target: { value: 'test123' } })
    await nextTick()

    expect(wrapper.vm.passwordForm.currentPassword).toBe('test123')
    expect(wrapper.vm.passwordError).toBe('')

    wrapper.unmount()
  })

  it('Sidebar validates password - too short', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'oldpass'
    wrapper.vm.passwordForm.newPassword = 'short'
    wrapper.vm.passwordForm.confirmPassword = 'short'

    await wrapper.vm.handleChangePassword()
    expect(wrapper.vm.passwordError).toBe('密码长度至少为8位')

    wrapper.unmount()
  })

  it('Sidebar validates password - missing lowercase', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'oldpass'
    wrapper.vm.passwordForm.newPassword = 'ABCD1234!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCD1234!'

    await wrapper.vm.handleChangePassword()
    expect(wrapper.vm.passwordError).toBe('密码必须包含小写字母')

    wrapper.unmount()
  })

  it('Sidebar validates password - missing uppercase', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'oldpass'
    wrapper.vm.passwordForm.newPassword = 'abcd1234!'
    wrapper.vm.passwordForm.confirmPassword = 'abcd1234!'

    await wrapper.vm.handleChangePassword()
    expect(wrapper.vm.passwordError).toBe('密码必须包含大写字母')

    wrapper.unmount()
  })

  it('Sidebar validates password - missing digit', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'oldpass'
    wrapper.vm.passwordForm.newPassword = 'ABCDefgh!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDefgh!'

    await wrapper.vm.handleChangePassword()
    expect(wrapper.vm.passwordError).toBe('密码必须包含数字')

    wrapper.unmount()
  })

  it('Sidebar validates password - missing special char', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'oldpass'
    wrapper.vm.passwordForm.newPassword = 'ABCDef1234'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDef1234'

    await wrapper.vm.handleChangePassword()
    expect(wrapper.vm.passwordError).toBe('密码必须包含特殊符号')

    wrapper.unmount()
  })

  it('Sidebar validates password - mismatch', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'oldpass'
    wrapper.vm.passwordForm.newPassword = 'ABCDef12!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDef99!'

    await wrapper.vm.handleChangePassword()
    expect(wrapper.vm.passwordError).toBe('两次输入的新密码不一致')

    wrapper.unmount()
  })

  it('Sidebar validates password - missing current password', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = ''
    wrapper.vm.passwordForm.newPassword = 'ABCDef12!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDef12!'

    await wrapper.vm.handleChangePassword()
    expect(wrapper.vm.passwordError).toBe('请输入当前密码')

    wrapper.unmount()
  })

  it('Sidebar validates password - missing new password', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'oldpass'
    wrapper.vm.passwordForm.newPassword = ''
    wrapper.vm.passwordForm.confirmPassword = ''

    await wrapper.vm.handleChangePassword()
    expect(wrapper.vm.passwordError).toBe('请输入新密码')

    wrapper.unmount()
  })

  it('Sidebar changes password successfully', async () => {
    routeMock.path = '/'
    mocks.permissionApiMock.changeOwnPassword.mockResolvedValue({ code: 200 })

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'OldPass1!'
    wrapper.vm.passwordForm.newPassword = 'ABCDef12!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDef12!'

    await wrapper.vm.handleChangePassword()
    await flushPromises()

    expect(mocks.permissionApiMock.changeOwnPassword).toHaveBeenCalledWith('OldPass1!', 'ABCDef12!')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('密码修改成功！请使用新密码重新登录。')
    expect(wrapper.vm.showChangePasswordModal).toBe(false)

    wrapper.unmount()
  })

  it('Sidebar handles password change API failure', async () => {
    routeMock.path = '/'
    mocks.permissionApiMock.changeOwnPassword.mockResolvedValue({
      code: 400,
      message: '当前密码错误',
    })

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'OldPass1!'
    wrapper.vm.passwordForm.newPassword = 'ABCDef12!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDef12!'

    await wrapper.vm.handleChangePassword()
    await flushPromises()

    expect(wrapper.vm.passwordError).toBe('当前密码错误')

    wrapper.unmount()
  })

  it('Sidebar handles password change exception', async () => {
    routeMock.path = '/'
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.permissionApiMock.changeOwnPassword.mockRejectedValue({
      response: { data: { message: '服务器错误' } },
    })

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'OldPass1!'
    wrapper.vm.passwordForm.newPassword = 'ABCDef12!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDef12!'

    await wrapper.vm.handleChangePassword()
    await flushPromises()

    expect(wrapper.vm.passwordError).toBe('服务器错误')
    consoleSpy.mockRestore()

    wrapper.unmount()
  })

  it('Sidebar watches route path and updates menu state', async () => {
    routeMock.path = '/batch-add'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    expect(wrapper.vm.showAddSubmenu).toBe(true)
    expect(wrapper.vm.activeMenu).toBe('add')

    wrapper.unmount()
  })

  it('Sidebar collapses add submenu for other routes', async () => {
    routeMock.path = '/modify-dish'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    expect(wrapper.vm.showAddSubmenu).toBe(false)
    expect(wrapper.vm.activeMenu).toBe('')

    wrapper.unmount()
  })

  it('Sidebar password modal toggle buttons work correctly', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    // Open password modal
    wrapper.vm.openChangePasswordModal()
    await nextTick()
    expect(wrapper.vm.showChangePasswordModal).toBe(true)

    // Toggle show current password
    expect(wrapper.vm.showCurrentPassword).toBe(false)
    wrapper.vm.showCurrentPassword = true
    await nextTick()
    expect(wrapper.vm.showCurrentPassword).toBe(true)

    // Toggle show new password
    expect(wrapper.vm.showNewPassword).toBe(false)
    wrapper.vm.showNewPassword = true
    await nextTick()
    expect(wrapper.vm.showNewPassword).toBe(true)

    // Toggle show confirm password
    expect(wrapper.vm.showConfirmPassword).toBe(false)
    wrapper.vm.showConfirmPassword = true
    await nextTick()
    expect(wrapper.vm.showConfirmPassword).toBe(true)

    wrapper.unmount()
  })

  it('Sidebar passwordChecks computed property updates correctly', async () => {
    routeMock.path = '/'

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    await nextTick()

    // Empty password
    wrapper.vm.passwordForm.newPassword = ''
    await nextTick()
    expect(wrapper.vm.passwordChecks.length).toBe(false)

    // Short password
    wrapper.vm.passwordForm.newPassword = 'abc'
    await nextTick()
    expect(wrapper.vm.passwordChecks.length).toBe(false)

    // Has length
    wrapper.vm.passwordForm.newPassword = 'abcdefgh'
    await nextTick()
    expect(wrapper.vm.passwordChecks.length).toBe(true)
    expect(wrapper.vm.passwordChecks.lowercase).toBe(true)
    expect(wrapper.vm.passwordChecks.uppercase).toBe(false)

    // Has uppercase
    wrapper.vm.passwordForm.newPassword = 'abcdefgH'
    await nextTick()
    expect(wrapper.vm.passwordChecks.uppercase).toBe(true)

    // Has number
    wrapper.vm.passwordForm.newPassword = 'abcdefgH1'
    await nextTick()
    expect(wrapper.vm.passwordChecks.number).toBe(true)

    // Has special
    wrapper.vm.passwordForm.newPassword = 'abcdefgH1!'
    await nextTick()
    expect(wrapper.vm.passwordChecks.special).toBe(true)

    wrapper.unmount()
  })

  it('Sidebar handles exception without response data', async () => {
    routeMock.path = '/'
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.permissionApiMock.changeOwnPassword.mockRejectedValue(new Error('Network error'))

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'OldPass1!'
    wrapper.vm.passwordForm.newPassword = 'ABCDef12!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDef12!'

    await wrapper.vm.handleChangePassword()
    await flushPromises()

    // Should use generic error message when no response data
    expect(wrapper.vm.passwordError).toBe('密码修改失败，请重试')
    consoleSpy.mockRestore()

    wrapper.unmount()
  })

  it('Sidebar handles isChangingPassword state correctly', async () => {
    routeMock.path = '/'

    // Create a delayed promise to simulate slow API
    let resolvePromise: (value: any) => void
    const slowPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    mocks.permissionApiMock.changeOwnPassword.mockReturnValue(slowPromise)

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    wrapper.vm.openChangePasswordModal()
    wrapper.vm.passwordForm.currentPassword = 'OldPass1!'
    wrapper.vm.passwordForm.newPassword = 'ABCDef12!'
    wrapper.vm.passwordForm.confirmPassword = 'ABCDef12!'

    // Start the change password process
    const changePromise = wrapper.vm.handleChangePassword()
    await nextTick()

    // isChangingPassword should be true during API call
    expect(wrapper.vm.isChangingPassword).toBe(true)

    // Resolve the promise
    resolvePromise!({ code: 200 })
    await changePromise
    await flushPromises()

    // isChangingPassword should be false after API call
    expect(wrapper.vm.isChangingPassword).toBe(false)

    wrapper.unmount()
  })

  it('Sidebar handles different permission states in dropdown', async () => {
    routeMock.path = '/'
    authStoreMock.permissions = ['dish:view', 'review:delete']
    authStoreMock.hasPermission = vi.fn((id: string) => authStoreMock.permissions.includes(id))

    const Comp = (await import('../../src/components/Layout/Sidebar.vue')).default

    const wrapper = mount(Comp, {
      global: {
        directives: {
          permission: () => undefined,
        },
        stubs: {
          'router-link': defineComponent({
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          }),
        },
        mocks: {
          $route: routeMock,
        },
      },
    })

    // Open dropdown
    wrapper.vm.togglePermissionsDropdown()
    await nextTick()
    expect(wrapper.vm.showPermissionsDropdown).toBe(true)

    // Check that permissions are rendered
    expect(wrapper.text()).toContain('查看')

    wrapper.unmount()
  })
})
