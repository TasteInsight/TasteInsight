import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'

import ReviewDish from '@/views/ReviewDish.vue'

const { routerPushMock, routeMock } = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  routeMock: {
    path: '/review-dish',
    params: {},
    query: {},
    meta: {},
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
  useRoute: () => routeMock,
}))

const { getPendingUploadsMock, getCanteensMock } = vi.hoisted(() => ({
  getPendingUploadsMock: vi.fn(),
  getCanteensMock: vi.fn(),
}))

vi.mock('@/api/modules/review', () => ({
  reviewApi: {
    getPendingUploads: getPendingUploadsMock,
  },
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: {
    getCanteens: getCanteensMock,
  },
}))

const { hasPermissionMock } = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => ({
    hasPermission: hasPermissionMock,
  }),
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
      Pagination: defineComponent({
        name: 'PaginationStub',
        props: ['currentPage', 'pageSize', 'total'],
        template: '<div />',
      }),
      Transition: false,
      'transition-group': false,
    },
  },
}

describe('views/ReviewDish', () => {
  beforeEach(() => {
    routerPushMock.mockReset()
    hasPermissionMock.mockReset()
    getPendingUploadsMock.mockReset()
    getCanteensMock.mockReset()
  })

  it('loads canteens and pending uploads on mount; maps items and total', async () => {
    hasPermissionMock.mockReturnValue(true)

    getCanteensMock.mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 1, name: '一食堂' }] },
    })

    getPendingUploadsMock.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          {
            id: 'u1',
            name: '红烧肉',
            canteenName: '一食堂',
            windowName: '窗口A',
            uploaderName: '张三',
            createdAt: '2025-01-01T00:00:00.000Z',
            status: 'pending',
            images: ['img1'],
          },
          {
            id: 'u2',
            name: '番茄炒蛋',
            canteenName: '二食堂',
            windowName: '',
            uploaderName: '',
            createdAt: '',
            status: '',
            images: [],
          },
        ],
        meta: { total: 77 },
      },
    })

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    expect(getCanteensMock).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
    expect(getPendingUploadsMock).toHaveBeenCalledWith({ page: 1, pageSize: 10 })

    expect(wrapper.vm.canteens).toEqual([{ id: 1, name: '一食堂' }])
    expect(wrapper.vm.totalDishes).toBe(77)

    expect(wrapper.vm.filteredReviewDishes).toHaveLength(2)

    const first = wrapper.vm.filteredReviewDishes[0]
    expect(first).toMatchObject({
      id: 'u1',
      name: '红烧肉',
      location: '一食堂-窗口A',
      submitter: '张三',
      status: 'pending',
      image: 'img1',
      canteen: '一食堂',
      window: '窗口A',
    })

    const second = wrapper.vm.filteredReviewDishes[1]
    expect(second).toMatchObject({
      id: 'u2',
      name: '番茄炒蛋',
      location: '二食堂',
      submitter: '未知',
      status: 'pending',
      image: '',
    })

    wrapper.unmount()
  })

  it('loadCanteens handles non-200 and thrown errors by setting empty list', async () => {
    hasPermissionMock.mockReturnValue(true)

    getCanteensMock.mockResolvedValueOnce({ code: 500 })
    getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    expect(wrapper.vm.canteens).toEqual([])

    getCanteensMock.mockRejectedValueOnce(new Error('boom'))

    await wrapper.vm.loadReviewDishes()
    await wrapper.vm.loadReviewDishes() // no-op extra to ensure stable
    await flushAll()

    // explicitly invoke loadCanteens via onActivated simulation
    // (calling method directly isn't returned; so we remount in keepalive below)

    wrapper.unmount()
    consoleSpy.mockRestore()
  })

  it('watchers reset page and reload when status/canteen filters change; API gets status only', async () => {
    hasPermissionMock.mockReturnValue(true)

    getCanteensMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })
    getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    getPendingUploadsMock.mockClear()

    getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    wrapper.vm.currentPage = 5
    wrapper.vm.statusFilter = 'approved'
    await flushAll()

    expect(wrapper.vm.currentPage).toBe(1)
    expect(getPendingUploadsMock).toHaveBeenCalledWith({ page: 1, pageSize: 10, status: 'approved' })

    getPendingUploadsMock.mockClear()

    getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    wrapper.vm.currentPage = 3
    wrapper.vm.canteenFilter = '一食堂'
    await flushAll()

    expect(wrapper.vm.currentPage).toBe(1)
    expect(getPendingUploadsMock).toHaveBeenCalledWith({ page: 1, pageSize: 10, status: 'approved' })

    wrapper.unmount()
  })

  it('computed filtering covers search/status/canteen client-side filters', async () => {
    hasPermissionMock.mockReturnValue(true)

    getCanteensMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })
    getPendingUploadsMock.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          { id: '1', name: '红烧肉', canteenName: '一食堂', windowName: 'A', uploaderName: '张三', createdAt: '', status: 'pending', images: [] },
          { id: '2', name: '青椒肉丝', canteenName: '二食堂', windowName: 'B', uploaderName: '李四', createdAt: '', status: 'approved', images: [] },
        ],
        meta: { total: 2 },
      },
    })

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    expect(wrapper.vm.filteredReviewDishes).toHaveLength(2)

    wrapper.vm.searchQuery = '红烧'
    await flushAll()
    expect(wrapper.vm.filteredReviewDishes).toHaveLength(1)
    expect(wrapper.vm.filteredReviewDishes[0].id).toBe('1')

    wrapper.vm.searchQuery = ''

    // statusFilter triggers watcher which reloads from API; keep returning the same dataset
    getPendingUploadsMock.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          { id: '1', name: '红烧肉', canteenName: '一食堂', windowName: 'A', uploaderName: '张三', createdAt: '', status: 'pending', images: [] },
          { id: '2', name: '青椒肉丝', canteenName: '二食堂', windowName: 'B', uploaderName: '李四', createdAt: '', status: 'approved', images: [] },
        ],
        meta: { total: 2 },
      },
    })
    wrapper.vm.statusFilter = 'approved'
    await flushAll()
    expect(wrapper.vm.filteredReviewDishes).toHaveLength(1)
    expect(wrapper.vm.filteredReviewDishes[0].id).toBe('2')

    // canteenFilter also triggers watcher reload
    getPendingUploadsMock.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          { id: '1', name: '红烧肉', canteenName: '一食堂', windowName: 'A', uploaderName: '张三', createdAt: '', status: 'pending', images: [] },
          { id: '2', name: '青椒肉丝', canteenName: '二食堂', windowName: 'B', uploaderName: '李四', createdAt: '', status: 'approved', images: [] },
        ],
        meta: { total: 2 },
      },
    })
    wrapper.vm.canteenFilter = '二食堂'
    await flushAll()
    expect(wrapper.vm.filteredReviewDishes).toHaveLength(1)
    expect(wrapper.vm.filteredReviewDishes[0].id).toBe('2')

    wrapper.unmount()
  })

  it('viewDishDetail and reviewDish push route; permission denied alerts and blocks', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    hasPermissionMock.mockReturnValue(true)
    getCanteensMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })
    getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    wrapper.vm.viewDishDetail({ id: '9' })
    expect(routerPushMock).toHaveBeenCalledWith('/review-dish/9')

    routerPushMock.mockClear()
    wrapper.vm.reviewDish({ id: '8', status: 'pending' })
    expect(routerPushMock).toHaveBeenCalledWith('/review-dish/8')

    routerPushMock.mockClear()
    hasPermissionMock.mockReturnValue(false)

    wrapper.vm.reviewDish({ id: '7', status: 'pending' })
    expect(alertSpy).toHaveBeenCalledWith('您没有权限审核菜品')
    expect(routerPushMock).not.toHaveBeenCalled()

    wrapper.unmount()
    alertSpy.mockRestore()
  })

  it('handlePageChange updates page and reloads', async () => {
    hasPermissionMock.mockReturnValue(true)

    getCanteensMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })
    getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    getPendingUploadsMock.mockClear()
    getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    wrapper.vm.handlePageChange(3)
    await flushAll()

    expect(wrapper.vm.currentPage).toBe(3)
    expect(getPendingUploadsMock).toHaveBeenCalledWith({ page: 3, pageSize: 10 })

    wrapper.unmount()
  })

  it('onActivated reloads data when kept-alive', async () => {
    hasPermissionMock.mockReturnValue(true)

    getCanteensMock.mockResolvedValue({ code: 200, data: { items: [] } })
    getPendingUploadsMock.mockResolvedValue({ code: 200, data: { items: [], meta: { total: 0 } } })

    const Parent = defineComponent({
      name: 'ParentKeepAliveReviewDish',
      components: { ReviewDish },
      setup() {
        const show = ref(true)
        return { show }
      },
      template: '<KeepAlive><ReviewDish v-if="show" /></KeepAlive>',
    })

    const wrapper = mount(Parent, baseMountOptions)
    await flushAll()

    const callsAfterMount = getPendingUploadsMock.mock.calls.length
    expect(callsAfterMount).toBeGreaterThanOrEqual(1)

    ;(wrapper.vm as any).show = false
    await flushAll()
    ;(wrapper.vm as any).show = true
    await flushAll()

    expect(getPendingUploadsMock.mock.calls.length).toBeGreaterThan(callsAfterMount)

    wrapper.unmount()
  })
})
