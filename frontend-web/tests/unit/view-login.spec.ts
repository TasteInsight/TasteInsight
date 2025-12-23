import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

import Login from '../../src/views/Login.vue'

const flushPromises = () => new Promise((resolve) => queueMicrotask(resolve))

const routerMock = {
  push: vi.fn(),
  currentRoute: ref({ query: {} as Record<string, unknown> }),
}

const authStoreMock = {
  login: vi.fn(async () => undefined),
  hasPermission: vi.fn(() => true),
}

vi.mock('vue-router', () => ({
  useRouter: () => routerMock,
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => authStoreMock,
}))

describe('views/Login', () => {
  beforeEach(() => {
    routerMock.push.mockReset()
    routerMock.currentRoute.value = { query: {} }
    authStoreMock.login = vi.fn(async () => undefined)
    authStoreMock.hasPermission = vi.fn(() => true)
    sessionStorage.clear()
  })

  it('validates empty username/password and short password', async () => {
    const wrapper = mount(Login)

    // empty
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('请输入用户名')

    // username ok, password empty
    wrapper.vm.loginForm.username = 'u'
    wrapper.vm.loginForm.password = ''
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('请输入密码')

    // short password
    wrapper.vm.loginForm.password = '123'
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('至少为6位')
  })

  it('shows/hides forgot password modal', async () => {
    const wrapper = mount(Login)
    expect(wrapper.vm.showForgotPasswordModal).toBe(false)

    await wrapper.find('a').trigger('click')
    expect(wrapper.vm.showForgotPasswordModal).toBe(true)

    wrapper.vm.closeForgotPasswordModal()
    await flushPromises()
    expect(wrapper.vm.showForgotPasswordModal).toBe(false)
  })

  it('login success uses query redirect first', async () => {
    routerMock.currentRoute.value = { query: { redirect: '/target' } }
    authStoreMock.hasPermission = vi.fn(() => false)

    const wrapper = mount(Login)
    wrapper.vm.loginForm.username = 'u'
    wrapper.vm.loginForm.password = '123456'

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(authStoreMock.login).toHaveBeenCalled()
    expect(routerMock.push).toHaveBeenCalledWith('/target')
  })

  it('login success uses sessionStorage redirect when query missing', async () => {
    sessionStorage.setItem('login_redirect', '/from-storage')

    const wrapper = mount(Login)
    wrapper.vm.loginForm.username = 'u'
    wrapper.vm.loginForm.password = '123456'

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(routerMock.push).toHaveBeenCalledWith('/from-storage')
    expect(sessionStorage.getItem('login_redirect')).toBe(null)
  })

  it('login success picks first allowed route by permission priority', async () => {
    // allow only news:view so it should jump to /news-manage
    authStoreMock.hasPermission = vi.fn((p: string) => p === 'news:view')

    const wrapper = mount(Login)
    wrapper.vm.loginForm.username = 'u'
    wrapper.vm.loginForm.password = '123456'

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(routerMock.push).toHaveBeenCalledWith('/news-manage')
  })

  it('login failure shows error modal and clearLoginError clears state', async () => {
    authStoreMock.login = vi.fn(async () => {
      throw new Error('bad')
    })

    const wrapper = mount(Login)
    wrapper.vm.loginForm.username = 'u'
    wrapper.vm.loginForm.password = '123456'

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.vm.showErrorModal).toBe(true)
    expect(wrapper.vm.loginError).toContain('用户名或密码错误')
    expect(wrapper.vm.errors.username).toContain('用户名或密码错误')

    wrapper.vm.closeErrorModal()
    expect(wrapper.vm.showErrorModal).toBe(false)

    // clear on input
    wrapper.vm.loginError = 'x'
    wrapper.vm.errors.username = 'x'
    wrapper.vm.errors.password = 'x'
    wrapper.vm.clearLoginError()
    expect(wrapper.vm.loginError).toBe('')
    expect(wrapper.vm.errors.username).toBe('')
    expect(wrapper.vm.errors.password).toBe('')
  })
})
