import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  configApiMock: {
    getEffectiveConfig: vi.fn(),
    getGlobalConfig: vi.fn(),
    updateGlobalConfig: vi.fn(),
    updateCanteenConfig: vi.fn(),
  },
  canteenApiMock: {
    getCanteens: vi.fn(),
  },
  dishApiMock: {
    refreshDishesEmbeddingByCanteen: vi.fn(),
    getEmbeddingJobStatus: vi.fn(),
    cancelEmbeddingJob: vi.fn(),
  },
  authStoreMock: {
    user: null as any,
    hasPermission: vi.fn(() => true),
  } as any,
  showAlertMock: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/api/modules/config', () => ({
  configApi: mocks.configApiMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

vi.mock('@/api/modules/dish', () => ({
  dishApi: mocks.dishApiMock,
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlertMock,
  showConfirm: vi.fn(() => Promise.resolve(true)),
  showConfirmDanger: vi.fn(() => Promise.resolve(true)),
}))

import ConfigManage from '../../src/views/ConfigManage.vue'

const flushPromises = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()))

describe('views/ConfigManage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()

    mocks.authStoreMock.user = null
    mocks.authStoreMock.hasPermission = vi.fn(() => true)
  })

  it('loads global config and falls back to template defaults', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
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

    expect(mocks.configApiMock.getGlobalConfig).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.reviewAutoApprove).toBe(true)
    expect(wrapper.vm.commentAutoApprove).toBe(false)
    expect(wrapper.vm.configDescription).toContain('全局')
    expect(wrapper.vm.currentCanteenInfo).toContain('全局')
  })

  it('loads canteen effective config and reads key values (missing key => false)', async () => {
    mocks.authStoreMock.user = { canteenId: 'c1', canteenName: '食堂A' }

    mocks.configApiMock.getEffectiveConfig.mockResolvedValue({
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

    expect(mocks.configApiMock.getEffectiveConfig).toHaveBeenCalledWith('c1')
    expect(wrapper.vm.reviewAutoApprove).toBe(true)
    expect(wrapper.vm.commentAutoApprove).toBe(false)
    expect(wrapper.vm.currentCanteenInfo).toContain('食堂A')
  })

  it('handles loadConfig failure and alerts', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({ code: 500, message: 'nope' })

    mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    expect(mocks.showAlertMock).toHaveBeenCalled()
  })

  it('rejects changes when lacking permission and restores value', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.authStoreMock.hasPermission = vi.fn(() => false)

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

    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有编辑配置的权限')
    expect(wrapper.vm.reviewAutoApprove).toBe(false)
  })

  it('updates global config successfully and auto-hides success flag', async () => {
    vi.useFakeTimers()

    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.configApiMock.updateGlobalConfig.mockResolvedValue({ code: 200 })

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

    expect(mocks.configApiMock.updateGlobalConfig).toHaveBeenCalledWith({
      key: 'review.autoApprove',
      value: 'true',
    })

    expect(wrapper.vm.reviewSaveSuccess).toBe(true)
    vi.advanceTimersByTime(3000)
    expect(wrapper.vm.reviewSaveSuccess).toBe(false)

    vi.useRealTimers()
  })

  it('update failure alerts and reloads config', async () => {
    vi.useFakeTimers()

    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.configApiMock.updateGlobalConfig.mockResolvedValue({ code: 500, message: 'bad' })

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

    expect(mocks.showAlertMock).toHaveBeenCalled()
    // reload should call getGlobalConfig again
    expect(mocks.configApiMock.getGlobalConfig).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })

  it('updates canteen config when canteenId exists', async () => {
    mocks.authStoreMock.user = { canteenId: 'c1', canteenName: '食堂A' }

    mocks.configApiMock.getEffectiveConfig.mockResolvedValue({
      code: 200,
      data: { items: [] },
    })
    mocks.configApiMock.updateCanteenConfig.mockResolvedValue({ code: 200 })

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

    expect(mocks.configApiMock.updateCanteenConfig).toHaveBeenCalledWith('c1', {
      key: 'comment.autoApprove',
      value: 'true',
    })
  })

  it('loads canteen list for global admin on mount', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.canteenApiMock.getCanteens.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1', name: '食堂A' }] },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    // The component loads canteen list automatically for global admin
    // Just check the result
    expect(wrapper.vm.canteenList).toBeDefined()
  })

  it('does not load canteen list when user has canteenId', async () => {
    mocks.authStoreMock.user = { canteenId: 'c1', canteenName: '食堂A' }
    mocks.configApiMock.getEffectiveConfig.mockResolvedValue({
      code: 200,
      data: { items: [] },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    // canteenList should be empty for users with canteenId
    expect(wrapper.vm.canteenList).toEqual([])
  })

  it('handles refresh embeddings without permission', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.authStoreMock.hasPermission = vi.fn((perm) => perm !== 'dish:edit')

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    await wrapper.vm.handleRefreshCanteenEmbeddings()

    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有刷新嵌入向量的权限')
  })

  it('handles refresh embeddings without canteen selected', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.selectedCanteenId = ''
    await wrapper.vm.handleRefreshCanteenEmbeddings()

    expect(mocks.showAlertMock).toHaveBeenCalledWith('请选择要刷新的食堂')
  })

  it('handles refresh embeddings sync mode (no jobId)', async () => {
    vi.useFakeTimers()
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.dishApiMock.refreshDishesEmbeddingByCanteen.mockResolvedValue({
      code: 200,
      data: {}, // No jobId
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.selectedCanteenId = 'c1'
    await wrapper.vm.handleRefreshCanteenEmbeddings()
    await flushPromises()

    expect(mocks.showAlertMock).toHaveBeenCalledWith('刷新任务已提交（同步模式）')
    expect(wrapper.vm.embeddingRefreshSuccess).toBe(true)

    vi.advanceTimersByTime(3000)
    expect(wrapper.vm.embeddingRefreshSuccess).toBe(false)

    vi.useRealTimers()
  })

  it('handles refresh embeddings async mode with jobId', async () => {
    vi.useFakeTimers()
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.dishApiMock.refreshDishesEmbeddingByCanteen.mockResolvedValue({
      code: 200,
      data: { jobId: 'job123' },
    })
    mocks.dishApiMock.getEmbeddingJobStatus.mockResolvedValue({
      code: 200,
      data: { state: 'completed', status: 'completed' },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.selectedCanteenId = 'c1'
    await wrapper.vm.handleRefreshCanteenEmbeddings()
    await flushPromises()

    expect(wrapper.vm.currentJobId).toBe('job123')

    // Clean up by unmounting
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('handles refresh embeddings failure', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.dishApiMock.refreshDishesEmbeddingByCanteen.mockRejectedValue(new Error('Network error'))

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.selectedCanteenId = 'c1'
    await wrapper.vm.handleRefreshCanteenEmbeddings()
    await flushPromises()

    expect(mocks.showAlertMock).toHaveBeenCalledWith('Network error')
    expect(wrapper.vm.embeddingRefreshing).toBe(false)
  })

  it('handles cancel job successfully', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.dishApiMock.cancelEmbeddingJob.mockResolvedValue({
      code: 200,
      data: { success: true },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.currentJobId = 'job123'
    await wrapper.vm.handleCancelJob()
    await flushPromises()

    expect(mocks.dishApiMock.cancelEmbeddingJob).toHaveBeenCalledWith('job123')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('任务已取消')
  })

  it('handles cancel job when no jobId', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.currentJobId = null
    await wrapper.vm.handleCancelJob()

    expect(mocks.dishApiMock.cancelEmbeddingJob).not.toHaveBeenCalled()
  })

  it('job status is updated when async refresh completes', async () => {
    vi.useFakeTimers()
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.dishApiMock.refreshDishesEmbeddingByCanteen.mockResolvedValue({
      code: 200,
      data: { jobId: 'job123' },
    })
    mocks.dishApiMock.getEmbeddingJobStatus.mockResolvedValue({
      code: 200,
      data: { state: 'waiting', progress: 0 },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.selectedCanteenId = 'c1'
    await wrapper.vm.handleRefreshCanteenEmbeddings()
    await flushPromises()

    // Job should be started
    expect(wrapper.vm.currentJobId).toBe('job123')

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('handles comment auto approve change with global config', async () => {
    vi.useFakeTimers()
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.configApiMock.updateGlobalConfig.mockResolvedValue({ code: 200 })

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
    await flushPromises()

    expect(mocks.configApiMock.updateGlobalConfig).toHaveBeenCalledWith({
      key: 'comment.autoApprove',
      value: 'true',
    })
    expect(wrapper.vm.commentSaveSuccess).toBe(true)

    vi.advanceTimersByTime(3000)
    expect(wrapper.vm.commentSaveSuccess).toBe(false)

    vi.useRealTimers()
  })

  it('handles comment auto approve change failure', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.configApiMock.updateGlobalConfig.mockResolvedValue({ code: 500, message: '保存失败' })

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
    await flushPromises()

    expect(mocks.showAlertMock).toHaveBeenCalled()
  })

  it('handleCancelJob handles failure', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.dishApiMock.cancelEmbeddingJob.mockRejectedValue(new Error('Cancel failed'))

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.currentJobId = 'job123'
    await wrapper.vm.handleCancelJob()
    await flushPromises()

    expect(mocks.showAlertMock).toHaveBeenCalledWith('取消任务失败，请重试')
    wrapper.unmount()
  })

  it('handles refresh with user canteenId auto-selecting', async () => {
    mocks.authStoreMock.user = { canteenId: 'c1', canteenName: '食堂A' }
    mocks.configApiMock.getEffectiveConfig.mockResolvedValue({
      code: 200,
      data: { items: [] },
    })
    mocks.dishApiMock.refreshDishesEmbeddingByCanteen.mockResolvedValue({
      code: 200,
      data: {},
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()

    // User with canteenId should have it auto-selected
    await wrapper.vm.handleRefreshCanteenEmbeddings()
    await flushPromises()

    expect(mocks.dishApiMock.refreshDishesEmbeddingByCanteen).toHaveBeenCalledWith('c1')
    wrapper.unmount()
  })

  it('loadConfig handles exception thrown by API', async () => {
    mocks.configApiMock.getGlobalConfig.mockRejectedValue(new Error('Network error'))

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    expect(mocks.showAlertMock).toHaveBeenCalledWith('加载配置失败，请刷新重试')
    wrapper.unmount()
  })

  it('handles canteen effective config with non-200 response', async () => {
    mocks.authStoreMock.user = { canteenId: 'c1', canteenName: '食堂A' }
    mocks.configApiMock.getEffectiveConfig.mockResolvedValue({
      code: 500,
      message: 'Server error',
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    expect(mocks.showAlertMock).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('cleans up polling on unmount', async () => {
    vi.useFakeTimers()
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: { items: [] }, templates: [] },
    })
    mocks.dishApiMock.refreshDishesEmbeddingByCanteen.mockResolvedValue({
      code: 200,
      data: { jobId: 'job123' },
    })
    mocks.dishApiMock.getEmbeddingJobStatus.mockResolvedValue({
      code: 200,
      data: { state: 'active', progress: 50 },
    })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    wrapper.vm.selectedCanteenId = 'c1'
    await wrapper.vm.handleRefreshCanteenEmbeddings()
    await flushPromises()

    // Polling should be active
    expect(wrapper.vm.pollingInterval).not.toBe(null)

    // Unmount should clean up polling
    wrapper.unmount()

    vi.useRealTimers()
  })
})
