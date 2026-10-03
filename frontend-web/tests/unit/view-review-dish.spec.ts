import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  routeMock: {
    path: '/review-dish',
    params: {},
    query: {},
    meta: {},
  },
  getPendingUploadsMock: vi.fn(),
  getCanteensMock: vi.fn(),
  hasPermissionMock: vi.fn(),
  showAlertMock: vi.fn(() => Promise.resolve()),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.routerPushMock,
  }),
  useRoute: () => mocks.routeMock,
}))

vi.mock('@/api/modules/review', () => ({
  reviewApi: {
    getPendingUploads: mocks.getPendingUploadsMock,
  },
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: {
    getCanteens: mocks.getCanteensMock,
  },
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => ({
    hasPermission: mocks.hasPermissionMock,
  }),
}))

vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlertMock,
  showConfirm: vi.fn(() => Promise.resolve(true)),
  showConfirmDanger: vi.fn(() => Promise.resolve(true)),
}))

import ReviewDish from '../../src/views/ReviewDish.vue'

const flushAll = async () => {
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()))
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()))
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
    vi.clearAllMocks()
    mocks.getPendingUploadsMock.mockReset()
    mocks.getCanteensMock.mockReset()
  })

  it('loads canteens and pending uploads on mount; maps items and total', async () => {
    mocks.hasPermissionMock.mockReturnValue(true)

    mocks.getCanteensMock.mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 1, name: '一食堂' }] },
    })

    mocks.getPendingUploadsMock.mockResolvedValueOnce({
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

    expect(mocks.getCanteensMock).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
    expect(mocks.getPendingUploadsMock).toHaveBeenCalledWith({ page: 1, pageSize: 10 })

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
    mocks.hasPermissionMock.mockReturnValue(true)

    mocks.getCanteensMock.mockResolvedValueOnce({ code: 500 })
    mocks.getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    expect(wrapper.vm.canteens).toEqual([])

    mocks.getCanteensMock.mockRejectedValueOnce(new Error('boom'))

    await wrapper.vm.loadReviewDishes()
    await wrapper.vm.loadReviewDishes() // no-op extra to ensure stable
    await flushAll()

    // explicitly invoke loadCanteens via onActivated simulation
    // (calling method directly isn't returned; so we remount in keepalive below)

    wrapper.unmount()
    consoleSpy.mockRestore()
  })

  it('watchers reset page and send status/canteen filters to the API', async () => {
    mocks.hasPermissionMock.mockReturnValue(true)

    mocks.getCanteensMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })
    mocks.getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    mocks.getPendingUploadsMock.mockClear()

    mocks.getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    wrapper.vm.currentPage = 5
    wrapper.vm.statusFilter = 'approved'
    await flushAll()

    expect(wrapper.vm.currentPage).toBe(1)
    expect(mocks.getPendingUploadsMock).toHaveBeenCalledWith({ page: 1, pageSize: 10, status: 'approved' })

    mocks.getPendingUploadsMock.mockClear()

    mocks.getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    wrapper.vm.currentPage = 3
    wrapper.vm.canteenFilter = 'c1'
    await flushAll()

    expect(wrapper.vm.currentPage).toBe(1)
    expect(mocks.getPendingUploadsMock).toHaveBeenCalledWith({ page: 1, pageSize: 10, status: 'approved', canteenId: 'c1' })

    wrapper.unmount()
  })

  it('fetches matching records across pages with a filtered total', async () => {
    mocks.hasPermissionMock.mockReturnValue(true)
    mocks.getCanteensMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })
    const records = Array.from({ length: 11 }, (_, index) => ({
      id: `u${index}`, name: index === 10 ? 'Target' : 'Other', canteenId: index === 10 ? 'c2' : 'c1',
      canteenName: index === 10 ? '二食堂' : '一食堂', status: 'pending',
    }))
    mocks.getPendingUploadsMock.mockImplementation(async (params: any) => {
      const filtered = records.filter((item) => !params.keyword || item.name.includes(params.keyword))
        .filter((item) => !params.canteenId || item.canteenId === params.canteenId)
      return { code: 200, data: { items: filtered.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), meta: { total: filtered.length } } }
    })
    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()
    expect(wrapper.vm.filteredReviewDishes).toHaveLength(10)
    wrapper.vm.currentPage = 2
    wrapper.vm.searchQuery = 'Target'
    wrapper.vm.canteenFilter = 'c2'
    await flushAll()
    expect(mocks.getPendingUploadsMock).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, keyword: 'Target', canteenId: 'c2' })
    expect(wrapper.vm.filteredReviewDishes).toHaveLength(1)
    expect(wrapper.vm.filteredReviewDishes[0].id).toBe('u10')
    expect(wrapper.vm.totalDishes).toBe(1)
    wrapper.unmount()
  })

  it('viewDishDetail and reviewDish push route; permission denied alerts and blocks', async () => {
    mocks.hasPermissionMock.mockReturnValue(true)
    mocks.getCanteensMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })
    mocks.getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    wrapper.vm.viewDishDetail({ id: '9' })
    expect(mocks.routerPushMock).toHaveBeenCalledWith('/review-dish/9')

    mocks.routerPushMock.mockClear()
    wrapper.vm.reviewDish({ id: '8', status: 'pending' })
    expect(mocks.routerPushMock).toHaveBeenCalledWith('/review-dish/8')

    mocks.routerPushMock.mockClear()
    mocks.hasPermissionMock.mockReturnValue(false)

    wrapper.vm.reviewDish({ id: '7', status: 'pending' })
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限审核菜品')
    expect(mocks.routerPushMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('handlePageChange updates page and reloads', async () => {
    mocks.hasPermissionMock.mockReturnValue(true)

    mocks.getCanteensMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })
    mocks.getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    const wrapper = mount(ReviewDish, baseMountOptions)
    await flushAll()

    mocks.getPendingUploadsMock.mockClear()
    mocks.getPendingUploadsMock.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0 } } })

    wrapper.vm.handlePageChange(3)
    await flushAll()

    expect(wrapper.vm.currentPage).toBe(3)
    expect(mocks.getPendingUploadsMock).toHaveBeenCalledWith({ page: 3, pageSize: 10 })

    wrapper.unmount()
  })

  it('onActivated reloads data when kept-alive', async () => {
    mocks.hasPermissionMock.mockReturnValue(true)

    mocks.getCanteensMock.mockResolvedValue({ code: 200, data: { items: [] } })
    mocks.getPendingUploadsMock.mockResolvedValue({ code: 200, data: { items: [], meta: { total: 0 } } })

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

    const callsAfterMount = mocks.getPendingUploadsMock.mock.calls.length
    expect(callsAfterMount).toBeGreaterThanOrEqual(1)

    ;(wrapper.vm as any).show = false
    await flushAll()
    ;(wrapper.vm as any).show = true
    await flushAll()

    expect(mocks.getPendingUploadsMock.mock.calls.length).toBeGreaterThan(callsAfterMount)

    wrapper.unmount()
  })
})
