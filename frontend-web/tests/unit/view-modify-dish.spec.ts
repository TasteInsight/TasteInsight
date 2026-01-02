import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, nextTick, shallowRef, markRaw } from 'vue'
import { mount, shallowMount } from '@vue/test-utils'

import ModifyDish from '../../src/views/ModifyDish.vue'

const mocks = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
  },
  authStoreMock: {
    hasPermission: vi.fn(() => true),
  },
  dishApiMock: {
    getDishes: vi.fn(),
  },
  canteenApiMock: {
    getCanteens: vi.fn(),
    getWindows: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => mocks.routerMock,
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/store/modules/use-dish-store', () => ({
  useDishStore: () => ({}) as any,
}))

vi.mock('@/api/modules/dish', () => ({
  dishApi: mocks.dishApiMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

function flushPromises() {
  // Avoid setTimeout so this works with vi.useFakeTimers()
  return Promise.resolve()
}

describe('views/ModifyDish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dishApiMock.getDishes.mockResolvedValue({
      code: 200,
      data: {
        items: [],
        meta: { total: 0 },
      },
    })
    mocks.canteenApiMock.getCanteens.mockResolvedValue({
      code: 200,
      data: {
        items: [],
      },
    })
    mocks.canteenApiMock.getWindows.mockResolvedValue({
      code: 200,
      data: {
        items: [],
      },
    })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    ;(window.alert as any).mockRestore?.()
  })

  it('loads canteens and dishes on mount and maps API items', async () => {
    mocks.canteenApiMock.getCanteens.mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'c1', name: 'C1' }] },
    })

    mocks.dishApiMock.getDishes.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          {
            id: 1,
            name: 'DishA',
            canteenName: 'C1',
            floorName: '1F',
            windowName: 'W1',
            tags: ['t1', 't2'],
            price: 12,
            averageRating: 4.5,
            images: ['img.jpg'],
          },
          {
            id: 2,
            // missing fields to hit fallback mapping branches
            name: '',
            canteenName: '',
            floor: '2F',
            windowNumber: '',
            tags: [],
            price: 0,
            averageRating: 0,
            images: [],
          },
        ],
        meta: { total: 2 },
      },
    })

    const wrapper = shallowMount(ModifyDish, {
      global: {
        stubs: {
          Header: true,
          SearchBar: true,
          Pagination: true,
        },
      },
    })

    await flushPromises()
    await nextTick()

    expect(mocks.canteenApiMock.getCanteens).toHaveBeenCalledTimes(1)
    expect(mocks.dishApiMock.getDishes).toHaveBeenCalledTimes(1)

    expect(wrapper.vm.canteens).toEqual([{ id: 'c1', name: 'C1' }])
    expect(wrapper.vm.totalDishes).toBe(2)

    // no query => returns all
    expect(wrapper.vm.filteredDishes).toHaveLength(2)

    // mapping correctness (a few key fields)
    expect(wrapper.vm.filteredDishes[0]).toMatchObject({
      id: 1,
      name: 'DishA',
      canteen: 'C1',
      floor: '1F',
      window: 'W1',
      cuisine: 't1, t2',
      price: '¥12',
      rating: 4.5,
      image: 'img.jpg',
    })

    // fallbacks
    expect(wrapper.vm.filteredDishes[1].cuisine).toBe('无')
    expect(wrapper.vm.filteredDishes[1].price).toBe('¥0')

    // filtering uses lowercased query across multiple fields
    wrapper.vm.searchQuery = 'w1'
    await nextTick()
    expect(wrapper.vm.filteredDishes).toHaveLength(1)

    wrapper.unmount()
  })

  it('handleCanteenChange resets window and loads windows when canteen is selected', async () => {
    mocks.dishApiMock.getDishes.mockResolvedValue({
      code: 200,
      data: { items: [], meta: { total: 0 } },
    })

    mocks.canteenApiMock.getWindows.mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'w1', name: 'W1' }] },
    })

    const wrapper = shallowMount(ModifyDish, {
      global: { stubs: { Header: true, SearchBar: true, Pagination: true } },
    })

    await flushPromises()

    wrapper.vm.selectedCanteenId = 'c1'
    wrapper.vm.selectedWindowId = 'w-old'
    await wrapper.vm.handleCanteenChange()
    await flushPromises()
    await nextTick()

    expect(wrapper.vm.selectedWindowId).toBe('')
    expect(mocks.canteenApiMock.getWindows).toHaveBeenCalledWith('c1', { page: 1, pageSize: 100 })
    expect(wrapper.vm.windows).toEqual([{ id: 'w1', name: 'W1' }])

    // when deselected, should not fetch windows
    vi.clearAllMocks()
    wrapper.vm.selectedCanteenId = ''
    await wrapper.vm.handleCanteenChange()
    expect(mocks.canteenApiMock.getWindows).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('loadDishes handles API non-200 and thrown errors', async () => {
    const wrapper = shallowMount(ModifyDish, {
      global: { stubs: { Header: true, SearchBar: true, Pagination: true } },
    })

    await flushPromises()

    mocks.dishApiMock.getDishes.mockResolvedValueOnce({ code: 500, data: null })
    await wrapper.vm.loadDishes()
    await flushPromises()
    await nextTick()

    expect(wrapper.vm.filteredDishes).toEqual([])
    expect(wrapper.vm.totalDishes).toBe(0)

    mocks.dishApiMock.getDishes.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.loadDishes()
    await flushPromises()
    await nextTick()

    expect(wrapper.vm.filteredDishes).toEqual([])
    expect(wrapper.vm.totalDishes).toBe(0)

    wrapper.unmount()
  })

  it('editDish/viewDish routes and permission branch (including template click handlers)', async () => {
    mocks.dishApiMock.getDishes.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          {
            id: 9,
            name: 'Dish9',
            canteenName: 'C',
            floorName: '1F',
            windowName: 'W',
            tags: [],
            price: 1,
            averageRating: 0,
            images: [],
          },
        ],
        meta: { total: 1 },
      },
    })

    mocks.authStoreMock.hasPermission.mockReturnValue(false)

    const wrapper = mount(ModifyDish, {
      global: {
        stubs: {
          Header: true,
          SearchBar: true,
          Pagination: true,
        },
      },
    })

    await flushPromises()
    await nextTick()

    // view always routes
    wrapper.vm.viewDish({ id: 9 })
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/view-dish/9')

    // edit blocked
    wrapper.vm.editDish({ id: 9 })
    expect(window.alert).toHaveBeenCalledWith('您没有权限编辑菜品')

    // click edit button in template also hits same branch
    const editBtn = wrapper.find('button .iconify[data-icon="carbon:edit"]').element
      .parentElement as HTMLButtonElement
    await editBtn.click()
    expect(window.alert).toHaveBeenCalled()

    // allow edit
    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    wrapper.vm.editDish({ id: 9 })
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/edit-dish/9')

    wrapper.unmount()
  })

  it('handleSearchChange debounces loadDishes and clears previous timer', async () => {
    vi.useFakeTimers()

    mocks.dishApiMock.getDishes.mockResolvedValue({
      code: 200,
      data: { items: [], meta: { total: 0 } },
    })

    const wrapper = shallowMount(ModifyDish, {
      global: { stubs: { Header: true, SearchBar: true, Pagination: true } },
    })

    await flushPromises()

    // reset call history after initial mount load
    mocks.dishApiMock.getDishes.mockClear()

    wrapper.vm.searchQuery = 'abc'
    wrapper.vm.handleSearchChange()
    wrapper.vm.searchQuery = 'abcd'
    wrapper.vm.handleSearchChange()

    expect(mocks.dishApiMock.getDishes).toHaveBeenCalledTimes(0)

    vi.advanceTimersByTime(500)
    await flushPromises()
    await nextTick()

    expect(mocks.dishApiMock.getDishes).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.currentPage).toBe(1)

    wrapper.unmount()
  })

  it('resetFilters clears state and reloads dishes', async () => {
    const wrapper = shallowMount(ModifyDish, {
      global: { stubs: { Header: true, SearchBar: true, Pagination: true } },
    })

    await flushPromises()

    mocks.dishApiMock.getDishes.mockClear()

    wrapper.vm.searchQuery = 'x'
    wrapper.vm.selectedCanteenId = 'c1'
    wrapper.vm.selectedWindowId = 'w1'
    wrapper.vm.windows = [{ id: 'w1', name: 'W1' }]

    wrapper.vm.resetFilters()
    await flushPromises()
    await nextTick()

    expect(wrapper.vm.searchQuery).toBe('')
    expect(wrapper.vm.selectedCanteenId).toBe('')
    expect(wrapper.vm.selectedWindowId).toBe('')
    expect(wrapper.vm.windows).toEqual([])
    expect(mocks.dishApiMock.getDishes).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('onActivated restores windows list (success and failure branches)', async () => {
    const Other = defineComponent({ name: 'Other', template: '<div>other</div>' })

    const Parent = defineComponent({
      name: 'Parent',
      components: { ModifyDish, Other },
      setup() {
        const comp = shallowRef<any>(markRaw(ModifyDish))
        return { comp }
      },
      template: '<KeepAlive><component :is="comp" /></KeepAlive>',
    })

    // success branch
    mocks.canteenApiMock.getWindows.mockResolvedValueOnce({
      code: 200,
      data: { items: [{ id: 'w1', name: 'W1' }] },
    })

    const wrapper = mount(Parent, {
      global: { stubs: { Header: true, SearchBar: true, Pagination: true } },
    })

    await flushPromises()

    const child = wrapper.findComponent(ModifyDish)
    child.vm.selectedCanteenId = 'c1'
    child.vm.windows = []

    ;(wrapper.vm as any).comp = markRaw(Other)
    await nextTick()
    ;(wrapper.vm as any).comp = markRaw(ModifyDish)
    await nextTick()

    await flushPromises()
    await nextTick()

    const child2 = wrapper.findComponent(ModifyDish)
    expect(mocks.canteenApiMock.getWindows).toHaveBeenCalledWith('c1', { page: 1, pageSize: 100 })
    expect(child2.vm.windows).toEqual([{ id: 'w1', name: 'W1' }])

    wrapper.unmount()

    // failure branch triggers alert
    mocks.canteenApiMock.getWindows.mockRejectedValueOnce(new Error('nope'))

    const wrapper2 = mount(Parent, {
      global: { stubs: { Header: true, SearchBar: true, Pagination: true } },
    })

    await flushPromises()

    const c = wrapper2.findComponent(ModifyDish)
    c.vm.selectedCanteenId = 'c1'
    c.vm.windows = []

    ;(wrapper2.vm as any).comp = markRaw(Other)
    await nextTick()
    ;(wrapper2.vm as any).comp = markRaw(ModifyDish)
    await nextTick()

    await flushPromises()
    await nextTick()

    expect(window.alert).toHaveBeenCalledWith('恢复窗口列表失败，请稍后重试')

    wrapper2.unmount()
  })

  it('onBeforeUnmount removes click logger if present', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const wrapper = shallowMount(ModifyDish, {
      global: { stubs: { Header: true, SearchBar: true, Pagination: true } },
    })

    await flushPromises()

    const logger = vi.fn()
    ;(window as any).__modifyDish_clickLogger = logger

    wrapper.unmount()

    expect(removeSpy).toHaveBeenCalledWith('click', logger, true)
    expect((window as any).__modifyDish_clickLogger).toBeUndefined()

    removeSpy.mockRestore()
  })
})
