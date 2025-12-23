import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'

import LogView from '@/views/LogView.vue'

const { getLogsMock } = vi.hoisted(() => ({
  getLogsMock: vi.fn(),
}))

vi.mock('@/api/modules/log', () => ({
  logApi: {
    getLogs: getLogsMock,
  },
}))

const flushAll = async () => {
  await new Promise((resolve) => queueMicrotask(resolve))
  await new Promise((resolve) => queueMicrotask(resolve))
  await nextTick()
}

const baseMountOptions = {
  global: {
    stubs: {
      Header: defineComponent({ name: 'HeaderStub', template: '<div />' }),
      Transition: false,
      'transition-group': false,
    },
  },
}

describe('views/LogView', () => {
  beforeEach(() => {
    getLogsMock.mockReset()
  })

  it('loads logs on mount; supports filters; apply/reset reload', async () => {
    getLogsMock.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          {
            id: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
            adminId: 'a1',
            adminName: 'admin',
            action: 'create',
            resource: 'dish',
            resourceId: 'd1',
            ipAddress: '127.0.0.1',
            details: '{"k":"v"}',
          },
        ],
        meta: { totalPages: 3 },
      },
    })

    const wrapper = mount(LogView, baseMountOptions)
    await flushAll()

    expect(getLogsMock).toHaveBeenCalledTimes(1)
    expect(getLogsMock).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    expect(wrapper.vm.logs).toHaveLength(1)
    expect(wrapper.vm.totalPages).toBe(3)

    // applyFilters adds non-empty filters and resets page
    wrapper.vm.currentPage = 5
    wrapper.vm.filters.adminId = '100'
    wrapper.vm.filters.action = 'delete'
    wrapper.vm.filters.startDate = '2025-01-01'
    wrapper.vm.filters.endDate = '2025-01-31'

    getLogsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 1 } } })

    wrapper.vm.applyFilters()
    await flushAll()

    expect(getLogsMock).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      adminId: '100',
      action: 'delete',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    })

    // resetFilters clears and reloads
    getLogsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 1 } } })

    wrapper.vm.resetFilters()
    await flushAll()

    expect(wrapper.vm.filters.adminId).toBe('')
    expect(wrapper.vm.filters.action).toBe('')
    expect(wrapper.vm.filters.startDate).toBe('')
    expect(wrapper.vm.filters.endDate).toBe('')
    expect(wrapper.vm.currentPage).toBe(1)

    wrapper.unmount()
  })

  it('loadLogs handles non-200 and thrown errors: alerts and clears list', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    getLogsMock.mockResolvedValueOnce({ code: 500, message: 'bad' })

    const wrapper = mount(LogView, baseMountOptions)
    await flushAll()

    expect(alertSpy).toHaveBeenCalledWith('加载日志列表失败，请刷新重试')
    expect(wrapper.vm.logs).toEqual([])

    getLogsMock.mockRejectedValueOnce(new Error('boom'))

    await wrapper.vm.loadLogs()
    await flushAll()

    expect(alertSpy).toHaveBeenCalledWith('加载日志列表失败，请刷新重试')
    expect(wrapper.vm.logs).toEqual([])

    wrapper.unmount()
    alertSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('changePage validates bounds and reloads only when valid', async () => {
    getLogsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 3 } } })

    const wrapper = mount(LogView, baseMountOptions)
    await flushAll()

    expect(wrapper.vm.totalPages).toBe(3)

    getLogsMock.mockClear()

    wrapper.vm.changePage(0)
    wrapper.vm.changePage(4)
    await flushAll()

    expect(getLogsMock).not.toHaveBeenCalled()

    getLogsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 3 } } })

    wrapper.vm.changePage(2)
    await flushAll()

    expect(wrapper.vm.currentPage).toBe(2)
    expect(getLogsMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('viewLogDetail/closeLogDetail toggles selectedLog', async () => {
    getLogsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 1 } } })

    const wrapper = mount(LogView, baseMountOptions)
    await flushAll()

    const log = { id: 9, createdAt: '2025-01-01T00:00:00.000Z', adminId: 'a1', action: 'view' }

    wrapper.vm.viewLogDetail(log)
    await flushAll()

    expect(wrapper.vm.selectedLog).toEqual(log)

    wrapper.vm.closeLogDetail()
    await flushAll()

    expect(wrapper.vm.selectedLog).toBe(null)

    wrapper.unmount()
  })

  it('helpers: formatDateTime/getActionLabel/getActionClass cover known/unknown branches', async () => {
    getLogsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 1 } } })

    const wrapper = mount(LogView, baseMountOptions)
    await flushAll()

    expect(wrapper.vm.formatDateTime('')).toBe('-')
    expect(wrapper.vm.formatDateTime(null as any)).toBe('-')
    expect(typeof wrapper.vm.formatDateTime('2025-01-01T00:00:00.000Z')).toBe('string')

    expect(wrapper.vm.getActionLabel('create')).toBe('创建')
    expect(wrapper.vm.getActionLabel('logout')).toBe('退出')
    expect(wrapper.vm.getActionLabel('weird')).toBe('weird')

    expect(wrapper.vm.getActionClass('delete')).toContain('bg-red')
    expect(wrapper.vm.getActionClass('login')).toContain('bg-purple')
    expect(wrapper.vm.getActionClass('weird')).toBe('bg-gray-100 text-gray-800')

    wrapper.unmount()
  })

  it('onActivated reloads when kept-alive and re-activated', async () => {
    getLogsMock.mockResolvedValue({ code: 200, data: { items: [], meta: { totalPages: 1 } } })

    const Parent = defineComponent({
      name: 'ParentKeepAlive',
      components: { LogView },
      setup() {
        const show = ref(true)
        return { show }
      },
      template: '<KeepAlive><LogView v-if="show" /></KeepAlive>',
    })

    const wrapper = mount(Parent, baseMountOptions)
    await flushAll()

    const callsAfterMount = getLogsMock.mock.calls.length
    expect(callsAfterMount).toBeGreaterThanOrEqual(1)

    // deactivate + activate again
    ;(wrapper.vm as any).show = false
    await flushAll()
    ;(wrapper.vm as any).show = true
    await flushAll()

    expect(getLogsMock.mock.calls.length).toBeGreaterThan(callsAfterMount)

    wrapper.unmount()
  })
})
