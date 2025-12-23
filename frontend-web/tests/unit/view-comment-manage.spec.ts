import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  authStoreMock: {
    hasPermission: vi.fn((p: string) => ['review:delete', 'comment:delete'].includes(p)),
  },
  dishApiMock: {
    getDishes: vi.fn(),
    getDishReviews: vi.fn(),
  },
  reviewApiMock: {
    getReviewComments: vi.fn(),
    deleteReview: vi.fn(),
    deleteComment: vi.fn(),
  },
  canteenApiMock: {
    getCanteens: vi.fn(),
    getWindows: vi.fn(),
  },
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/api/modules/dish', () => ({
  dishApi: mocks.dishApiMock,
}))

vi.mock('@/api/modules/review', () => ({
  reviewApi: mocks.reviewApiMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

import CommentManage from '@/views/CommentManage.vue'

function flushMicrotasks() {
  return Promise.resolve()
}

async function flushAll() {
  // enough for: promise chain + nextTick updates
  await flushMicrotasks()
  await nextTick()
  await flushMicrotasks()
  await nextTick()
}

describe('views/CommentManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.canteenApiMock.getCanteens.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1', name: 'C1' }] },
    })

    mocks.canteenApiMock.getWindows.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'w1', name: 'W1' }] },
    })

    mocks.dishApiMock.getDishes.mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            id: 'd1',
            name: 'Noodles',
            canteenName: 'C1',
            windowName: 'W1',
            images: ['img'],
            reviewCount: 1,
          },
          {
            id: 'd2',
            name: 'Rice',
            canteenName: 'C1',
            windowName: 'W1',
            images: [],
            reviewCount: 0,
          },
        ],
        meta: { total: 2 },
      },
    })

    mocks.dishApiMock.getDishReviews.mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            id: 'rv1',
            content: 'ok',
            rating: 5,
            status: 'approved',
            createdAt: '2025-01-01T10:00:00',
            userNickname: 'u1',
            images: ['a', 'b'],
          },
          {
            id: 'rv2',
            content: 'meh',
            rating: 2,
            status: 'pending',
            createdAt: '2025-01-02T10:00:00',
            userNickname: 'u2',
            images: [],
          },
        ],
        meta: { total: 2 },
      },
    })

    mocks.reviewApiMock.getReviewComments.mockImplementation((reviewId: string) => {
      if (reviewId === 'rv1') {
        return Promise.resolve({
          code: 200,
          data: {
            items: [{ id: 'cm1', content: 'c1', floor: 1, status: 'approved', createdAt: '2025-01-01T11:00:00' }],
            meta: { total: 1 },
          },
        })
      }
      return Promise.reject(new Error('boom'))
    })

    mocks.reviewApiMock.deleteReview.mockResolvedValue({ code: 200 })
    mocks.reviewApiMock.deleteComment.mockResolvedValue({ code: 200 })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    vi.useRealTimers()
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
    ;(window.open as any).mockRestore?.()
  })

  it('loads canteens and dishes on mount', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    expect(mocks.canteenApiMock.getCanteens).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
    expect(mocks.dishApiMock.getDishes).toHaveBeenCalledWith({ page: 1, pageSize: 10, keyword: undefined })
    expect(wrapper.vm.totalDishes).toBe(2)

    wrapper.unmount()
  })

  it('handleSearchChange debounces and reloads dishes', async () => {
    vi.useFakeTimers()

    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    mocks.dishApiMock.getDishes.mockClear()

    wrapper.vm.searchQuery = 'noo'
    wrapper.vm.handleSearchChange()
    wrapper.vm.handleSearchChange()

    // not yet
    expect(mocks.dishApiMock.getDishes).toHaveBeenCalledTimes(0)

    vi.advanceTimersByTime(500)
    await flushMicrotasks()
    await nextTick()

    expect(wrapper.vm.dishPage).toBe(1)
    expect(mocks.dishApiMock.getDishes).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('filters dishes by searchQuery (client-side computed)', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    wrapper.vm.searchQuery = 'nood'
    await nextTick()

    expect(wrapper.vm.filteredDishes).toHaveLength(1)
    expect(wrapper.vm.filteredDishes[0].id).toBe('d1')

    wrapper.unmount()
  })

  it('handles canteen/window filters and windows loading errors', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    mocks.dishApiMock.getDishes.mockClear()

    wrapper.vm.selectedCanteenId = 'c1'
    await wrapper.vm.handleCanteenChange()
    await flushMicrotasks()
    await nextTick()

    expect(wrapper.vm.selectedWindowId).toBe('')
    expect(mocks.canteenApiMock.getWindows).toHaveBeenCalledWith('c1', { page: 1, pageSize: 100 })
    expect(mocks.dishApiMock.getDishes).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      keyword: undefined,
      canteenId: 'c1',
    })

    // window change adds windowId
    mocks.dishApiMock.getDishes.mockClear()
    wrapper.vm.selectedWindowId = 'w1'
    wrapper.vm.handleWindowChange()
    await flushMicrotasks()
    await nextTick()

    expect(mocks.dishApiMock.getDishes).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      keyword: undefined,
      canteenId: 'c1',
      windowId: 'w1',
    })

    // windows load failure should be swallowed
    mocks.canteenApiMock.getWindows.mockRejectedValueOnce(new Error('bad'))
    wrapper.vm.selectedCanteenId = 'c1'
    await wrapper.vm.handleCanteenChange()

    wrapper.unmount()
  })

  it('selectDish loads reviews then comments (allSettled) and totals', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    wrapper.vm.selectDish({ id: 'd1', name: 'Noodles' })
    await flushAll()

    expect(wrapper.vm.selectedDishId).toBe('d1')
    expect(mocks.dishApiMock.getDishReviews).toHaveBeenCalledWith('d1', { page: 1, pageSize: 10 })

    // comments: rv1 fulfilled, rv2 rejected => only rv1 in map
    expect(mocks.reviewApiMock.getReviewComments).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.getCommentsByReviewId('rv1')).toHaveLength(1)
    expect(wrapper.vm.getCommentsByReviewId('rv2')).toHaveLength(0)
    expect(wrapper.vm.totalComments).toBe(1)

    wrapper.unmount()
  })

  it('delete review/comment handle permission, confirm cancel, non-200 and catch', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    // no permission
    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleDeleteReview({ id: 'rv1' })
    expect(window.alert).toHaveBeenCalledWith('您没有权限删除评价')

    // confirm cancel
    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.handleDeleteReview({ id: 'rv1' })
    expect(mocks.reviewApiMock.deleteReview).toHaveBeenCalledTimes(0)

    // non-200
    mocks.reviewApiMock.deleteReview.mockResolvedValueOnce({ code: 400, message: 'bad' })
    await wrapper.vm.handleDeleteReview({ id: 'rv1' })
    expect(window.alert).toHaveBeenCalledWith('bad')

    // catch
    mocks.reviewApiMock.deleteReview.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleDeleteReview({ id: 'rv1' })
    expect(window.alert).toHaveBeenCalledWith('删除评价失败，请重试')

    // comment: no permission + success reload
    mocks.authStoreMock.hasPermission.mockImplementation((p: string) => p === 'comment:delete')
    ;(window.confirm as any).mockReturnValueOnce(true)
    mocks.reviewApiMock.deleteComment.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.handleDeleteComment({ id: 'cm1' })
    expect(window.alert).toHaveBeenCalledWith('删除成功')

    wrapper.unmount()
  })

  it('image grid helper and previewImage uses window.open', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    expect(wrapper.vm.getImageGridClass(1)).toBe('grid-cols-1')
    expect(wrapper.vm.getImageGridClass(2)).toBe('grid-cols-2')
    expect(wrapper.vm.getImageGridClass(3)).toBe('grid-cols-3')
    expect(wrapper.vm.getImageGridClass(4)).toBe('grid-cols-2')
    expect(wrapper.vm.getImageGridClass(5)).toBe('grid-cols-3')

    wrapper.vm.previewImage('http://img/x.png', [])
    expect(window.open).toHaveBeenCalledWith('http://img/x.png', '_blank')

    wrapper.unmount()
  })

  it('dish pagination helpers compute pages window', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    // wait onMounted async setters, otherwise they may overwrite our manual values
    await flushAll()

    wrapper.vm.totalDishes = 97
    wrapper.vm.dishPageSize = 10
    wrapper.vm.dishPage = 6
    await nextTick()

    expect(wrapper.vm.getDishTotalPages()).toBe(10)
    expect(wrapper.vm.getDishPaginationPages()).toEqual([4, 5, 6, 7, 8])

    wrapper.vm.dishPage = 1
    await nextTick()
    expect(wrapper.vm.getDishPaginationPages()).toEqual([1, 2, 3, 4, 5])

    wrapper.vm.dishPage = 10
    await nextTick()
    expect(wrapper.vm.getDishPaginationPages()).toEqual([8, 9, 10])

    wrapper.unmount()
  })

  it('renders template branches: loading/empty states, filters, reviews without images/comments', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    // dishes loading
    wrapper.vm.isLoadingDishes = true
    await nextTick()
    expect(wrapper.text()).toContain('加载中')

    // dishes empty
    wrapper.vm.isLoadingDishes = false
    wrapper.vm.dishes = []
    await nextTick()
    expect(wrapper.text()).toContain('暂无菜品数据')

    // reset filters button shows when filters active
    wrapper.vm.searchQuery = 'x'
    await nextTick()
    expect(wrapper.text()).toContain('重置筛选')

    // select dish, reviews loading
    wrapper.vm.selectDish({ id: 'd1', name: 'N' })
    await flushAll()
    wrapper.vm.isLoadingReviews = true
    await nextTick()
    expect(wrapper.text()).toContain('加载中')

    // reviews empty
    wrapper.vm.isLoadingReviews = false
    wrapper.vm.reviews = []
    await nextTick()
    expect(wrapper.text()).toContain('暂无评价')

    // reviews with no images
    wrapper.vm.reviews = [
      {
        id: 'rv1',
        content: 'ok',
        rating: 5,
        status: 'approved',
        createdAt: '2025-01-01T10:00:00',
        userNickname: 'u1',
        images: [], // no images
      },
    ]
    await nextTick()
    expect(wrapper.text()).toContain('ok')
    // no image grid
    expect(wrapper.find('.grid').exists()).toBe(false)

    // reviews with comments area empty - trigger via selectDish again
    mocks.reviewApiMock.getReviewComments.mockResolvedValueOnce({
      code: 200,
      data: { items: [], meta: { total: 0 } },
    })
    wrapper.vm.selectDish({ id: 'd1', name: 'N' })
    await flushAll()
    expect(wrapper.text()).toContain('暂无评论')

    // pagination shows when totalReviews > 0
    wrapper.vm.totalReviews = 5
    await nextTick()
    expect(wrapper.findComponent({ name: 'Pagination' }).exists()).toBe(true)

    wrapper.unmount()
  })

  it('handles API failures: loadCanteens/loadDishes/loadReviews/loadComments/deleteReview/deleteComment catch branches', async () => {
    // loadCanteens catch - mock before mount
    mocks.canteenApiMock.getCanteens.mockRejectedValueOnce(new Error('canteen boom'))
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
      expose: ['selectedDishId', 'reviews', 'loadCanteens', 'loadDishes', 'loadReviews', 'loadCommentsForReviews', 'selectDish', 'handleDeleteReview', 'handleDeleteComment', 'handleCanteenChange'],
    })

    await flushAll()

    // loadDishes catch - trigger via handleCanteenChange
    ;(window.alert as any).mockClear()
    mocks.dishApiMock.getDishes.mockRejectedValueOnce(new Error('dishes boom'))
    await wrapper.vm.handleCanteenChange()
    expect(window.alert).toHaveBeenCalledWith('加载菜品列表失败，请刷新重试')

    // loadReviews catch - trigger via selectDish
    ;(window.alert as any).mockClear()
    wrapper.vm.selectedDishId = 'd1'
    mocks.dishApiMock.getDishReviews.mockRejectedValueOnce(new Error('reviews boom'))
    await wrapper.vm.selectDish({ id: 'd1', name: 'N' })
    expect(window.alert).toHaveBeenCalledWith('加载评价列表失败，请重试')

    // loadCommentsForReviews catch
    ;(window.alert as any).mockClear()
    // NOTE: refs returned from setup are auto-unwrapped on `vm`.
    // To hit the `loadCommentsForReviews` catch, we must throw synchronously inside the map callback;
    // Promise.allSettled does not throw for rejected promises.
    mocks.dishApiMock.getDishReviews.mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'rv1' }], meta: { total: 1 } },
    })
    mocks.reviewApiMock.getReviewComments.mockImplementationOnce(() => {
      throw new Error('comments boom')
    })
    await wrapper.vm.selectDish({ id: 'd1', name: 'N' })
    await flushAll()
    expect(window.alert).toHaveBeenCalledWith('加载评论列表失败，请重试')

    // handleDeleteReview catch
    ;(window.alert as any).mockClear()
    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    mocks.reviewApiMock.deleteReview.mockRejectedValueOnce(new Error('del review boom'))
    await wrapper.vm.handleDeleteReview({ id: 'rv1' })
    expect(window.alert).toHaveBeenCalledWith('删除评价失败，请重试')

    // handleDeleteComment catch
    ;(window.alert as any).mockClear()
    mocks.reviewApiMock.deleteComment.mockRejectedValueOnce(new Error('del comment boom'))
    await wrapper.vm.handleDeleteComment({ id: 'cm1' })
    expect(window.alert).toHaveBeenCalledWith('删除评论失败，请重试')

    wrapper.unmount()
  })

  it('handleDishPageChange/handleReviewPageChange update pages and reload', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    mocks.dishApiMock.getDishes.mockClear()
    wrapper.vm.handleDishPageChange(3)
    expect(wrapper.vm.dishPage).toBe(3)
    await flushMicrotasks()
    expect(mocks.dishApiMock.getDishes).toHaveBeenCalled()

    mocks.dishApiMock.getDishReviews.mockClear()
    mocks.reviewApiMock.getReviewComments.mockClear()
    wrapper.vm.selectedDishId = 'd1'
    wrapper.vm.handleReviewPageChange(2)
    expect(wrapper.vm.reviewPage).toBe(2)
    await flushAll()
    expect(mocks.dishApiMock.getDishReviews).toHaveBeenCalled()
    expect(mocks.reviewApiMock.getReviewComments).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('resetFilters clears all and reloads', async () => {
    const wrapper = shallowMount(CommentManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushAll()

    wrapper.vm.searchQuery = 'x'
    wrapper.vm.selectedCanteenId = 'c1'
    wrapper.vm.selectedWindowId = 'w1'
    wrapper.vm.windows = [{ id: 'w1', name: 'W1' }]
    wrapper.vm.dishPage = 2

    mocks.dishApiMock.getDishes.mockClear()
    wrapper.vm.resetFilters()
    expect(wrapper.vm.searchQuery).toBe('')
    expect(wrapper.vm.selectedCanteenId).toBe('')
    expect(wrapper.vm.selectedWindowId).toBe('')
    expect(wrapper.vm.windows).toEqual([])
    expect(wrapper.vm.dishPage).toBe(1)
    await flushMicrotasks()
    expect(mocks.dishApiMock.getDishes).toHaveBeenCalled()

    wrapper.unmount()
  })
})
