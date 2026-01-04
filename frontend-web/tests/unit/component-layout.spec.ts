import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

import Header from '../../src/components/Layout/Header.vue'
import MainLayout from '../../src/components/Layout/MainLayout.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  showConfirmMock: vi.fn(() => Promise.resolve(true)),
  showAlertMock: vi.fn(() => Promise.resolve()),
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
})
