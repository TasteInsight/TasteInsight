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

import NewsManage from '../../src/views/NewsManage.vue'

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

    // time range on draft uses createdAt
    wrapper.vm.currentStatus = 'draft'
    wrapper.vm.newsList = [
      { id: 10, title: 'Draft', canteenId: 'c1', createdAt: '2025-01-03T10:00:00' },
      { id: 11, title: 'Old', canteenId: 'c1', createdAt: '2025-01-01T10:00:00' },
    ]
    wrapper.vm.startDate = '2025-01-03T00:00'
    wrapper.vm.endDate = '2025-01-03T00:00'
    expect(wrapper.vm.filteredNewsList).toHaveLength(1)

    wrapper.unmount()
  })

  it('loadNews handles meta fallback, array data, non-200, and throw', async () => {
    // meta.totalPages fallback
    mocks.newsApiMock.getNews.mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'n1', title: 'T1' }], meta: { total: 11 } },
    })

    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    expect(wrapper.vm.newsList).toHaveLength(1)
    expect(wrapper.vm.pagination.total).toBe(11)
    expect(wrapper.vm.pagination.totalPages).toBe(2)

    // array data
    mocks.newsApiMock.getNews.mockResolvedValueOnce({
      code: 200,
      data: [{ id: 'n2', title: 'T2' }],
    })
    wrapper.vm.handlePageChange(2)
    await flushMicrotasks()
    expect(wrapper.vm.newsList).toHaveLength(1)
    expect(wrapper.vm.newsList[0].id).toBe('n2')

    // non-200 clears list + pagination.total
    mocks.newsApiMock.getNews.mockResolvedValueOnce({ code: 500, message: 'bad' })
    wrapper.vm.handlePageChange(3)
    await flushMicrotasks()
    expect(wrapper.vm.newsList).toEqual([])
    expect(wrapper.vm.pagination.total).toBe(0)

    // throw -> alert(error.message)
    mocks.newsApiMock.getNews.mockRejectedValueOnce(new Error('boom'))
    ;(window.alert as any).mockClear()
    wrapper.vm.handlePageChange(4)
    await flushMicrotasks()
    expect(window.alert).toHaveBeenCalledWith('boom')

    wrapper.unmount()
  })

  it('loadCanteens supports array data and logs on failure', async () => {
    // array data branch
    mocks.canteenApiMock.getCanteens.mockResolvedValueOnce({
      code: 200,
      data: [{ id: 'c9', name: 'C9' }],
    })
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })
    await flushMicrotasks()
    await nextTick()
    expect(wrapper.vm.canteenList).toEqual([{ id: 'c9', name: 'C9' }])
    wrapper.unmount()

    // catch branch logs
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.canteenApiMock.getCanteens.mockRejectedValueOnce(new Error('canteen boom'))
    shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })
    await flushMicrotasks()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('editor upload customInsert/onError and destroy on unmount', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    const insertFn = vi.fn()

    // customInsert success for 200/201
    wrapper.vm.editorConfig.MENU_CONF.uploadImage.customInsert(
      { code: 200, data: { url: 'u1', filename: 'f1' } },
      insertFn,
    )
    expect(insertFn).toHaveBeenCalledWith('u1', 'f1', 'u1')
    insertFn.mockClear()
    wrapper.vm.editorConfig.MENU_CONF.uploadImage.customInsert(
      { code: 201, data: { url: 'u2', filename: 'f2' } },
      insertFn,
    )
    expect(insertFn).toHaveBeenCalledWith('u2', 'f2', 'u2')

    // customInsert fail alerts
    ;(window.alert as any).mockClear()
    wrapper.vm.editorConfig.MENU_CONF.uploadImage.customInsert(
      { code: 500, message: 'upload bad' },
      insertFn,
    )
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('upload bad')

    // onError alerts + logs
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(window.alert as any).mockClear()
    wrapper.vm.editorConfig.MENU_CONF.uploadImage.onError(
      new File(['x'], 'x.png'),
      new Error('E1'),
      { code: 500 },
    )
    expect(errSpy).toHaveBeenCalled()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('图片上传出错')
    errSpy.mockRestore()

    // handleCreated + onBeforeUnmount destroy
    const destroy = vi.fn()
    wrapper.vm.handleCreated({ destroy })
    wrapper.unmount()
    expect(destroy).toHaveBeenCalled()
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
    expect(mocks.newsApiMock.getNews.mock.calls[mocks.newsApiMock.getNews.mock.calls.length - 1]?.[0]).toMatchObject({ status: 'draft' })

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

    // publish failure non-200
    mocks.newsApiMock.publishNews.mockResolvedValueOnce({ code: 500, message: 'pub bad' })
    ;(window.alert as any).mockClear()
    await wrapper.vm.publishNews('n1')
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('pub bad')

    // revoke throw
    mocks.newsApiMock.revokeNews.mockRejectedValueOnce(new Error('revoke boom'))
    ;(window.alert as any).mockClear()
    await wrapper.vm.revokeNews('n1')
    expect(window.alert).toHaveBeenCalledWith('revoke boom')

    // delete throw
    mocks.newsApiMock.deleteNews.mockRejectedValueOnce(new Error('del boom'))
    ;(window.alert as any).mockClear()
    await wrapper.vm.deleteNews('n1')
    expect(window.alert).toHaveBeenCalledWith('del boom')

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
    expect(mocks.newsApiMock.getNews.mock.calls[mocks.newsApiMock.getNews.mock.calls.length - 1]?.[0]).toMatchObject({ page: 3 })

    wrapper.unmount()
  })

  it('renders template branches: loading/empty/list/pagination/modal', async () => {
    const wrapper = mount(NewsManage, {
      global: {
        stubs: {
          Header: true,
          Pagination: true,
        },
      },
    })

    await flushMicrotasks()
    await nextTick()

    // loading state
    wrapper.vm.isLoading = true
    await nextTick()
    expect(wrapper.text()).toContain('加载中')

    // empty state without filters (published)
    wrapper.vm.isLoading = false
    wrapper.vm.newsList = []
    wrapper.vm.searchQuery = ''
    wrapper.vm.canteenFilter = ''
    wrapper.vm.startDate = ''
    wrapper.vm.endDate = ''
    wrapper.vm.currentStatus = 'published'
    await nextTick()
    expect(wrapper.text()).toContain('暂无已发布新闻')

    // empty state with filters
    wrapper.vm.searchQuery = 'x'
    await nextTick()
    expect(wrapper.text()).toContain('没有找到符合条件的新闻')
    expect(wrapper.text()).toContain('重置筛选')

    // list rows in draft: publish/edit buttons
    wrapper.vm.searchQuery = ''
    wrapper.vm.currentStatus = 'draft'
    wrapper.vm.canteenList = [{ id: 'c1', name: 'C1' }]
    wrapper.vm.newsList = [
      { id: 'd1', title: 'T', summary: '', content: '<p>c</p>', canteenId: 'c1', createdAt: null },
      { id: 'd2', title: 'T2', summary: '', content: '', canteenId: 'missing', createdAt: '2025-01-01T10:00:00' },
      { id: 'd3', title: 'T3', summary: '', content: '', canteenId: null, createdAt: '2025-01-01T10:00:00' },
    ]
    await nextTick()
    expect(wrapper.text()).toContain('发布')
    expect(wrapper.text()).toContain('编辑')
    // getCanteenName branches visible in table
    expect(wrapper.text()).toContain('C1')
    expect(wrapper.text()).toContain('未知食堂')
    expect(wrapper.text()).toContain('全校公告')

    // list rows in published: revoke button + info icon hint text
    wrapper.vm.currentStatus = 'published'
    wrapper.vm.newsList = [{ id: 'p1', title: 'P', summary: '', content: '', canteenId: null, publishedAt: null }]
    await nextTick()
    expect(wrapper.text()).toContain('撤回')
    const revokeBtn = wrapper.findAll('button').find((b) => b.text().includes('撤回'))
    expect(revokeBtn?.attributes('title') || '').toContain('如需编辑已发布新闻')
    expect(wrapper.find('span[title*="如需编辑已发布新闻"]').exists()).toBe(true)

    // pagination v-if
    wrapper.vm.pagination.totalPages = 2
    await nextTick()
    expect(wrapper.findComponent({ name: 'Pagination' }).exists()).toBe(true)

    // create modal open + click overlay to close (covers @click.self)
    wrapper.vm.openCreateModal()
    await nextTick()
    expect(wrapper.text()).toContain('创建新闻')

    const overlay = wrapper.find('.fixed.inset-0')
    await overlay.trigger('click')
    await nextTick()
    expect(wrapper.vm.showCreateModal).toBe(false)

    wrapper.unmount()
  })
})
