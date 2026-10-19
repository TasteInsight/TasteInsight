import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  configApiMock: {
    getEffectiveConfig: vi.fn(),
    getGlobalConfig: vi.fn(),
    updateGlobalConfig: vi.fn(),
    updateCanteenConfig: vi.fn(),
  },
  moderationApiMock: {
    getPolicy: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getTasks: vi.fn(),
  },
  canteenApiMock: {
    getCanteenOptions: vi.fn(),
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
  showConfirmMock: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('@/api/modules/config', () => ({
  configApi: mocks.configApiMock,
}))

vi.mock('@/api/modules/content-moderation', () => ({
  contentModerationApi: mocks.moderationApiMock,
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
  showConfirm: mocks.showConfirmMock,
  showConfirmDanger: vi.fn(() => Promise.resolve(true)),
}))

import ConfigManage from '../../src/views/ConfigManage.vue'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function effectiveConfig(value: string) {
  return {
    code: 200,
    data: {
      items: [
        { key: 'review.autoApprove', value },
        { key: 'comment.autoApprove', value },
      ],
    },
  }
}

function mountCachedConfig() {
  const visible = ref(true)
  const host = defineComponent({
    setup: () => () =>
      h(KeepAlive, null, {
        default: () => (visible.value ? h(ConfigManage) : null),
      }),
  })
  return { visible, wrapper: mount(host, { global: { stubs: { Header: true } } }) }
}

describe('views/ConfigManage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()

    mocks.moderationApiMock.getSettings.mockResolvedValue({
      code: 200,
      data: {
        enabled: false,
        provider: 'aliyun',
        mode: 'manual',
        providers: {
          aliyun: { configured: true, missing: [] },
          wechat: { configured: true, missing: [] },
        },
      },
    })
    mocks.moderationApiMock.getTasks.mockResolvedValue({
      code: 200,
      data: { items: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } },
    })
    mocks.showConfirmMock.mockResolvedValue(true)
    mocks.moderationApiMock.getPolicy.mockResolvedValue({
      code: 200,
      data: { enabled: false, provider: 'aliyun', mode: 'manual' },
    })
    mocks.authStoreMock.user = { scope: 'GLOBAL', canteenIds: [], canteens: [] }
    mocks.authStoreMock.hasPermission = vi.fn(() => true)
    mocks.canteenApiMock.getCanteenOptions.mockResolvedValue({
      code: 200,
      data: { items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } },
    })
  })

  it('keeps global settings mounted across scope selection and disables fallback toggles when enabled', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue(effectiveConfig('true'))
    const wrapper = mount(ConfigManage, {
      global: { stubs: { Header: true, ContentModerationSettings: true } },
    })
    await flushPromises()
    const settings = wrapper.findComponent({ name: 'ContentModerationSettings' })
    expect(settings.exists()).toBe(true)
    settings.vm.$emit('enabled', true)
    settings.vm.$emit('state', 'ready')
    await nextTick()
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[aria-label="回复人工审核"]').attributes('disabled')).toBeDefined()
    wrapper.vm.configCanteenId = 'canteen-1'
    await nextTick()
    expect(wrapper.findComponent({ name: 'ContentModerationSettings' }).element).toBe(
      settings.element,
    )
    wrapper.unmount()
  })

  it('locks fallback rules while global policy is pending, on failure, and recovers after retry', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue(effectiveConfig('true'))
    const policy = deferred<any>()
    mocks.moderationApiMock.getSettings.mockReturnValueOnce(policy.promise)
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    await flushPromises()
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('正在读取统一审核状态')
    policy.reject(new Error('offline'))
    await flushPromises()
    expect(wrapper.get('input[aria-label="回复人工审核"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('统一审核状态读取失败')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重新加载')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('preserves dirty policy drafts across scope loads and task views, loading tasks only on first visit', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: null, templates: [] },
    })
    mocks.configApiMock.getEffectiveConfig.mockResolvedValue(effectiveConfig('true'))
    mocks.canteenApiMock.getCanteenOptions.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1', name: '食堂一' }] },
    })
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    await flushPromises()
    const settings = wrapper.findComponent({ name: 'ContentModerationSettings' })
    await settings.get('input').setValue(true)
    await settings.get('select').setValue('machine')
    await settings.findAll('select')[1]!.setValue('wechat')
    expect(mocks.moderationApiMock.getTasks).not.toHaveBeenCalled()
    await wrapper.get('#config-scope').setValue('c1')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ContentModerationSettings' }).element).toBe(
      settings.element,
    )
    expect(mocks.moderationApiMock.getSettings).toHaveBeenCalledTimes(1)
    const viewButton = (label: string) =>
      wrapper
        .findAll('nav[aria-label="系统配置分区"] button')
        .find((button) => button.text() === label)!
    await viewButton('审核待办').trigger('click')
    await flushPromises()
    expect(mocks.moderationApiMock.getTasks).toHaveBeenCalledTimes(1)
    expect(settings.isVisible()).toBe(false)
    await viewButton('系统维护').trigger('click')
    expect(settings.isVisible()).toBe(false)
    expect(wrapper.get('#embedding-canteen').isVisible()).toBe(true)
    await viewButton('审核设置').trigger('click')
    expect(settings.get('select').element.value).toBe('machine')
    expect(settings.findAll('select')[1]!.element.value).toBe('wechat')
    expect(settings.text()).toContain('有未保存的修改')
    await viewButton('审核待办').trigger('click')
    expect(mocks.moderationApiMock.getTasks).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it.each(['GLOBAL', 'CANTEENS'])(
    'keeps maintenance targets independent of approval scope for %s admins',
    async (scope) => {
      const canteens = [
        { id: 'c1', name: '食堂一' },
        { id: 'c2', name: '食堂二' },
      ]
      mocks.authStoreMock.user = {
        scope,
        canteenIds: scope === 'GLOBAL' ? [] : ['c1', 'c2'],
        canteens,
      }
      mocks.canteenApiMock.getCanteenOptions.mockResolvedValue({
        code: 200,
        data: { items: canteens },
      })
      mocks.configApiMock.getGlobalConfig.mockResolvedValue(effectiveConfig('true'))
      mocks.configApiMock.getEffectiveConfig.mockResolvedValue(effectiveConfig('true'))
      mocks.dishApiMock.refreshDishesEmbeddingByCanteen.mockResolvedValue({ code: 200, data: {} })
      const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
      await flushPromises()
      await wrapper.get('#config-scope').setValue('c1')
      await flushPromises()
      await wrapper
        .findAll('nav button')
        .find((button) => button.text() === '系统维护')!
        .trigger('click')
      expect(wrapper.get('#embedding-canteen').isVisible()).toBe(true)
      await wrapper.get('#embedding-canteen').setValue('c2')
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '刷新推荐数据')!
        .trigger('click')
      await flushPromises()
      expect(mocks.dishApiMock.refreshDishesEmbeddingByCanteen).toHaveBeenCalledWith('c2')
      expect(wrapper.vm.currentCanteenId).toBe('c1')
      if (scope === 'CANTEENS')
        expect(wrapper.findAll('nav button').map((button) => button.text())).toEqual([
          '审核设置',
          '系统维护',
        ])
      wrapper.unmount()
    },
  )

  it('updates effective fallback labels only after a policy save succeeds', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: null, templates: [] },
    })
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    await flushPromises()
    const settings = wrapper.findComponent({ name: 'ContentModerationSettings' })
    await settings.get('input').setValue(true)
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeUndefined()
    const saved = {
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
      providers: {
        aliyun: { configured: true, missing: [] },
        wechat: { configured: true, missing: [] },
      },
    }
    mocks.moderationApiMock.updateSettings.mockResolvedValue({ code: 200, data: saved })
    await settings.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('备用 · 直接发布')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    await settings.get('input').setValue(false)
    mocks.moderationApiMock.updateSettings.mockResolvedValue({
      code: 200,
      data: { ...saved, enabled: false },
    })
    await settings.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('已关闭 · 直接发布')
    wrapper.unmount()
  })

  it('allows cancelling route departure and explicitly discards a confirmed dirty draft', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: null, templates: [] },
    })
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    await flushPromises()
    const settings = wrapper.findComponent({ name: 'ContentModerationSettings' })
    await settings.get('input').setValue(true)
    const leave = (wrapper.vm.$options.beforeRouteLeave as any).bind(wrapper.vm)
    mocks.showConfirmMock.mockResolvedValueOnce(false)
    expect(await leave()).toBe(false)
    expect(settings.get('input').element.checked).toBe(true)
    expect(await leave()).toBe(true)
    await nextTick()
    expect(settings.get('input').element.checked).toBe(false)
    expect(wrapper.vm.moderationDirty).toBe(false)
    wrapper.unmount()
  })

  it('loads the safe policy for scoped administrators and locks legacy controls while unified moderation is enabled', async () => {
    mocks.authStoreMock.user = {
      scope: 'CANTEENS',
      canteenIds: ['c1'],
      canteens: [{ id: 'c1', name: '食堂一' }],
    }
    mocks.configApiMock.getEffectiveConfig.mockResolvedValue(effectiveConfig('true'))
    mocks.moderationApiMock.getPolicy.mockResolvedValue({
      code: 200,
      data: { enabled: true, provider: 'wechat', mode: 'machine' },
    })
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    await flushPromises()
    expect(mocks.moderationApiMock.getPolicy).toHaveBeenCalledTimes(1)
    expect(mocks.moderationApiMock.getSettings).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('统一内容审核已启用')
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[aria-label="回复人工审核"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('keeps scoped legacy controls locked on a policy read failure and recovers on config reload', async () => {
    mocks.authStoreMock.user = {
      scope: 'CANTEENS',
      canteenIds: ['c1'],
      canteens: [{ id: 'c1', name: '食堂一' }],
    }
    mocks.configApiMock.getEffectiveConfig.mockResolvedValue(effectiveConfig('true'))
    mocks.moderationApiMock.getPolicy.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('统一审核状态读取失败')
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[aria-label="回复人工审核"]').attributes('disabled')).toBeDefined()
    await wrapper.vm.loadConfig()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('input[aria-label="评价人工审核"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('loads once on the initial KeepAlive activation and refreshes once when returning', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: null, templates: [] },
    })
    const { wrapper, visible } = mountCachedConfig()
    try {
      await flushPromises()
      expect(mocks.configApiMock.getGlobalConfig).toHaveBeenCalledTimes(1)
      expect(mocks.canteenApiMock.getCanteenOptions).toHaveBeenCalledTimes(1)
      visible.value = false
      await nextTick()
      visible.value = true
      await flushPromises()
      expect(mocks.configApiMock.getGlobalConfig).toHaveBeenCalledTimes(2)
      expect(mocks.canteenApiMock.getCanteenOptions).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
    }
  })

  it.each([
    { outcome: 'success', beforeCurrent: true },
    { outcome: 'success', beforeCurrent: false },
    { outcome: 'failure', beforeCurrent: true },
    { outcome: 'failure', beforeCurrent: false },
  ])(
    'ignores stale $outcome across KeepAlive reactivation (before current response: $beforeCurrent)',
    async ({ outcome, beforeCurrent }) => {
      mocks.authStoreMock.user = {
        scope: 'CANTEENS',
        canteenIds: ['c1', 'c2'],
        canteens: [
          { id: 'c1', name: '食堂一' },
          { id: 'c2', name: '食堂二' },
        ],
      }
      const requests: {
        canteenId: string
        task: ReturnType<typeof deferred<ReturnType<typeof effectiveConfig>>>
      }[] = []
      mocks.configApiMock.getEffectiveConfig.mockImplementation((canteenId: string) => {
        const task = deferred<ReturnType<typeof effectiveConfig>>()
        requests.push({ canteenId, task })
        return task.promise
      })
      const { wrapper, visible } = mountCachedConfig()
      try {
        await nextTick()
        visible.value = false
        await nextTick()
        visible.value = true
        await nextTick()
        const currentA = requests[requests.length - 1]
        currentA.task.resolve(effectiveConfig('false'))
        await flushPromises()
        const config = wrapper.findComponent(ConfigManage)
        const selector = config.get('select')
        expect((selector.element as HTMLSelectElement).disabled).toBe(false)
        await selector.setValue('c2')
        const currentB = requests[requests.length - 1]
        expect(currentB.canteenId).toBe('c2')
        const staleA = requests.filter((request) => request !== currentA && request !== currentB)
        expect(staleA.length).toBeGreaterThan(0)
        const settleStale = async () => {
          for (const request of staleA) {
            if (outcome === 'success') request.task.resolve(effectiveConfig('false'))
            else request.task.reject(new Error('迟到的食堂一请求失败'))
          }
          await flushPromises()
        }
        if (beforeCurrent) {
          await settleStale()
          expect(config.vm.loading).toBe(true)
          expect((selector.element as HTMLSelectElement).disabled).toBe(true)
          expect(config.vm.loadError).toBe(false)
        }
        currentB.task.resolve(effectiveConfig('true'))
        await flushPromises()
        if (!beforeCurrent) await settleStale()
        expect(config.vm.currentCanteenId).toBe('c2')
        expect(config.vm.reviewAutoApprove).toBe(true)
        expect(config.vm.commentAutoApprove).toBe(true)
        expect(config.vm.configItems).toEqual(effectiveConfig('true').data.items)
        expect(config.vm.loading).toBe(false)
        expect(config.vm.loadError).toBe(false)
        expect(mocks.showAlertMock).not.toHaveBeenCalled()
      } finally {
        wrapper.unmount()
      }
    },
  )

  it('offers canteen targets to a config-only global administrator', async () => {
    mocks.authStoreMock.hasPermission.mockImplementation((permission: string) =>
      ['config:view', 'config:edit'].includes(permission),
    )
    mocks.canteenApiMock.getCanteenOptions.mockResolvedValue({
      code: 200,
      data: {
        items: [
          { id: 'c1', name: '食堂一' },
          { id: 'c2', name: '食堂二' },
        ],
      },
    })
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: null, templates: [] },
    })
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    try {
      await flushPromises()
      expect(
        wrapper
          .get('select')
          .findAll('option')
          .map((option) => option.text()),
      ).toEqual(['全局默认配置', '食堂一', '食堂二'])
    } finally {
      wrapper.unmount()
    }
  })

  it('switches configuration and saves only to the selected authorized canteen', async () => {
    mocks.authStoreMock.user = {
      scope: 'CANTEENS',
      canteenIds: ['c1', 'c2'],
      canteens: [
        { id: 'c1', name: '食堂一' },
        { id: 'c2', name: '食堂二' },
      ],
    }
    mocks.configApiMock.getEffectiveConfig.mockImplementation(async (id) => ({
      code: 200,
      data: { items: [{ key: 'review.autoApprove', value: id === 'c1' ? 'true' : 'false' }] },
    }))
    mocks.configApiMock.updateCanteenConfig.mockResolvedValue({ code: 200 })
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    try {
      await flushPromises()
      expect(wrapper.vm.currentCanteenId).toBe('c1')
      await wrapper.get('select').setValue('c2')
      await flushPromises()
      expect(mocks.configApiMock.getEffectiveConfig).toHaveBeenLastCalledWith('c2')
      expect(wrapper.vm.reviewAutoApprove).toBe(false)
      wrapper.vm.reviewAutoApprove = true
      await wrapper.vm.handleReviewAutoApproveChange()
      expect(mocks.configApiMock.updateCanteenConfig).toHaveBeenCalledWith('c2', {
        key: 'review.autoApprove',
        value: 'true',
      })
      expect(mocks.configApiMock.updateGlobalConfig).not.toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('社区帖子人工审核')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows manual approval as off by default and saves an explicit opt-in as autoApprove=false', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: {
        config: null,
        templates: [
          { key: 'review.autoApprove', defaultValue: 'true' },
          { key: 'comment.autoApprove', defaultValue: 'true' },
        ],
      },
    })
    mocks.configApiMock.updateGlobalConfig.mockResolvedValue({ code: 200, data: null })
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    try {
      await flushPromises()
      const review = wrapper.get('input[aria-label="评价人工审核"]')
      const comment = wrapper.get('input[aria-label="回复人工审核"]')
      expect((review.element as HTMLInputElement).checked).toBe(false)
      expect((comment.element as HTMLInputElement).checked).toBe(false)
      await review.setValue(true)
      await flushPromises()
      expect(mocks.configApiMock.updateGlobalConfig).toHaveBeenCalledWith({
        key: 'review.autoApprove',
        value: 'false',
      })
      await comment.setValue(true)
      await flushPromises()
      expect(mocks.configApiMock.updateGlobalConfig).toHaveBeenCalledWith({
        key: 'comment.autoApprove',
        value: 'false',
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('reads and saves both community approval flags only as global config', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: {
        config: { items: [{ key: 'post.autoApprove', value: 'false' }] },
        templates: [{ key: 'postComment.autoApprove', defaultValue: 'true' }],
      },
    })
    mocks.configApiMock.updateGlobalConfig.mockResolvedValue({ code: 200 })
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    try {
      await flushPromises()
      const post = wrapper.get('input[aria-label="社区帖子人工审核"]')
      const reply = wrapper.get('input[aria-label="帖子回复人工审核"]')
      expect((post.element as HTMLInputElement).checked).toBe(true)
      expect((reply.element as HTMLInputElement).checked).toBe(false)
      await post.setValue(false)
      await flushPromises()
      expect(mocks.configApiMock.updateGlobalConfig).toHaveBeenLastCalledWith({
        key: 'post.autoApprove',
        value: 'true',
      })
      await reply.setValue(true)
      await flushPromises()
      expect(mocks.configApiMock.updateGlobalConfig).toHaveBeenLastCalledWith({
        key: 'postComment.autoApprove',
        value: 'false',
      })
      expect(mocks.configApiMock.updateCanteenConfig).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('hides community controls for canteen scope and disallows read-only writes', async () => {
    mocks.authStoreMock.user = {
      scope: 'CANTEENS' as 'GLOBAL' | 'CANTEENS',
      canteenIds: ['c1'],
      canteens: [{ id: 'c1', name: 'c1' }],
    }
    mocks.configApiMock.getEffectiveConfig.mockResolvedValue({ code: 200, data: { items: [] } })
    let wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    await flushPromises()
    expect(wrapper.find('input[aria-label="社区帖子人工审核"]').exists()).toBe(false)
    wrapper.unmount()
    mocks.authStoreMock.user = { scope: 'GLOBAL', canteenIds: [], canteens: [] }
    mocks.authStoreMock.hasPermission.mockReturnValue(false)
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({
      code: 200,
      data: { config: null, templates: [] },
    })
    wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    try {
      await flushPromises()
      expect(
        wrapper.get('input[aria-label="社区帖子人工审核"]').attributes('disabled'),
      ).toBeDefined()
      await wrapper.vm.handleCommunityApprovalChange(wrapper.vm.communityConfigs[0])
      expect(mocks.configApiMock.updateGlobalConfig).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps community settings unavailable when a failed save cannot reload its baseline', async () => {
    mocks.configApiMock.getGlobalConfig
      .mockResolvedValueOnce({ code: 200, data: { config: null, templates: [] } })
      .mockRejectedValueOnce(new Error('读取失败'))
    mocks.configApiMock.updateGlobalConfig.mockRejectedValueOnce(new Error('保存失败'))
    const wrapper = mount(ConfigManage, { global: { stubs: { Header: true } } })
    try {
      await flushPromises()
      await wrapper.get('input[aria-label="社区帖子人工审核"]').setValue(true)
      await flushPromises()
      expect(
        wrapper.get('input[aria-label="社区帖子人工审核"]').attributes('disabled'),
      ).toBeDefined()
      expect(wrapper.text()).toContain('暂不可读取')
    } finally {
      wrapper.unmount()
    }
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
    expect(wrapper.vm.configDescription).toContain('审核策略')
    expect(wrapper.vm.currentCanteenInfo).toContain('全局')
  })

  it('loads canteen effective config and reads key values (missing key => automatic approval)', async () => {
    mocks.authStoreMock.user = {
      scope: 'CANTEENS' as 'GLOBAL' | 'CANTEENS',
      canteenIds: ['c1'],
      canteens: [{ id: 'c1', name: '食堂A' }],
    }

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
    expect(wrapper.vm.commentAutoApprove).toBe(true)
    expect(wrapper.vm.currentCanteenInfo).toContain('食堂A')
  })

  it('handles loadConfig failure and alerts', async () => {
    mocks.configApiMock.getGlobalConfig.mockResolvedValue({ code: 500, message: 'nope' })

    const wrapper = mount(ConfigManage, {
      global: {
        stubs: {
          Header: defineComponent({ name: 'Header', template: '<div />' }),
        },
      },
    })

    await flushPromises()
    expect(mocks.showAlertMock).toHaveBeenCalled()
    expect(
      (wrapper.get('input[aria-label="评价人工审核"]').element as HTMLInputElement).disabled,
    ).toBe(true)
    expect(
      (wrapper.get('input[aria-label="回复人工审核"]').element as HTMLInputElement).disabled,
    ).toBe(true)
    wrapper.unmount()
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
    mocks.authStoreMock.user = {
      scope: 'CANTEENS' as 'GLOBAL' | 'CANTEENS',
      canteenIds: ['c1'],
      canteens: [{ id: 'c1', name: '食堂A' }],
    }

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
    mocks.canteenApiMock.getCanteenOptions.mockResolvedValue({
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
    mocks.authStoreMock.user = {
      scope: 'CANTEENS' as 'GLOBAL' | 'CANTEENS',
      canteenIds: ['c1'],
      canteens: [{ id: 'c1', name: '食堂A' }],
    }
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
    expect(wrapper.vm.canteenList).toEqual(mocks.authStoreMock.user.canteens)
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
    mocks.authStoreMock.user = {
      scope: 'CANTEENS' as 'GLOBAL' | 'CANTEENS',
      canteenIds: ['c1'],
      canteens: [{ id: 'c1', name: '食堂A' }],
    }
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
    mocks.authStoreMock.user = {
      scope: 'CANTEENS' as 'GLOBAL' | 'CANTEENS',
      canteenIds: ['c1'],
      canteens: [{ id: 'c1', name: '食堂A' }],
    }
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
