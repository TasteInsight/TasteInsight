import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

import ViewDishDetail from '../../src/views/ViewDishDetail.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  route: {
    path: '/view-dish/1',
    params: { id: '1' },
    query: {},
    meta: {},
  },
  dishApi: {
    getDishById: vi.fn(),
    getDishReviews: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
  useRoute: () => mocks.route,
}))

vi.mock('@/api/modules/dish', () => ({
  dishApi: mocks.dishApi,
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
      Transition: false,
      'transition-group': false,
    },
  },
}

describe('views/ViewDishDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.route.params = { id: '1' }

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'open').mockImplementation(() => null as any)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('loads dish + reviews on mount; maps dish fields; loads sub-dishes via allSettled', async () => {
    mocks.dishApi.getDishById
      .mockResolvedValueOnce({
        code: 200,
        data: {
          id: '1',
          name: '红烧肉',
          canteenName: '一食堂',
          floorName: '1F',
          windowName: '窗口A',
          windowNumber: '01',
          price: 12.5,
          description: 'desc',
          allergens: 'a',
          ingredients: ['i1', 'i2'],
          images: ['img1'],
          tags: ['t1'],
          spicyLevel: 1,
          saltiness: 2,
          sweetness: null,
          oiliness: undefined,
          availableMealTime: ['breakfast'],
          availableDates: [{ startDate: '2025-01-01', endDate: '2025-01-31' }],
          subDishId: ['s1', 's2', 'bad'],
        },
      })
      .mockResolvedValueOnce({ code: 200, data: { id: 's1', name: '小份', price: 6 } })
      .mockResolvedValueOnce({ code: 200, data: { id: 's2', name: '', price: 0 } })
      .mockResolvedValueOnce({ code: 500 })

    mocks.dishApi.getDishReviews.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [{ id: 'r1', userNickname: 'u', rating: 5, content: 'c', createdAt: '2025-01-01' }],
        meta: { total: 1, page: 1, pageSize: 10, totalPages: 2 },
        rating: { average: 4.5, total: 1, detail: {} },
      },
    })

    const wrapper = mount(ViewDishDetail, baseMountOptions)
    await flushAll()

    expect(mocks.dishApi.getDishById).toHaveBeenCalledWith('1')
    expect(mocks.dishApi.getDishReviews).toHaveBeenCalledWith('1', { page: 1, pageSize: 10 })

    expect(wrapper.vm.dishData).toMatchObject({
      id: '1',
      name: '红烧肉',
      canteenName: '一食堂',
      floor: '1F',
      windowName: '窗口A',
      windowNumber: '01',
      price: 12.5,
      description: 'desc',
      tags: ['t1'],
      spicyLevel: 1,
      saltiness: 2,
      sweetness: 0,
      oiliness: 0,
      availableMealTime: ['breakfast'],
      subDishId: ['s1', 's2', 'bad'],
    })

    // allergens string => array
    expect(wrapper.vm.dishData.allergens).toEqual(['a'])
    expect(wrapper.vm.dishData.ingredients).toEqual(['i1', 'i2'])

    // allSettled: only fulfilled+code200+data entries
    expect(wrapper.vm.dishData.subItems).toEqual([
      { id: 's1', name: '小份', price: 6 },
      { id: 's2', name: '未命名', price: 0 },
    ])

    expect(wrapper.vm.reviewsData.items).toHaveLength(1)
    expect(wrapper.vm.reviewsData.meta.totalPages).toBe(2)

    wrapper.unmount()
  })

  it('loadDishData handles non-200 and thrown errors: alerts and routes back', async () => {
    mocks.dishApi.getDishById.mockResolvedValueOnce({ code: 500, message: 'bad' })
    mocks.dishApi.getDishReviews.mockResolvedValueOnce({ code: 200, data: { items: [], meta: { totalPages: 0 }, rating: { average: 0, total: 0, detail: {} } } })

    const wrapper = mount(ViewDishDetail, baseMountOptions)
    await flushAll()

    expect(window.alert).toHaveBeenCalledWith('获取菜品信息失败，请重试')
    expect(mocks.routerPush).toHaveBeenCalledWith('/modify-dish')

    wrapper.unmount()
  })

  it('loadSubDishes handles thrown error: clears subItems', async () => {
    mocks.dishApi.getDishById.mockResolvedValueOnce({
      code: 200,
      data: { id: '1', name: 'D', subDishId: ['s1'] },
    })

    mocks.dishApi.getDishById.mockRejectedValueOnce(new Error('boom'))

    mocks.dishApi.getDishReviews.mockResolvedValueOnce({
      code: 200,
      data: { items: [], meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 }, rating: { average: 0, total: 0, detail: {} } },
    })

    const wrapper = mount(ViewDishDetail, baseMountOptions)
    await flushAll()

    expect(wrapper.vm.dishData.subItems).toEqual([])

    wrapper.unmount()
  })

  it('loadReviews passes status filter; on non-200/throw clears data without alert', async () => {
    mocks.dishApi.getDishById.mockResolvedValueOnce({ code: 200, data: { id: '1' } })

    mocks.dishApi.getDishReviews
      .mockResolvedValueOnce({ code: 200, data: { items: [], meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 }, rating: { average: 0, total: 0, detail: {} } } })
      .mockResolvedValueOnce({ code: 500, message: 'bad' })
      .mockRejectedValueOnce(new Error('boom'))

    const wrapper = mount(ViewDishDetail, baseMountOptions)
    await flushAll()

    wrapper.vm.reviewStatusFilter = 'approved'
    await wrapper.vm.loadReviews()

    expect(mocks.dishApi.getDishReviews).toHaveBeenLastCalledWith('1', { page: 1, pageSize: 10, status: 'approved' })
    expect(wrapper.vm.reviewsData.items).toEqual([])

    await wrapper.vm.loadReviews()
    expect(wrapper.vm.reviewsData.items).toEqual([])

    wrapper.unmount()
  })

  it('changeReviewPage validates bounds and loads only when valid', async () => {
    mocks.dishApi.getDishById.mockResolvedValueOnce({ code: 200, data: { id: '1' } })
    mocks.dishApi.getDishReviews.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [],
        meta: { total: 0, page: 1, pageSize: 10, totalPages: 2 },
        rating: { average: 0, total: 0, detail: {} },
      },
    })

    const wrapper = mount(ViewDishDetail, baseMountOptions)
    await flushAll()

    mocks.dishApi.getDishReviews.mockClear()

    wrapper.vm.changeReviewPage(0)
    wrapper.vm.changeReviewPage(3)
    await flushAll()
    expect(mocks.dishApi.getDishReviews).not.toHaveBeenCalled()

    mocks.dishApi.getDishReviews.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [],
        meta: { total: 0, page: 2, pageSize: 10, totalPages: 2 },
        rating: { average: 0, total: 0, detail: {} },
      },
    })

    wrapper.vm.changeReviewPage(2)
    await flushAll()

    expect(wrapper.vm.currentReviewPage).toBe(2)
    expect(mocks.dishApi.getDishReviews).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('helpers: allergensText/ingredientsText, formatDate, previewImage, goBack', async () => {
    mocks.dishApi.getDishById.mockResolvedValueOnce({ code: 200, data: { id: '1', allergens: ['a', 'b'], ingredients: 'i', images: [] } })
    mocks.dishApi.getDishReviews.mockResolvedValueOnce({
      code: 200,
      data: { items: [], meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 }, rating: { average: 0, total: 0, detail: {} } },
    })

    const wrapper = mount(ViewDishDetail, baseMountOptions)
    await flushAll()

    expect(wrapper.vm.allergensText).toBe('a、b')
    expect(wrapper.vm.ingredientsText).toBe('i')

    expect(wrapper.vm.formatDate('')).toBe('')
    expect(typeof wrapper.vm.formatDate('2025-01-01T00:00:00.000Z')).toBe('string')

    wrapper.vm.previewImage('http://img')
    expect(window.open).toHaveBeenCalledWith('http://img', '_blank')

    wrapper.vm.goBack()
    expect(mocks.routerPush).toHaveBeenCalledWith('/modify-dish')

    wrapper.unmount()
  })
})
