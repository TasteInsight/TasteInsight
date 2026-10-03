import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { enableAutoUnmount, flushPromises, mount, shallowMount } from '@vue/test-utils'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { compileStyle, parse } from 'vue/compiler-sfc'
import NewsManageSource from '../../src/views/NewsManage.vue?raw'

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
  showAlertMock: vi.fn(() => Promise.resolve()),
  showConfirmMock: vi.fn(() => Promise.resolve(true)),
  requestPostMock: vi.fn(),
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

vi.mock('@/utils/request', () => ({ default: { post: mocks.requestPostMock } }))

vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlertMock,
  showConfirm: mocks.showConfirmMock,
  showConfirmDanger: vi.fn(() => Promise.resolve(true)),
}))

import NewsManage from '../../src/views/NewsManage.vue'
import { invalidateAuthSession } from '../../src/utils/auth-session'

enableAutoUnmount(afterEach)

const deferred = <T = any>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: any) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const draftNews = (id: string) => ({
  id, title: id, summary: `${id} summary`, content: `<p>${id}</p>`, status: 'draft',
})

function flushMicrotasks() {
  return Promise.resolve()
}

describe('views/NewsManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateAuthSession()
    mocks.authStoreMock.token = 'token'
    mocks.requestPostMock.mockReset()

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
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads list/canteens and configures image uploads through the shared request client', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    expect(mocks.canteenApiMock.getCanteens).toHaveBeenCalled()
    expect(mocks.newsApiMock.getNews).toHaveBeenCalled()

    expect(wrapper.vm.editorConfig.MENU_CONF.uploadImage.customUpload).toBeTypeOf('function')
    expect(wrapper.vm.editorConfig.MENU_CONF.uploadImage.headers).toBeUndefined()

    wrapper.unmount()
  })

  it('sends filters before pagination and displays matches outside the original first page', async () => {
    const records = Array.from({ length: 11 }, (_, index) => ({
      id: `n${index}`, title: index === 10 ? 'Target' : 'Other', canteenId: index === 10 ? null : 'c1',
    }))
    mocks.newsApiMock.getNews.mockImplementation(async (params: any) => {
      const filtered = records.filter((item) => !params.keyword || item.title.toLowerCase().includes(params.keyword.toLowerCase()))
        .filter((item) => params.canteenId !== 'all' || item.canteenId === null)
      return { code: 200, data: { items: filtered.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), meta: { total: filtered.length } } }
    })
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })
    await flushMicrotasks()
    await nextTick()
    expect(wrapper.vm.filteredNewsList).toHaveLength(10)
    wrapper.vm.pagination.page = 2
    wrapper.vm.searchQuery = 'Target'
    wrapper.vm.canteenFilter = 'all'
    wrapper.vm.startDate = '2026-10-01T08:00'
    wrapper.vm.endDate = '2026-10-02T09:00'
    await nextTick()
    await flushMicrotasks()
    await nextTick()
    expect(mocks.newsApiMock.getNews).toHaveBeenLastCalledWith({
      page: 1, pageSize: 10, status: 'published', keyword: 'Target', canteenId: 'all',
      startDate: new Date('2026-10-01T08:00').toISOString(), endDate: new Date('2026-10-02T09:00').toISOString(),
    })
    expect(wrapper.vm.filteredNewsList).toHaveLength(1)
    expect(wrapper.vm.filteredNewsList[0].id).toBe('n10')
    expect(wrapper.vm.pagination.total).toBe(1)
    expect(wrapper.vm.getSummary({ summary: '<b>abc</b>' })).toBe('abc')
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
    mocks.showAlertMock.mockClear()
    wrapper.vm.handlePageChange(4)
    await flushMicrotasks()
    expect(mocks.showAlertMock).toHaveBeenCalledWith('boom')

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

  it('uploads editor images, reports current failures, and destroys the editor on unmount', async () => {
    const wrapper = shallowMount(NewsManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    wrapper.vm.openCreateModal()
    const insertFn = vi.fn()
    const file = new File(['image'], 'news.png', { type: 'image/png' })
    const upload = wrapper.vm.editorConfig.MENU_CONF.uploadImage.customUpload
    mocks.requestPostMock.mockResolvedValueOnce({ code: 200, data: { url: 'u1', filename: 'f1' } })
    await upload(file, insertFn)
    expect(insertFn).toHaveBeenCalledWith('u1', 'f1', 'u1')
    insertFn.mockClear()
    mocks.requestPostMock.mockResolvedValueOnce({ code: 201, data: { url: 'u2', filename: 'f2' } })
    await upload(file, insertFn)
    expect(insertFn).toHaveBeenCalledWith('u2', 'f2', 'u2')

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.showAlertMock.mockClear()
    mocks.requestPostMock.mockResolvedValueOnce({ code: 500, message: 'upload bad' })
    await upload(file, insertFn)
    expect(mocks.showAlertMock).toHaveBeenCalledWith('图片上传出错: upload bad')

    // onError alerts + logs
    mocks.showAlertMock.mockClear()
    mocks.requestPostMock.mockRejectedValueOnce(new Error('E1'))
    await upload(file, insertFn)
    expect(errSpy).toHaveBeenCalled()
    expect(mocks.showAlertMock).toHaveBeenCalled()
    expect(wrapper.vm.pendingImageUploads).toBe(0)
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
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限创建新闻')

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
    mocks.showAlertMock.mockClear()
    await wrapper.vm.submitForm('published')
    expect(mocks.showAlertMock).toHaveBeenCalled()

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
    mocks.showConfirmMock.mockResolvedValueOnce(false)
    await wrapper.vm.publishNews('n1')
    expect(mocks.newsApiMock.publishNews).not.toHaveBeenCalled()

    // no permission
    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    await wrapper.vm.revokeNews('n1')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限撤回新闻')

    // revoke success
    mocks.showConfirmMock.mockResolvedValueOnce(true)
    await wrapper.vm.revokeNews('n1')
    expect(mocks.newsApiMock.revokeNews).toHaveBeenCalledWith('n1')

    // delete failure non-200
    mocks.newsApiMock.deleteNews.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.deleteNews('n1')
    expect(mocks.showAlertMock).toHaveBeenCalled()

    // publish failure non-200
    mocks.newsApiMock.publishNews.mockResolvedValueOnce({ code: 500, message: 'pub bad' })
    mocks.showAlertMock.mockClear()
    await wrapper.vm.publishNews('n1')
    expect(mocks.showAlertMock).toHaveBeenCalled()

    // revoke throw
    mocks.newsApiMock.revokeNews.mockRejectedValueOnce(new Error('revoke boom'))
    mocks.showAlertMock.mockClear()
    await wrapper.vm.revokeNews('n1')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('revoke boom')

    // delete throw
    mocks.newsApiMock.deleteNews.mockRejectedValueOnce(new Error('del boom'))
    mocks.showAlertMock.mockClear()
    await wrapper.vm.deleteNews('n1')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('del boom')

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
    await flushMicrotasks()
    await nextTick()
    expect(wrapper.text()).toContain('没有找到符合条件的新闻')
    expect(wrapper.text()).toContain('重置筛选')

    // list rows in draft: publish/edit buttons
    wrapper.vm.searchQuery = ''
    await nextTick()
    await flushMicrotasks()
    await nextTick()
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
    wrapper.vm.pagination.total = 25
    wrapper.vm.pagination.pageSize = 10
    await nextTick()
    const pagination = wrapper.findComponent({ name: 'Pagination' })
    expect(pagination.exists()).toBe(true)
    expect(pagination.props('total')).toBe(25)
    expect(pagination.props('pageSize')).toBe(10)
    expect(pagination.attributes('total-pages')).toBeUndefined()

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

  it('sanitizes the actual news preview while preserving safe content', async () => {
    const wrapper = mount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushMicrotasks()
    wrapper.vm.previewNews({ id: 'n1', title: 'T', content: '<p><strong>正文</strong><img src="/x" onerror="alert(1)"><a href="&#106;avascript:alert(1)">链接</a></p>' })
    await nextTick()
    expect(wrapper.find('.news-preview-content strong').text()).toBe('正文')
    expect(wrapper.find('.news-preview-content img').attributes('onerror')).toBeUndefined()
    expect(wrapper.find('.news-preview-content a').attributes('href')).toBeUndefined()
    wrapper.unmount()
  })

  it.each(['img', 'table', 'pre'])('keeps nested %s tag text in attributes inert through the full preview pipeline', async (tag) => {
    const wrapper = mount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushMicrotasks()
    const attributeText = `<${tag} onmouseover=alert(1)>`
    wrapper.vm.previewNews({ id: 'n1', title: 'T', content: `<p title='${attributeText}'>text</p><img src="/x" alt='${attributeText}'>` })
    await nextTick()

    const parsed = document.createElement('div')
    parsed.innerHTML = wrapper.vm.formattedPreviewContent
    expect(parsed.querySelector('[onmouseover]')).toBeNull()
    expect(parsed.querySelector('p')?.getAttribute('title')).toBe(attributeText)
    expect(parsed.querySelector('img')?.getAttribute('alt')).toBe(attributeText)
    expect(wrapper.find('.news-preview-content [onmouseover]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('applies responsive image/table/pre styles through scoped preview CSS', async () => {
    const scopeId = (NewsManage as any).__scopeId
    const compiled = compileStyle({ source: parse(NewsManageSource).descriptor.styles[0].content, filename: 'NewsManage.vue', id: scopeId, scoped: true })
    expect(compiled.errors).toEqual([])
    const style = document.createElement('style')
    style.textContent = compiled.code
    document.head.appendChild(style)
    const wrapper = mount(NewsManage, { attachTo: document.body, global: { stubs: { Header: true, Pagination: true } } })
    try {
      await flushMicrotasks()
      wrapper.vm.previewNews({ id: 'n1', title: 'T', content: '<img src="/x"><table><tbody><tr><td>单元格</td></tr></tbody></table><pre>代码</pre>' })
      await nextTick()
      const preview = wrapper.find('.news-preview-content')
      const imageStyle = getComputedStyle(preview.find('img').element)
      const tableStyle = getComputedStyle(preview.find('table').element)
      const preStyle = getComputedStyle(preview.find('pre').element)
      expect(imageStyle.maxWidth).toBe('100%')
      expect(imageStyle.height).toBe('auto')
      expect(imageStyle.display).toBe('block')
      expect(tableStyle.maxWidth).toBe('100%')
      expect(tableStyle.boxSizing).toBe('border-box')
      expect(preStyle.maxWidth).toBe('100%')
      expect(preStyle.whiteSpace).toBe('pre-wrap')
      expect(preStyle.wordBreak).toBe('break-all')
      expect(preStyle.overflowX).toBe('auto')
    } finally {
      wrapper.unmount()
      style.remove()
    }
  })

  it('ignores an older list response after a new page request completes', async () => {
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushMicrotasks()
    let resolveOld!: (value: any) => void
    mocks.newsApiMock.getNews.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    mocks.newsApiMock.getNews.mockResolvedValueOnce({ code: 200, data: { items: [{ id: 'new', title: 'new' }], meta: { total: 1 } } })
    wrapper.vm.handlePageChange(2)
    wrapper.vm.handlePageChange(3)
    await flushMicrotasks()
    resolveOld({ code: 200, data: { items: [{ id: 'old', title: 'old' }], meta: { total: 30 } } })
    await flushMicrotasks()
    expect(wrapper.vm.newsList[0].id).toBe('new')
    expect(wrapper.vm.pagination.total).toBe(1)
    wrapper.unmount()
  })

  it('limits canteen-scoped managers to their own publisher and filters', async () => {
    const originalUser = mocks.authStoreMock.user
    mocks.authStoreMock.user = { id: 'a1', username: 'admin', canteenId: 'c1', canteenName: 'C1' } as any
    const wrapper = mount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushMicrotasks()
    await nextTick()
    expect(mocks.canteenApiMock.getCanteens).not.toHaveBeenCalled()
    expect(wrapper.find('option[value="all"]').exists()).toBe(false)
    wrapper.vm.openCreateModal()
    expect(wrapper.vm.newsForm.canteenId).toBe('c1')
    expect(mocks.newsApiMock.getNews).toHaveBeenCalledWith(expect.objectContaining({ canteenId: 'c1' }))
    wrapper.vm.newsForm.title = '所属食堂公告'
    wrapper.vm.newsForm.summary = '摘要'
    wrapper.vm.valueHtml = '<p>正文</p>'
    await wrapper.vm.submitForm('draft')
    expect(mocks.newsApiMock.createNews).toHaveBeenCalledWith(expect.objectContaining({ canteenId: 'c1' }))
    wrapper.unmount()
    mocks.authStoreMock.user = originalUser
  })

  it.each(['success', 'failure'])('keeps a later editor and its pending save owned after older %s', async (result) => {
    const first = deferred()
    const second = deferred()
    mocks.newsApiMock.updateNews.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushPromises()
    wrapper.vm.editNews(draftNews('A'))
    const saveA = wrapper.vm.submitForm('draft')
    wrapper.vm.closeModal()
    wrapper.vm.editNews(draftNews('B'))
    const saveB = wrapper.vm.submitForm('draft')
    mocks.showAlertMock.mockClear()
    mocks.newsApiMock.getNews.mockClear()

    if (result === 'success') first.resolve({ code: 200, data: { id: 'A' } })
    else first.reject(new Error('old save failed'))
    await saveA
    expect(wrapper.vm.showEditModal).toBe(true)
    expect(wrapper.vm.newsForm.title).toBe('B')
    expect(wrapper.vm.valueHtml).toBe('<p>B</p>')
    expect(wrapper.vm.isSubmitting).toBe(true)
    expect(mocks.showAlertMock).not.toHaveBeenCalled()
    expect(mocks.newsApiMock.getNews).not.toHaveBeenCalled()

    second.resolve({ code: 200, data: { id: 'B' } })
    await saveB
    expect(wrapper.vm.isSubmitting).toBe(false)
    expect(wrapper.vm.showEditModal).toBe(false)
    expect(wrapper.vm.newsForm.title).toBe('')
    expect(mocks.showAlertMock).toHaveBeenCalledTimes(1)
    expect(mocks.newsApiMock.getNews).toHaveBeenCalledTimes(1)
  })

  it.each(['close', 'unmount', 'session'])('drops late save success and failure after %s', async (boundary) => {
    for (const result of ['success', 'failure']) {
      const pending = deferred()
      mocks.newsApiMock.createNews.mockReturnValueOnce(pending.promise)
      const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
      await flushPromises()
      wrapper.vm.openCreateModal()
      Object.assign(wrapper.vm.newsForm, draftNews('new'))
      wrapper.vm.valueHtml = '<p>new</p>'
      const saving = wrapper.vm.submitForm('published')
      if (boundary === 'close') wrapper.vm.closeModal()
      if (boundary === 'unmount') wrapper.unmount()
      if (boundary === 'session') invalidateAuthSession()
      mocks.showAlertMock.mockClear()
      mocks.newsApiMock.getNews.mockClear()
      mocks.newsApiMock.publishNews.mockClear()

      if (result === 'success') pending.resolve({ code: 200, data: { id: 'new' } })
      else pending.reject(new Error('old save failed'))
      await saving
      expect(mocks.newsApiMock.publishNews).not.toHaveBeenCalled()
      expect(mocks.showAlertMock).not.toHaveBeenCalled()
      expect(mocks.newsApiMock.getNews).not.toHaveBeenCalled()
      if (boundary !== 'unmount') {
        expect(wrapper.vm.isSubmitting).toBe(false)
        expect(wrapper.vm.showCreateModal).toBe(false)
        wrapper.unmount()
      }
    }
  })

  it.each(['create', 'update'])('snapshots and serializes the %s then publish save flow', async (kind) => {
    const saving = deferred()
    const publishing = deferred()
    const api = kind === 'create' ? mocks.newsApiMock.createNews : mocks.newsApiMock.updateNews
    api.mockReturnValueOnce(saving.promise)
    mocks.newsApiMock.publishNews.mockReturnValueOnce(publishing.promise)
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushPromises()
    if (kind === 'update') wrapper.vm.editNews(draftNews('saved'))
    else {
      wrapper.vm.openCreateModal()
      Object.assign(wrapper.vm.newsForm, draftNews('saved'))
      wrapper.vm.valueHtml = '<p>saved</p>'
    }
    api.mockClear()
    const first = wrapper.vm.submitForm('published')
    const duplicate = wrapper.vm.submitForm('published')
    expect(api).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.isSubmitting).toBe(true)
    wrapper.vm.newsForm.title = 'later title'
    wrapper.vm.valueHtml = '<p>later content</p>'
    const payload = api.mock.calls[0][kind === 'create' ? 0 : 1]
    expect(payload).toMatchObject({ title: 'saved', content: '<p>saved</p>' })

    saving.resolve({ code: 200, data: { id: 'saved' } })
    await flushPromises()
    expect(mocks.newsApiMock.publishNews).toHaveBeenCalledWith('saved')
    expect(wrapper.vm.isSubmitting).toBe(true)
    publishing.resolve({ code: 200 })
    await first
    await duplicate
    expect(wrapper.vm.isSubmitting).toBe(false)
    expect(wrapper.vm.showCreateModal || wrapper.vm.showEditModal).toBe(false)
  })

  it('preserves a reopened draft when an older publish request finishes', async () => {
    const publishing = deferred()
    mocks.newsApiMock.publishNews.mockReturnValueOnce(publishing.promise)
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushPromises()
    wrapper.vm.editNews(draftNews('A'))
    const saving = wrapper.vm.submitForm('published')
    await flushPromises()
    expect(mocks.newsApiMock.publishNews).toHaveBeenCalledWith('A')
    wrapper.vm.closeModal()
    wrapper.vm.editNews(draftNews('B'))
    mocks.showAlertMock.mockClear()
    mocks.newsApiMock.getNews.mockClear()
    publishing.resolve({ code: 200 })
    await saving
    expect(wrapper.vm.showEditModal).toBe(true)
    expect(wrapper.vm.newsForm.title).toBe('B')
    expect(wrapper.vm.isSubmitting).toBe(false)
    expect(mocks.showAlertMock).not.toHaveBeenCalled()
    expect(mocks.newsApiMock.getNews).not.toHaveBeenCalled()
  })

  it('closes a saved draft after switching from the published list and permits the next editor', async () => {
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } } )
    wrapper.vm.openCreateModal()
    Object.assign(wrapper.vm.newsForm, draftNews('new'))
    wrapper.vm.valueHtml = '<p>new</p>'
    await wrapper.vm.submitForm('draft')
    expect(wrapper.vm.currentStatus).toBe('draft')
    expect(wrapper.vm.showCreateModal).toBe(false)
    expect(wrapper.vm.isSubmitting).toBe(false)
    wrapper.vm.openCreateModal()
    expect(wrapper.vm.newsForm.title).toBe('')
    expect(wrapper.vm.isSubmitting).toBe(false)
  })

  it('releases a failed current save for retry without resetting its draft', async () => {
    const request = deferred()
    mocks.newsApiMock.updateNews.mockReturnValueOnce(request.promise)
    const wrapper = mount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    wrapper.vm.editNews(draftNews('A'))
    const editor = { destroy: vi.fn(), disable: vi.fn(), enable: vi.fn() }
    wrapper.vm.handleCreated(editor)
    const saving = wrapper.vm.submitForm('draft')
    await nextTick()
    expect(editor.disable).toHaveBeenCalledTimes(1)
    expect(wrapper.find('input[placeholder="请输入新闻标题"]').attributes('disabled')).toBeDefined()
    request.reject(new Error('save failed'))
    await saving
    await nextTick()
    expect(wrapper.vm.isSubmitting).toBe(false)
    expect(editor.enable).toHaveBeenCalledTimes(1)
    expect(wrapper.find('input[placeholder="请输入新闻标题"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.vm.showEditModal).toBe(true)
    expect(wrapper.vm.newsForm.title).toBe('A')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('save failed')
    await wrapper.vm.submitForm('draft')
    expect(wrapper.vm.showEditModal).toBe(false)
  })

  it('retires pending editor and row actions across KeepAlive deactivation and reactivation', async () => {
    const save = deferred()
    const confirmation = deferred<boolean>()
    mocks.newsApiMock.updateNews.mockReturnValueOnce(save.promise)
    mocks.showConfirmMock.mockReturnValueOnce(confirmation.promise)
    const visible = ref(true)
    const host = mount(defineComponent({
      setup: () => () => h(KeepAlive, null, {
        default: () => visible.value ? h(NewsManage, { key: 'news' }) : h('div'),
      }),
    }), { global: { stubs: { Header: true, Pagination: true } } })
    await flushPromises()
    const news = host.findComponent(NewsManage)
    news.vm.editNews(draftNews('A'))
    const saving = news.vm.submitForm('published')
    const deleting = news.vm.deleteNews('A')
    visible.value = false
    await nextTick()
    visible.value = true
    await nextTick()
    await flushPromises()
    news.vm.editNews(draftNews('B'))
    mocks.newsApiMock.getNews.mockClear()
    mocks.showAlertMock.mockClear()
    save.resolve({ code: 200, data: { id: 'A' } })
    confirmation.resolve(true)
    await Promise.all([saving, deleting])
    expect(news.vm.showEditModal).toBe(true)
    expect(news.vm.newsForm.title).toBe('B')
    expect(news.vm.isSubmitting).toBe(false)
    expect(mocks.newsApiMock.publishNews).not.toHaveBeenCalled()
    expect(mocks.newsApiMock.deleteNews).not.toHaveBeenCalled()
    expect(mocks.newsApiMock.getNews).not.toHaveBeenCalled()
    expect(mocks.showAlertMock).not.toHaveBeenCalled()
  })

  it('sanitizes HTML at both editor input and save boundaries', async () => {
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    wrapper.vm.editNews({ ...draftNews('safe'), content: '<p><a href="javascript:alert(1)">safe</a><img src="/x" onerror="alert(1)"></p>' })
    expect(wrapper.vm.valueHtml).not.toMatch(/javascript:|onerror/)
    wrapper.vm.valueHtml = '<p><strong>safe</strong><img src="/x" onerror="alert(1)"></p>'
    await wrapper.vm.submitForm('draft')
    const payload = mocks.newsApiMock.updateNews.mock.calls[0][1]
    expect(payload.content).toContain('<strong>safe</strong>')
    expect(payload.content).not.toContain('onerror')
  })

  it.each(['create', 'update'])('sends an explicit null publisher for a whole-school %s', async (kind) => {
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    if (kind === 'update') wrapper.vm.editNews({ ...draftNews('A'), canteenId: 'c1' })
    else {
      wrapper.vm.openCreateModal()
      Object.assign(wrapper.vm.newsForm, draftNews('A'))
      wrapper.vm.valueHtml = '<p>A</p>'
    }
    wrapper.vm.newsForm.canteenId = ''
    await wrapper.vm.submitForm('draft')
    const api = kind === 'create' ? mocks.newsApiMock.createNews : mocks.newsApiMock.updateNews
    expect(api.mock.calls[0][kind === 'create' ? 0 : 1].canteenId).toBeNull()
  })

  it('owns image upload callbacks and pending state by editor lifecycle', async () => {
    const first = deferred()
    const second = deferred()
    mocks.requestPostMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushPromises()
    wrapper.vm.editNews(draftNews('A'))
    const destroyA = vi.fn()
    wrapper.vm.handleCreated({ destroy: destroyA })
    const uploadA = wrapper.vm.editorConfig.MENU_CONF.uploadImage.customUpload
    const insertA = vi.fn()
    const file = new File(['image'], 'news.png', { type: 'image/png' })
    const pendingA = uploadA(file, insertA)
    wrapper.vm.closeModal()
    expect(destroyA).toHaveBeenCalledTimes(1)
    wrapper.vm.editNews(draftNews('B'))
    const destroyB = vi.fn()
    wrapper.vm.handleCreated({ destroy: destroyB })
    const insertB = vi.fn()
    const pendingB = wrapper.vm.editorConfig.MENU_CONF.uploadImage.customUpload(file, insertB)
    mocks.showAlertMock.mockClear()
    first.resolve({ code: 200, data: { url: '/A.png', filename: 'A.png' } })
    await pendingA
    expect(insertA).not.toHaveBeenCalled()
    expect(wrapper.vm.pendingImageUploads).toBe(1)
    expect(destroyB).not.toHaveBeenCalled()
    await wrapper.vm.submitForm('draft')
    expect(mocks.newsApiMock.updateNews).not.toHaveBeenCalled()

    second.resolve({ code: 201, data: { url: '/B.png', filename: 'B.png' } })
    await pendingB
    expect(insertB).toHaveBeenCalledWith('/B.png', 'B.png', '/B.png')
    expect(wrapper.vm.pendingImageUploads).toBe(0)
    const [url, body, options] = mocks.requestPostMock.mock.calls[1]
    expect(url).toBe('/upload/image')
    expect(body.get('file')).toBe(file)
    expect(options.headers).toEqual({ 'Content-Type': 'multipart/form-data' })
  })

  it('ignores a retired editor callback and upload after an auth session change', async () => {
    const upload = deferred()
    mocks.requestPostMock.mockReturnValueOnce(upload.promise)
    const wrapper = shallowMount(NewsManage, { global: { stubs: { Header: true, Pagination: true } } })
    await flushPromises()
    wrapper.vm.editNews(draftNews('A'))
    const oldCreated = wrapper.vm.handleCreated
    const destroy = vi.fn()
    oldCreated({ destroy })
    const insert = vi.fn()
    const pending = wrapper.vm.editorConfig.MENU_CONF.uploadImage.customUpload(new File(['x'], 'x.png'), insert)
    invalidateAuthSession()
    mocks.showAlertMock.mockClear()
    upload.reject(new Error('old upload failed'))
    await pending
    expect(insert).not.toHaveBeenCalled()
    expect(mocks.showAlertMock).not.toHaveBeenCalled()
    expect(wrapper.vm.pendingImageUploads).toBe(0)
    expect(destroy).toHaveBeenCalledTimes(1)
    const lateDestroy = vi.fn()
    oldCreated({ destroy: lateDestroy })
    expect(lateDestroy).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.editorRef).toBeUndefined()
  })
})
