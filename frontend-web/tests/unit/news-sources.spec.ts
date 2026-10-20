import { notify } from '@/composables/useNotification'
vi.mock('@/composables/useNotification', () => { const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() }; return { useNotification: () => notify, notify } })
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import NewsSources from '../../src/components/News/NewsSources.vue'
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  feeds: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  sync: vi.fn(),
  hasPermission: vi.fn((_p: string) => true),
}))
vi.mock('@/api/modules/news-sources', () => ({ newsSourcesApi: mocks }))
vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => ({
    hasPermission: mocks.hasPermission,
    user: { scope: 'GLOBAL', canteenIds: [] },
  }),
}))
const source = {
  id: 's',
  mpId: 'mp',
  name: '食在清华',
  canteenId: null,
  enabled: true,
  autoPublish: false,
  intervalMinutes: 30,
  keyword: '',
  lastError: null,
  lastSyncAt: null,
  lastImportedCount: 0,
  syncLeaseUntil: null,
}
const mountSources = (active = true) =>
  mount(NewsSources, { props: { canteens: [], active }, global: { stubs: { AppIcon: true } } })
async function click(w: ReturnType<typeof mountSources>, text: string) {
  await w
    .findAll('button')
    .find((b) => b.text() === text)!
    .trigger('click')
  await flushPromises()
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  mocks.list.mockResolvedValue({ code: 200, data: { configured: true, items: [] } })
  mocks.feeds.mockResolvedValue({ code: 200, data: [{ id: 'mp', name: '食在清华' }] })
  mocks.create.mockResolvedValue({ code: 200, data: source })
  mocks.update.mockResolvedValue({ code: 200, data: source })
  mocks.sync.mockResolvedValue({ code: 200, data: { queued: true } })
})
afterEach(() => vi.useRealTimers())
describe('news source workspace', () => {
  it('loads only in the active workspace and reveals creation on demand', async () => {
    const w = mountSources(false)
    expect(mocks.list).not.toHaveBeenCalled()
    await w.setProps({ active: true })
    await flushPromises()
    expect(w.find('form').exists()).toBe(false)
    await click(w, '添加第一个公众号')
    await w.get('#news-source-account').setValue('mp')
    expect((w.get('input[type=radio][value="false"]').element as HTMLInputElement).checked).toBe(
      true,
    )
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.create).toHaveBeenCalledWith({
      mpId: 'mp',
      canteenId: null,
      enabled: true,
      autoPublish: false,
      intervalMinutes: 30,
      keyword: '',
    })
    expect(w.find('form').exists()).toBe(false)
    expect(notify.success).toHaveBeenCalledWith(expect.stringContaining('存为草稿'))
    w.unmount()
  })
  it('restores publication mode while editing and saves an explicit selection', async () => {
    mocks.list.mockResolvedValue({
      code: 200,
      data: { configured: true, items: [{ ...source, autoPublish: true }] },
    })
    const w = mountSources()
    await flushPromises()
    await click(w, '编辑')
    expect((w.get('input[value="true"]').element as HTMLInputElement).checked).toBe(true)
    expect(w.get('#news-source-account').attributes('disabled')).toBeDefined()
    await w.get('input[value="false"]').setValue()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.update).toHaveBeenCalledWith('s', expect.objectContaining({ autoPublish: false }))
    w.unmount()
  })
  it('explains publish permissions while allowing draft selection', async () => {
    mocks.hasPermission.mockImplementation((p) => p !== 'news:publish')
    const w = mountSources()
    await flushPromises()
    await click(w, '添加第一个公众号')
    expect(w.get('input[value="true"]').attributes('disabled')).toBeDefined()
    expect(w.get('input[value="false"]').attributes('disabled')).toBeUndefined()
    expect(w.text()).toContain('需要新闻发布权限')
    w.unmount()
  })
  it('returns from editing without changing source settings', async () => {
    mocks.list.mockResolvedValue({ code: 200, data: { configured: true, items: [source] } })
    const w = mountSources()
    await flushPromises()
    await click(w, '编辑')
    await w.get('#news-source-keyword').setValue('上新')
    await click(w, '取消')
    expect(w.find('form').exists()).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(w.get('.source-identity').text()).toContain('食在清华')
    w.unmount()
  })
  it('shows connection failures with a recovery action', async () => {
    mocks.list.mockRejectedValue(new Error('连接失败'))
    const w = mountSources()
    await flushPromises()
    expect(w.get('[role=alert]').text()).toContain('连接失败')
    expect(w.text()).not.toContain('尚未连接采集服务')
    mocks.list.mockResolvedValue({ code: 200, data: { configured: true, items: [] } })
    await click(w, '重新加载')
    expect(w.find('[role=alert]').exists()).toBe(false)
    w.unmount()
  })
  it('distinguishes an unconfigured service from an empty subscribed list', async () => {
    mocks.list.mockResolvedValue({ code: 200, data: { configured: false, items: [] } })
    const w = mountSources()
    await flushPromises()
    expect(w.text()).toContain('尚未连接采集服务')
    expect(w.find('form').exists()).toBe(false)
    expect(mocks.feeds).not.toHaveBeenCalled()
    w.unmount()
  })
  it('queues a sync and refreshes news only after a new result, then stops polling on exit', async () => {
    mocks.list.mockResolvedValue({ code: 200, data: { configured: true, items: [source] } })
    const w = mountSources()
    await flushPromises()
    await click(w, '立即同步')
    expect(mocks.sync).toHaveBeenCalledWith('s')
    expect(w.emitted('imported')).toBeUndefined()
    mocks.list.mockResolvedValue({
      code: 200,
      data: { configured: true, items: [{ ...source, lastSyncAt: new Date().toISOString() }] },
    })
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(w.emitted('imported')).toHaveLength(1)
    await w.setProps({ active: false })
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })
  it('clears a transient polling failure after recovery', async () => {
    const w = mountSources()
    await flushPromises()
    mocks.list.mockRejectedValueOnce(new Error('offline'))
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(w.find('[role=alert]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(w.find('[role=alert]').exists()).toBe(false)
    w.unmount()
  })
  it('ignores a retired request after leaving the workspace', async () => {
    let resolve!: (value: unknown) => void
    mocks.list.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      }),
    )
    const w = mountSources()
    await w.setProps({ active: false })
    resolve({ code: 200, data: { configured: true, items: [{ ...source, name: 'retired' }] } })
    await flushPromises()
    expect(w.text()).not.toContain('retired')
    expect(w.emitted('panelUrl')).toBeUndefined()
    expect(mocks.feeds).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })
  it('keeps controls read-only for administrators without create permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    mocks.list.mockResolvedValue({ code: 200, data: { configured: true, items: [source] } })
    const w = mountSources()
    await flushPromises()
    expect(w.findAll('button').some((b) => b.text() === '添加公众号')).toBe(false)
    expect(w.text()).not.toContain('立即同步')
    expect(w.text()).toContain('仅查看')
    expect(mocks.feeds).not.toHaveBeenCalled()
    w.unmount()
  })
  it('offers only unconnected subscriptions when creating another source', async () => {
    mocks.list.mockResolvedValue({ code: 200, data: { configured: true, items: [source] } })
    mocks.feeds.mockResolvedValue({
      code: 200,
      data: [
        { id: 'mp', name: '食在清华' },
        { id: 'other', name: '校园新闻' },
      ],
    })
    const w = mountSources()
    await flushPromises()
    await click(w, '添加公众号')
    expect(w.get('#news-source-account').text()).not.toContain('食在清华')
    expect(w.get('#news-source-account').text()).toContain('校园新闻')
    w.unmount()
  })
  it('provides the configured service address to the workspace navigation', async () => {
    mocks.list.mockResolvedValue({
      code: 200,
      data: { configured: true, adminUrl: 'https://rss.school.example/', items: [] },
    })
    const w = mountSources()
    await flushPromises()
    expect(w.emitted('panelUrl')).toEqual([['https://rss.school.example/']])
    w.unmount()
  })
  it('clears the navigation address when the deployment has no browser address', async () => {
    const w = mountSources()
    await flushPromises()
    expect(w.emitted('panelUrl')).toEqual([[null]])
    w.unmount()
  })
})
