import { notify } from '@/composables/useNotification'
vi.mock('@/composables/useNotification', () => { const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() }; return { useNotification: () => notify, notify } })
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Settings from '@/components/ContentModerationSettings.vue'
import Tasks from '@/components/ContentModerationTasks.vue'

const api = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getTasks: vi.fn(),
  decide: vi.fn(),
}))
vi.mock('@/api/modules/content-moderation', () => ({ contentModerationApi: api }))
const settings = (extra = {}) => ({
  enabled: false,
  mode: 'manual',
  provider: 'aliyun',
  providers: {
    aliyun: { configured: true, missing: [] },
    wechat: { configured: false, missing: ['WECHAT_APP_SECRET'] },
  },
  ...extra,
})
const response = (data: unknown) => ({ code: 200, data })
const mountSettings = (canEdit = true) =>
  mount(Settings, {
    props: { canEdit },
    global: { stubs: { AppIcon: true, ContentModerationTasks: true } },
  })
const task = {
  id: 't1',
  targetType: 'profile',
  targetId: 'u1',
  userId: 'u1',
  text: '待审核昵称',
  images: ['/avatar.png'],
  status: 'manual',
  mode: 'manual',
  provider: 'aliyun',
  createdAt: '2026-10-19T00:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getSettings.mockResolvedValue(response(settings()))
  api.getTasks.mockResolvedValue(
    response({ items: [task], meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 } }),
  )
})
describe('统一内容审核设置', () => {
  it('loads saved state and saves one atomic policy without environment values', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    expect(wrapper.emitted('state')).toEqual([['loading'], ['ready']])
    expect(wrapper.emitted('enabled')).toEqual([[false]])
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('select').setValue('machine')
    api.updateSettings.mockResolvedValue(response(settings({ enabled: true, mode: 'machine' })))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateSettings).toHaveBeenCalledWith({
      enabled: true,
      mode: 'machine',
      provider: 'aliyun',
    })
    expect(wrapper.emitted('enabled')).toEqual([[false], [true]])
    expect(wrapper.text()).toContain('审核设置已保存')
    await wrapper.get('select').setValue('manual')
    expect(wrapper.text()).toContain('有未保存的修改')
    expect(wrapper.text()).not.toContain('审核设置已保存')
  })
  it('shows missing environment names and blocks enabling an unconfigured provider', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('input').setValue(true)
    await wrapper.get('select').setValue('machine')
    await wrapper.findAll('select')[1]!.setValue('wechat')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.get('details').text()).toContain('WECHAT_APP_SECRET')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(api.updateSettings).not.toHaveBeenCalled()
  })
  it('shows shared media readiness and blocks enabling manual moderation until images can be reviewed', async () => {
    api.getSettings.mockResolvedValue(
      response(settings({ mediaConfigured: false, mediaMissing: ['MODERATION_PUBLIC_BASE_URL'] })),
    )
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('input').setValue(true)
    expect(wrapper.text()).toContain('MODERATION_PUBLIC_BASE_URL')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(api.updateSettings).not.toHaveBeenCalled()
  })
  it('preserves failed save drafts and supports explicit revert', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('input').setValue(true)
    api.updateSettings.mockRejectedValue(new Error('offline'))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect((wrapper.get('input').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('修改已保留')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '撤销修改')!
      .trigger('click')
    expect((wrapper.get('input').element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.emitted('enabled')).toEqual([[false]])
  })
  it('recovers from failed settings load and respects view-only permission', async () => {
    api.getSettings.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountSettings(false)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('读取失败')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })
})
describe('内容审核待办', () => {
  it('previews profile text and images, requiring a reason to reject', async () => {
    const wrapper = mount(Tasks, { props: { canEdit: true } })
    await flushPromises()
    expect(wrapper.text()).toContain('用户资料')
    expect(wrapper.text()).toContain('待审核昵称')
    expect(wrapper.get('img').attributes('src')).toBe('/avatar.png')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '审核此内容')!
      .trigger('click')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('textarea').setValue('请修改昵称')
    api.decide.mockResolvedValue(response(null))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.decide).toHaveBeenCalledWith('t1', { approved: false, reason: '请修改昵称' })
    expect(notify.success).toHaveBeenCalledWith('已拒绝该内容')
  })
  it('requests failed tasks and keeps decision input after a failed submission', async () => {
    const wrapper = mount(Tasks, { props: { canEdit: true } })
    await flushPromises()
    await wrapper.get('select').setValue('failed')
    await flushPromises()
    expect(api.getTasks).toHaveBeenLastCalledWith({ status: 'failed', page: 1, pageSize: 20 })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '审核此内容')!
      .trigger('click')
    await wrapper.get('textarea').setValue('保留说明')
    api.decide.mockRejectedValue(new Error('offline'))
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确认通过')!
      .trigger('click')
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('保留说明')
    expect(wrapper.text()).toContain('提交失败')
  })

  it('moves focus into a decision and returns to the next item or queue heading after completion', async () => {
    const second = { ...task, id: 't2', text: '第二条待审内容' }
    api.getTasks.mockResolvedValueOnce(
      response({ items: [task, second], meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 } }),
    )
    const wrapper = mount(Tasks, { props: { canEdit: true }, attachTo: document.body })
    try {
      await flushPromises()
      await wrapper.get('[data-task-action="t1"]').trigger('click')
      expect(document.activeElement).toBe(wrapper.get('textarea').element)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '取消')!
        .trigger('click')
      expect(document.activeElement).toBe(wrapper.get('[data-task-action="t1"]').element)
      await wrapper.get('[data-task-action="t1"]').trigger('click')
      api.decide.mockResolvedValue(response(null))
      api.getTasks.mockResolvedValueOnce(
        response({ items: [second], meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 } }),
      )
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '确认通过')!
        .trigger('click')
      await flushPromises()
      expect(document.activeElement).toBe(wrapper.get('[data-task-action="t2"]').element)
      await wrapper.get('[data-task-action="t2"]').trigger('click')
      api.getTasks.mockResolvedValueOnce(
        response({ items: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } }),
      )
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '确认通过')!
        .trigger('click')
      await flushPromises()
      expect(document.activeElement).toBe(wrapper.get('#moderation-tasks-title').element)
    } finally {
      wrapper.unmount()
    }
  })

  it('hides decisions with view-only permission', async () => {
    const wrapper = mount(Tasks, { props: { canEdit: false } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('审核此内容')
  })
})
