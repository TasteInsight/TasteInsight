import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, KeepAlive, nextTick, reactive, ref } from 'vue'
import ModifyDish from '@/views/ModifyDish.vue'
import NewsManage from '@/views/NewsManage.vue'
import CommentManage from '@/views/CommentManage.vue'
import BatchActionBar from '@/components/Common/BatchActionBar.vue'
import { invalidateAuthSession } from '@/utils/auth-session'

const mocks = vi.hoisted(() => ({
  route: { fullPath: '/manage' },
  auth: { user: { id: 'admin' }, hasPermission: vi.fn() },
  dish: { getDishes: vi.fn(), getDishReviews: vi.fn(), batchDeleteDishes: vi.fn(), deleteDish: vi.fn() },
  news: { getNews: vi.fn(), batchDeleteNews: vi.fn(), deleteNews: vi.fn() },
  review: { getReviewComments: vi.fn(), batchDeleteReviews: vi.fn(), batchDeleteComments: vi.fn(), deleteReview: vi.fn(), deleteComment: vi.fn() },
  canteen: { getCanteens: vi.fn(), getWindows: vi.fn() },
  confirm: vi.fn(),
  alert: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/store/modules/use-auth-store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/store/modules/use-dish-store', () => ({ useDishStore: () => ({}) }))
vi.mock('@/api/modules/dish', () => ({ dishApi: mocks.dish }))
vi.mock('@/api/modules/news', () => ({ newsApi: mocks.news }))
vi.mock('@/api/modules/review', () => ({ reviewApi: mocks.review }))
vi.mock('@/api/modules/canteen', () => ({ canteenApi: mocks.canteen }))
vi.mock('@/composables/useModal', () => ({ showAlert: mocks.alert, showConfirmDanger: mocks.confirm, showConfirm: vi.fn() }))
vi.mock('@wangeditor/editor-for-vue', () => ({
  Editor: { template: '<div />' }, Toolbar: { template: '<div />' },
}))
vi.mock('@wangeditor/editor/dist/css/style.css', () => ({}))

enableAutoUnmount(afterEach)

const permissions = ref<string[]>([])
const allPermissions = ['dish:delete', 'review:delete', 'comment:delete', 'news:delete', 'canteen:view']
const dishes = [{ id: 'd1', name: '米饭' }, { id: 'd2', name: '面条' }]
const news = [{ id: 'n1', title: '食堂公告一' }, { id: 'n2', title: '食堂公告二' }]
const reviews = [
  { id: 'r1', dishId: 'd1', userNickname: '甲', rating: 4, content: '好吃', status: 'approved' },
  { id: 'r2', dishId: 'd1', userNickname: '乙', rating: 3, content: '尚可', status: 'approved' },
]
const comment = (id: string, reviewId = 'r1') => ({ id, reviewId, userNickname: '丙', content: id, status: 'approved', floor: 1 })
const pageData = (items: any[], total = items.length, page = 1, pageSize = 10) => ({
  code: 200, data: { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
})
const success = { code: 200, data: { deletedCount: 2 } }
const deferred = () => {
  let resolve!: (value: any) => void
  let reject!: (reason: any) => void
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const cases = [
  { name: '菜品', component: ModifyDish, selection: 'dishSelection', action: 'handleBatchDelete', permission: 'dish:delete', batch: mocks.dish.batchDeleteDishes, single: mocks.dish.deleteDish, ids: ['d1', 'd2'], allLabel: '全选当前页菜品' },
  { name: '新闻', component: NewsManage, selection: 'newsSelection', action: 'handleBatchDelete', permission: 'news:delete', batch: mocks.news.batchDeleteNews, single: mocks.news.deleteNews, ids: ['n1', 'n2'], allLabel: '全选当前页新闻' },
  { name: '评价', component: CommentManage, selection: 'reviewSelection', action: 'handleBatchDeleteReviews', permission: 'review:delete', batch: mocks.review.batchDeleteReviews, single: mocks.review.deleteReview, ids: ['r1', 'r2'], allLabel: '全选当前页评价' },
  { name: '评论', component: CommentManage, selection: 'commentSelection', action: 'handleBatchDeleteComments', permission: 'comment:delete', batch: mocks.review.batchDeleteComments, single: mocks.review.deleteComment, ids: ['c1', 'c2'], allLabel: '全选当前已加载评论' },
] as const

const global = { stubs: { Header: true, SearchBar: true, Pagination: true } }

async function setupView(resource: typeof cases[number]) {
  const wrapper = mount(resource.component, { global })
  await flushPromises()
  if (resource.component === CommentManage) {
    await wrapper.vm.selectDish(dishes[0])
    await flushPromises()
  }
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  invalidateAuthSession()
  mocks.route = reactive({ fullPath: '/manage' })
  permissions.value = [...allPermissions]
  mocks.auth.hasPermission.mockImplementation(permission => permissions.value.includes(permission))
  mocks.confirm.mockResolvedValue(true)
  mocks.alert.mockResolvedValue(undefined)
  mocks.canteen.getCanteens.mockResolvedValue(pageData([]))
  mocks.canteen.getWindows.mockResolvedValue(pageData([]))
  mocks.dish.getDishes.mockResolvedValue(pageData(dishes))
  mocks.news.getNews.mockResolvedValue(pageData(news))
  mocks.dish.getDishReviews.mockImplementation(async (dishId: string) => pageData(
    dishId === 'd1' ? reviews : [{ ...reviews[0], id: 'r3', dishId }],
  ))
  mocks.review.getReviewComments.mockImplementation(async (reviewId: string) => pageData(
    [comment(reviewId === 'r1' ? 'c1' : reviewId === 'r2' ? 'c2' : 'c3', reviewId)], 1, 1, 30,
  ))
  for (const resource of cases) resource.batch.mockResolvedValue(success)
})

describe.each(cases)('$name batch deletion', resource => {
  it('uses native row selection with a partial and current-page select-all state', async () => {
    const wrapper = await setupView(resource)
    const selection = wrapper.vm[resource.selection]
    await wrapper.get(`input[aria-label^="选择${resource.name} "]`).setValue(true)
    const all = wrapper.get<HTMLInputElement>(`input[aria-label="${resource.allLabel}"]`)
    expect(all.element.indeterminate).toBe(true)
    expect(selection.selectedCount).toBe(1)
    await all.setValue(true)
    expect(selection.selectedIds).toEqual(resource.ids)
    expect(all.element.checked).toBe(true)
    expect(all.element.indeterminate).toBe(false)
  })

  it('hides selection without delete permission and refuses direct submission', async () => {
    permissions.value = allPermissions.filter(permission => permission !== resource.permission)
    const wrapper = await setupView(resource)
    expect(wrapper.find(`input[aria-label="${resource.allLabel}"]`).exists()).toBe(false)
    expect(wrapper.findAllComponents(BatchActionBar).some(bar => bar.props('resource') === resource.name)).toBe(false)
    wrapper.vm[resource.selection].toggleAll()
    await wrapper.vm[resource.action]()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(resource.batch).not.toHaveBeenCalled()
  })

  it('preserves selection on cancel and failure, then clears it after one successful batch', async () => {
    const wrapper = await setupView(resource)
    const selection = wrapper.vm[resource.selection]
    selection.toggleAll()
    mocks.confirm.mockResolvedValueOnce(false)
    await wrapper.vm[resource.action]()
    expect(resource.batch).not.toHaveBeenCalled()
    expect(selection.selectedIds).toEqual(resource.ids)

    resource.batch.mockRejectedValueOnce(new Error('删除失败，请重试'))
    await wrapper.vm[resource.action]()
    expect(selection.selectedIds).toEqual(resource.ids)
    expect(wrapper.vm.isBatchDeleting).toBe(false)
    expect(mocks.alert).toHaveBeenLastCalledWith('删除失败，请重试')

    resource.batch.mockResolvedValueOnce({ code: 400, message: '整批删除失败' })
    await wrapper.vm[resource.action]()
    expect(selection.selectedIds).toEqual(resource.ids)
    await wrapper.vm[resource.action]()
    expect(resource.batch).toHaveBeenLastCalledWith(resource.ids)
    expect(resource.single).not.toHaveBeenCalled()
    expect(selection.selectedCount).toBe(0)
  })

  it('blocks double clicks during confirmation and the request', async () => {
    const wrapper = await setupView(resource)
    wrapper.vm[resource.selection].toggleAll()
    const confirm = deferred()
    const request = deferred()
    mocks.confirm.mockReturnValueOnce(confirm.promise)
    resource.batch.mockReturnValueOnce(request.promise)
    const pending = wrapper.vm[resource.action]()
    await wrapper.vm[resource.action]()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    confirm.resolve(true)
    await flushPromises()
    await wrapper.vm[resource.action]()
    expect(resource.batch).toHaveBeenCalledExactlyOnceWith(resource.ids)
    request.resolve(success)
    await pending
  })

  it.each(['filter', 'route', 'account', 'permission'])('rechecks %s after confirmation before sending', async change => {
    const wrapper = await setupView(resource)
    wrapper.vm[resource.selection].toggleAll()
    const confirm = deferred()
    mocks.confirm.mockReturnValueOnce(confirm.promise)
    const pending = wrapper.vm[resource.action]()
    if (change === 'filter') wrapper.vm.searchQuery = '新的筛选'
    if (change === 'route') mocks.route.fullPath = '/other'
    if (change === 'account') invalidateAuthSession()
    if (change === 'permission') permissions.value = allPermissions.filter(permission => permission !== resource.permission)
    confirm.resolve(true)
    await pending
    expect(resource.batch).not.toHaveBeenCalled()
    expect(wrapper.vm[resource.selection].selectedCount).toBe(0)
  })

  it('ignores a successful late mutation response after changing context', async () => {
    const wrapper = await setupView(resource)
    wrapper.vm[resource.selection].toggleAll()
    const request = deferred()
    resource.batch.mockReturnValueOnce(request.promise)
    const pending = wrapper.vm[resource.action]()
    await flushPromises()
    if (resource.component === CommentManage) await wrapper.vm.selectDish(dishes[1])
    else wrapper.vm.handlePageChange(2)
    await flushPromises()
    const reads = [mocks.dish.getDishes.mock.calls.length, mocks.news.getNews.mock.calls.length,
      mocks.dish.getDishReviews.mock.calls.length, mocks.review.getReviewComments.mock.calls.length]
    request.resolve(success)
    await pending
    expect(mocks.alert).not.toHaveBeenCalled()
    expect([mocks.dish.getDishes.mock.calls.length, mocks.news.getNews.mock.calls.length,
      mocks.dish.getDishReviews.mock.calls.length, mocks.review.getReviewComments.mock.calls.length]).toEqual(reads)
    if (resource.component === CommentManage) expect(wrapper.vm.reviews.map((review: any) => review.id)).toEqual(['r3'])
  })

  it('invalidates a pending confirmation when a kept-alive view is deactivated', async () => {
    const shown = ref(true)
    const host = mount(defineComponent({
      setup: () => () => h(KeepAlive, null, {
        default: () => shown.value ? h(resource.component as any) : h('div'),
      }),
    }), { global })
    await flushPromises()
    const wrapper = host.findComponent(resource.component as any)
    if (resource.component === CommentManage) {
      await wrapper.vm.selectDish(dishes[0])
      await flushPromises()
    }
    wrapper.vm[resource.selection].toggleAll()
    const confirm = deferred()
    mocks.confirm.mockReturnValueOnce(confirm.promise)
    const pending = wrapper.vm[resource.action]()
    shown.value = false
    await nextTick()
    shown.value = true
    await nextTick()
    confirm.resolve(true)
    await pending
    expect(resource.batch).not.toHaveBeenCalled()
    expect(wrapper.vm[resource.selection].selectedCount).toBe(0)
  })
})

describe('batch page and reply boundaries', () => {
  it.each(cases.slice(0, 2))('finishes the $name read when only delete permission changes', async resource => {
    const response = deferred()
    const load = resource.component === ModifyDish ? mocks.dish.getDishes : mocks.news.getNews
    load.mockReturnValueOnce(response.promise)
    const wrapper = mount(resource.component, { global })
    permissions.value = allPermissions.filter(permission => permission !== resource.permission)
    response.resolve(pageData(resource.component === ModifyDish ? dishes : news))
    await flushPromises()
    expect(wrapper.vm.isLoading).toBe(false)
    expect(resource.component === ModifyDish ? wrapper.vm.filteredDishes : wrapper.vm.filteredNewsList).toHaveLength(2)
    expect(wrapper.find(`input[aria-label="${resource.allLabel}"]`).exists()).toBe(false)
  })

  it.each(cases.slice(0, 3))('clamps the empty last page after deleting $name', async resource => {
    const wrapper = await setupView(resource)
    const load = resource.component === ModifyDish ? mocks.dish.getDishes
      : resource.component === NewsManage ? mocks.news.getNews : mocks.dish.getDishReviews
    const items = resource.component === ModifyDish ? dishes : resource.component === NewsManage ? news : reviews
    load.mockResolvedValueOnce(pageData([items[0]], 11, 2))
    if (resource.component === CommentManage) wrapper.vm.handleReviewPageChange(2)
    else wrapper.vm.handlePageChange(2)
    await flushPromises()
    wrapper.vm[resource.selection].toggleAll()
    load.mockResolvedValueOnce(pageData([], 10, 2)).mockResolvedValueOnce(pageData(items, 10))
    await wrapper.vm[resource.action]()
    expect(resource.component === ModifyDish ? wrapper.vm.currentPage : resource.component === NewsManage
      ? wrapper.vm.pagination.page : wrapper.vm.reviewPage).toBe(1)
    expect(load).toHaveBeenLastCalledWith(...(resource.component === CommentManage
      ? ['d1', expect.objectContaining({ page: 1 })]
      : [expect.objectContaining({ page: 1 })]))
    expect(wrapper.vm[resource.selection].selectedCount).toBe(0)
  })

  it('only selects replies belonging to visible reviews, and does not select newly loaded replies', async () => {
    const resource = cases[3]
    const wrapper = await setupView(resource)
    wrapper.vm.commentsMap.hidden = [comment('hidden', 'hidden')]
    wrapper.vm.commentSelection.toggleAll()
    expect(wrapper.vm.commentSelection.selectedIds).toEqual(['c1', 'c2'])
    wrapper.vm.commentPagination.r1.totalPages = 2
    mocks.review.getReviewComments.mockResolvedValueOnce(pageData([comment('c-new')], 2, 2, 30))
    await wrapper.vm.loadMoreComments('r1')
    expect(wrapper.vm.commentSelection.selectedIds).toEqual(['c1', 'c2'])
    expect(wrapper.vm.commentSelection.someSelected).toBe(true)
    wrapper.vm.reviews = [reviews[1]]
    expect(wrapper.vm.commentSelection.selectedIds).toEqual(['c2'])
    await wrapper.vm.handleBatchDeleteComments()
    expect(mocks.review.batchDeleteComments).toHaveBeenCalledExactlyOnceWith(['c2'])
  })

  it('shows the 100-item limit without silently truncating selected replies', async () => {
    const wrapper = await setupView(cases[3])
    wrapper.vm.commentsMap = { r1: Array.from({ length: 101 }, (_, i) => comment(`c${i}`)) }
    wrapper.vm.commentSelection.toggleAll()
    await nextTick()
    expect(wrapper.vm.commentSelection.selectedCount).toBe(101)
    const bar = wrapper.findAllComponents(BatchActionBar).find(item => item.props('resource') === '评论')!
    expect(bar.text()).toContain('每次最多删除 100 条')
    expect(bar.get('button:last-child').attributes('disabled')).toBeDefined()
    await wrapper.vm.handleBatchDeleteComments()
    expect(mocks.review.batchDeleteComments).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('does not apply an older dish page response over a newer page', async () => {
    const oldPage = deferred()
    mocks.dish.getDishes.mockReturnValueOnce(oldPage.promise)
    const wrapper = mount(ModifyDish, { global })
    mocks.dish.getDishes.mockResolvedValueOnce(pageData([dishes[1]], 11, 2))
    wrapper.vm.handlePageChange(2)
    await flushPromises()
    oldPage.resolve(pageData([dishes[0]], 11))
    await flushPromises()
    expect(wrapper.vm.filteredDishes.map((dish: any) => dish.id)).toEqual(['d2'])
    expect(wrapper.vm.isLoading).toBe(false)
  })
})
