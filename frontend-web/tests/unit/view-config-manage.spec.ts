import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import ConfigManage from '../../src/views/ConfigManage.vue'

const flushPromises = () => new Promise((resolve) => queueMicrotask(resolve))

const { configApiMock, authStoreMock } = vi.hoisted(() => {
  return {
    configApiMock: {
      getEffectiveConfig: vi.fn(),
      getGlobalConfig: vi.fn(),
      updateGlobalConfig: vi.fn(),
      updateCanteenConfig: vi.fn(),
    },
    authStoreMock: {
      user: null as any,
      hasPermission: vi.fn(() => true),
    } as any,
  }
})

vi.mock('@/api/modules/config', () => ({
  configApi: configApiMock,
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => authStoreMock,
}))

describe('views/ConfigManage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    configApiMock.getEffectiveConfig.mockReset()
    configApiMock.getGlobalConfig.mockReset()
    configApiMock.updateGlobalConfig.mockReset()
    configApiMock.updateCanteenConfig.mockReset()

    authStoreMock.user = null
    authStoreMock.hasPermission = vi.fn(() => true)
  })

  it('loads global config and falls back to template defaults', async () => {
    configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: {
        config: { items: [] },
        templates: [
          { key: 'review.autoApprove', defaultValue: 'true' },
          { key: 'comment.autoApprove', defaultValue: 'false' },
        ],
      },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()

    expect(configApiMock.getGlobalConfig).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.reviewAutoApprove).toBe(true)
    expect(wrapper.vm.commentAutoApprove).toBe(false)
    expect(wrapper.vm.configDescription).toContain('全局')
    expect(wrapper.vm.currentCanteenInfo).toContain('全局')
  })

  it('loads canteen effective config and reads key values (missing key => false)', async () => {
    authStoreMock.user = { canteenId: 'c1', canteenName: '食堂A' }

    configApiMock.getEffectiveConfig.mockResolvedValue({
      code: 200,
      data: {
        items: [
          { key: 'review.autoApprove', value: 'true' },
          // comment.autoApprove missing
        ],
      },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()

    expect(configApiMock.getEffectiveConfig).toHaveBeenCalledWith('c1')
    expect(wrapper.vm.reviewAutoApprove).toBe(true)
    expect(wrapper.vm.commentAutoApprove).toBe(false)
    expect(wrapper.vm.currentCanteenInfo).toContain('食堂A')
  })

  it('handles loadConfig failure and alerts', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    configApiMock.getGlobalConfig.mockResolvedValue({ code: 500, message: 'nope' })

    mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    expect(alertSpy).toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('rejects changes when lacking permission and restores value', async () => {
    configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    authStoreMock.hasPermission = vi.fn(() => false)

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()

    // force value change then handler should flip it back
    wrapper.vm.reviewAutoApprove = true
    await wrapper.vm.handleReviewAutoApproveChange()

    expect(alertSpy).toHaveBeenCalledWith('您没有编辑配置的权限')
    expect(wrapper.vm.reviewAutoApprove).toBe(false)

    alertSpy.mockRestore()
  })

  it('updates global config successfully and auto-hides success flag', async () => {
    vi.useFakeTimers()

    configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    configApiMock.updateGlobalConfig.mockResolvedValue({ code: 200 })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()

    wrapper.vm.reviewAutoApprove = true
    const p = wrapper.vm.handleReviewAutoApproveChange()
    await flushPromises()
    await p

    expect(configApiMock.updateGlobalConfig).toHaveBeenCalledWith({
      key: 'review.autoApprove',
      value: 'true',
    })

    expect(wrapper.vm.saveSuccess).toBe(true)
    vi.advanceTimersByTime(3000)
    expect(wrapper.vm.saveSuccess).toBe(false)

    vi.useRealTimers()
  })

  it('update failure alerts and reloads config', async () => {
    vi.useFakeTimers()

    configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    configApiMock.updateGlobalConfig.mockResolvedValue({ code: 500, message: 'bad' })

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()

    wrapper.vm.reviewAutoApprove = true
    await wrapper.vm.handleReviewAutoApproveChange()

    expect(alertSpy).toHaveBeenCalled()
    // reload should call getGlobalConfig again
    expect(configApiMock.getGlobalConfig).toHaveBeenCalledTimes(2)

    alertSpy.mockRestore()
    vi.useRealTimers()
  })

  it('updates canteen config when canteenId exists', async () => {
    authStoreMock.user = { canteenId: 'c1', canteenName: '食堂A' }

    configApiMock.getEffectiveConfig.mockResolvedValue({
      code: 200,
      data: { items: [] },
    })
    configApiMock.updateCanteenConfig.mockResolvedValue({ code: 200 })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()

    wrapper.vm.commentAutoApprove = true
    await wrapper.vm.handleCommentAutoApproveChange()

    expect(configApiMock.updateCanteenConfig).toHaveBeenCalledWith('c1', {
      key: 'comment.autoApprove',
      value: 'true',
    })
  })
})
