import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

// wangEditor stubs
vi.mock('@wangeditor/editor-for-vue', () => ({
  Editor: defineComponent({ name: 'WangEditor', template: '<div />' }),
  Toolbar: defineComponent({ name: 'WangToolbar', template: '<div />' }),
}))
vi.mock('@wangeditor/editor/dist/css/style.css', () => ({}))

const mocks = vi.hoisted(() => ({
  authStoreMock: {
    user: { id: 'a1', username: 'admin' },
    token: 'token',
    hasPermission: vi.fn((p: string) =>
      ['news:view', 'news:create', 'news:edit', 'news:publish', 'news:revoke', 'news:delete'].includes(p),
    ),
  },
  newsApiMock: {
    getNews: vi.fn(),
    createNews: vi.fn(),
    updateNews: vi.fn(),
    deleteNews: vi.fn(),
    publishNews: vi.fn(),
    revokeNews: vi.fn(),
  },
  canteenApiMock: {
    getCanteens: vi.fn(),
  },
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/api/modules/news', () => ({
  newsApi: mocks.newsApiMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

vi.mock('@/config', () => ({
  default: { baseURL: 'http://example.com/' },
}))

import NewsManage from '@/views/NewsManage.vue'

function flushMicrotasks() {
  return Promise.resolve()
}

describe('views/NewsManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.canteenApiMock.getCanteens.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1', name: 'C1' }] },
    })

    mocks.newsApiMock.getNews.mockResolvedValue({
      code: 200,
      data: { items: [], meta: { total: 0, totalPages: 0 } },
    })

    mocks.newsApiMock.createNews.mockResolvedValue({ code: 200, data: { id: 'n1' } })
    mocks.newsApiMock.updateNews.mockResolvedValue({ code: 200, data: {} })
    mocks.newsApiMock.publishNews.mockResolvedValue({ code: 200 })
    mocks.newsApiMock.revokeNews.mockResolvedValue({ code: 200 })
    mocks.newsApiMock.deleteNews.mockResolvedValue({ code: 200 })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
  })

  it('builds uploadUrl from config.baseURL and loads list/canteens', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    expect(mocks.canteenApiMock.getCanteens).toHaveBeenCalled()
    expect(mocks.newsApiMock.getNews).toHaveBeenCalled()

    // upload URL should strip trailing slash
    expect(wrapper.vm.editorConfig.MENU_CONF.uploadImage.server).toBe('http://example.com/upload/image')

    wrapper.unmount()
  })

  it('filters by title/canteen/all/time and getSummary strips html', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    wrapper.vm.newsList = [
      { id: 1, title: 'Hello', canteenId: 'c1', createdAt: '2025-01-01T10:00:00', summary: '<b>hi</b>' },
      { id: 2, title: 'World', canteenId: null, publishedAt: '2025-01-02T10:00:00', content: '<p>c</p>' },
    ]

    // title search
    wrapper.vm.searchQuery = 'hell'
    expect(wrapper.vm.filteredNewsList).toHaveLength(1)

    // canteen all
    wrapper.vm.searchQuery = ''
    wrapper.vm.canteenFilter = 'all'
    expect(wrapper.vm.filteredNewsList).toHaveLength(1)

    // time range on published
    wrapper.vm.currentStatus = 'published'
    wrapper.vm.canteenFilter = ''
    wrapper.vm.startDate = '2025-01-02T00:00'
    wrapper.vm.endDate = '2025-01-02T00:00'
    expect(wrapper.vm.filteredNewsList).toHaveLength(1)

    expect(wrapper.vm.getSummary({ summary: '<b>abc</b>' })).toBe('abc')

    wrapper.unmount()
  })

  it('openCreateModal permission guard and closeModal resets', async () => {
    const wrapper = mount(NewsManage, {
      global: {
        stubs: { Header: true, Pagination: true },
      },
    })

    await flushMicrotasks()

    // no permission
    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    wrapper.vm.openCreateModal()
    expect(window.alert).toHaveBeenCalledWith('您没有权限创建新闻')

    // open modal
    mocks.authStoreMock.hasPermission.mockImplementation((p: string) =>
      ['news:create', 'news:view', 'news:publish', 'news:delete', 'news:edit', 'news:revoke'].includes(p),
    )
    wrapper.vm.openCreateModal()
    await nextTick()
    expect(wrapper.vm.showCreateModal).toBe(true)

    wrapper.vm.closeModal()
    expect(wrapper.vm.showCreateModal).toBe(false)
    expect(wrapper.vm.showEditModal).toBe(false)
    expect(wrapper.vm.newsForm.title).toBe('')
    expect(wrapper.vm.valueHtml).toBe('')

    wrapper.unmount()
  })

  it('submitForm validates, creates draft/published, and updates existing news', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    // validation failures
    wrapper.vm.newsForm.title = ''
    wrapper.vm.newsForm.summary = ''
    wrapper.vm.valueHtml = ''
    await wrapper.vm.submitForm('draft')
    expect(wrapper.vm.errors.title).toBe('请输入标题')
    expect(wrapper.vm.errors.summary).toBe('请输入摘要')
    expect(wrapper.vm.errors.content).toBe('请输入内容')

    // create published success
    wrapper.vm.newsForm.title = 't'
    wrapper.vm.newsForm.summary = 's'
    wrapper.vm.valueHtml = '<p>c</p>'
    wrapper.vm.showCreateModal = true
    mocks.newsApiMock.createNews.mockResolvedValueOnce({ code: 201, data: { id: 'n2' } })
    await wrapper.vm.submitForm('published')
    expect(mocks.newsApiMock.createNews).toHaveBeenCalled()
    expect(mocks.newsApiMock.publishNews).toHaveBeenCalledWith('n2')

    // publish fail branch
    // previous submitForm() closes modal and resets form; re-fill required fields
    wrapper.vm.newsForm.title = 't'
    wrapper.vm.newsForm.summary = 's'
    wrapper.vm.valueHtml = '<p>c</p>'
    wrapper.vm.showCreateModal = true
    mocks.newsApiMock.createNews.mockResolvedValueOnce({ code: 200, data: { id: 'n3' } })
    mocks.newsApiMock.publishNews.mockRejectedValueOnce(new Error('publish bad'))
    ;(window.alert as any).mockClear()
    await wrapper.vm.submitForm('published')
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('新闻创建成功，但发布失败')

    // create draft when currentStatus != draft triggers changeStatus and early return
    wrapper.vm.newsForm.title = 't'
    wrapper.vm.newsForm.summary = 's'
    wrapper.vm.valueHtml = '<p>c</p>'
    wrapper.vm.showCreateModal = true
    wrapper.vm.currentStatus = 'published'
    mocks.newsApiMock.createNews.mockResolvedValueOnce({ code: 200, data: { id: 'n4' } })
    const callsBefore = mocks.newsApiMock.getNews.mock.calls.length
    await wrapper.vm.submitForm('draft')
    // submitForm calls the inner changeStatus() closure directly; assert its observable effects
    expect(wrapper.vm.currentStatus).toBe('draft')
    expect(wrapper.vm.pagination.page).toBe(1)
    await flushMicrotasks()
    expect(mocks.newsApiMock.getNews.mock.calls.length).toBeGreaterThan(callsBefore)
    expect(mocks.newsApiMock.getNews.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'draft' })

    // edit update path
    wrapper.vm.editNews({
      id: 'e1',
      title: 't',
      content: '<p>c</p>',
      summary: 's',
      canteenId: 'c1',
      status: 'draft',
      publishedAt: null,
    })
    mocks.newsApiMock.updateNews.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.submitForm('draft')
    expect(mocks.newsApiMock.updateNews).toHaveBeenCalledWith('e1', expect.any(Object))

    wrapper.unmount()
  })

  it('publish/revoke/delete honor permission + confirm branches and handle failures', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    // confirm cancel
    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.publishNews('n1')
    expect(mocks.newsApiMock.publishNews).not.toHaveBeenCalled()

    // no permission
    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    await wrapper.vm.revokeNews('n1')
    expect(window.alert).toHaveBeenCalledWith('您没有权限撤回新闻')

    // revoke success
    ;(window.confirm as any).mockReturnValueOnce(true)
    await wrapper.vm.revokeNews('n1')
    expect(mocks.newsApiMock.revokeNews).toHaveBeenCalledWith('n1')

    // delete failure non-200
    mocks.newsApiMock.deleteNews.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.deleteNews('n1')
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('bad')

    wrapper.unmount()
  })

  it('editNews fills form and formats publishedAt for datetime-local', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    wrapper.vm.editNews({
      id: 'n1',
      title: 't',
      content: '<p>c</p>',
      summary: 's',
      canteenId: 'c1',
      status: 'published',
      publishedAt: '2025-12-23T08:09:10Z',
    })

    expect(wrapper.vm.showEditModal).toBe(true)
    expect(wrapper.vm.newsForm.title).toBe('t')
    expect(wrapper.vm.valueHtml).toContain('<p>c</p>')
    expect(typeof wrapper.vm.newsForm.publishedAt).toBe('string')

    wrapper.unmount()
  })

  it('handlePageChange updates page and reloads', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()
    const callsBefore = mocks.newsApiMock.getNews.mock.calls.length
    wrapper.vm.handlePageChange(3)
    expect(wrapper.vm.pagination.page).toBe(3)
    await flushMicrotasks()
    expect(mocks.newsApiMock.getNews.mock.calls.length).toBeGreaterThan(callsBefore)
    expect(mocks.newsApiMock.getNews.mock.calls.at(-1)?.[0]).toMatchObject({ page: 3 })

    wrapper.unmount()
  })
})
