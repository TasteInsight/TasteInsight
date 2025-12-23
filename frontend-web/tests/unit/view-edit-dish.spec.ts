import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
  routeMock: {
    params: { id: 'd1' } as any,
    query: {} as any,
    path: '/edit-dish/d1',
  },
  dishStoreMock: {
    updateDish: vi.fn(),
  },
  dishApiMock: {
    getDishById: vi.fn(),
    uploadImage: vi.fn(),
    updateDish: vi.fn(),
  },
  canteenApiMock: {
    getCanteens: vi.fn(),
    getWindows: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => mocks.routerMock,
  useRoute: () => mocks.routeMock,
}))

vi.mock('@/store/modules/use-dish-store', () => ({
  useDishStore: () => mocks.dishStoreMock,
}))

vi.mock('@/api/modules/dish', () => ({
  dishApi: mocks.dishApiMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

import EditDish from '../../src/views/EditDish.vue'

function flushMicrotasks() {
  return Promise.resolve()
}

async function flushAll(times = 6) {
  for (let i = 0; i < times; i++) {
    await flushMicrotasks()
    await nextTick()
  }
}

class FileReaderMock {
  public onload: ((e: any) => void) | null = null
  readAsDataURL(_file: any) {
    this.onload?.({ target: { result: 'data:image/png;base64,AAA' } })
  }
}

describe('views/EditDish', () => {
  const originalFileReader = (globalThis as any).FileReader

  beforeEach(() => {
    vi.clearAllMocks()

    // useRoute 在真实环境中返回的是一个响应式 route。
    // 这里让整个 route 对象也变成 reactive，确保 watch(() => route.query, ...) 能被触发。
    ;(mocks as any).routeMock = reactive({
      params: reactive({ id: 'd1' }),
      query: reactive({}),
      path: '/edit-dish/d1',
    })

    mocks.canteenApiMock.getCanteens.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1', name: 'C1' }] },
    })

    mocks.canteenApiMock.getWindows.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'w1', name: 'W1', number: '01', floor: { level: '1', name: '一层' } }] },
    })

    // EditDish 会在 onMounted 里默认触发 loadDishData；给一个默认响应避免影响其它用例。
    mocks.dishApiMock.getDishById.mockResolvedValue({ code: 200, data: { id: 'd1' } })

    mocks.dishApiMock.uploadImage.mockResolvedValue({ code: 200, data: { url: 'http://img/u.png' } })
    mocks.dishApiMock.updateDish.mockResolvedValue({ code: 200, data: { id: 'd1', name: 'N' } })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)

    ;(globalThis as any).FileReader = FileReaderMock
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
    ;(globalThis as any).FileReader = originalFileReader
  })

  it('mount calls loadDishData; fills canteen/window/image/tag/time/date fields; loads sub dishes', async () => {
    mocks.dishApiMock.getDishById
      .mockResolvedValueOnce({
        code: 200,
        data: {
          id: 'd1',
          name: 'Dish',
          canteenName: 'C1',
          floorName: '一层',
          windowName: 'W1',
          windowNumber: '01',
          price: '¥12.5',
          images: ['u1', 'u2'],
          tags: ['麻辣'],
          availableMealTime: ['breakfast', 'nightsnack'],
          availableDates: [{ startDate: '2025-01-01', endDate: '2025-01-31' }],
          subDishId: ['s1', 's2'],
        },
      })
      .mockResolvedValueOnce({ code: 200, data: { id: 's1', name: 'S1', price: 1 } })
      .mockResolvedValueOnce({ code: 200, data: { id: 's2', name: 'S2', price: 2 } })

    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })

    await flushAll()

    expect(mocks.canteenApiMock.getCanteens).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
    expect(mocks.dishApiMock.getDishById).toHaveBeenCalledWith('d1')
    expect(mocks.canteenApiMock.getWindows).toHaveBeenCalledWith('c1', { page: 1, pageSize: 100 })

    expect(wrapper.vm.formData.canteenId).toBe('c1')
    expect(wrapper.vm.formData.windowId).toBe('w1')
    expect(wrapper.vm.formData.price).toBeCloseTo(12.5)
    expect(wrapper.vm.formData.imageFiles.length).toBe(2)
    expect(wrapper.vm.formData.imageFiles[0].isNew).toBe(false)
    expect(wrapper.vm.formData.tags).toEqual(['麻辣'])

    expect(wrapper.vm.formData.servingTime.breakfast).toBe(true)
    expect(wrapper.vm.formData.servingTime.night).toBe(true)

    expect(wrapper.vm.formData.availableDates.length).toBe(1)
    expect(wrapper.vm.subDishes.length).toBe(2)

    wrapper.unmount()
  })

  it('loadDishData handles non-200/throw: alerts and redirects', async () => {
    mocks.dishApiMock.getDishById.mockResolvedValueOnce({ code: 500, message: 'bad' })

    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })
    await flushAll()

    expect(window.alert).toHaveBeenCalledWith('获取菜品信息失败，请重试')
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/modify-dish')

    wrapper.unmount()
  })

  it('onCanteenChange loads windows and resets window fields; empty selection clears', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    wrapper.vm.canteens = [{ id: 'c1', name: 'C1' }]
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.windowName = 'x'
    wrapper.vm.formData.windowNumber = 'y'
    wrapper.vm.formData.floor = 'z'

    wrapper.vm.onCanteenChange()
    await flushAll(2)

    expect(mocks.canteenApiMock.getWindows).toHaveBeenCalledWith('c1', { page: 1, pageSize: 100 })
    expect(wrapper.vm.formData.canteen).toBe('C1')
    expect(wrapper.vm.formData.windowId).toBe('')
    expect(wrapper.vm.formData.windowName).toBe('')
    expect(wrapper.vm.formData.windowNumber).toBe('')
    expect(wrapper.vm.formData.floor).toBe('')

    wrapper.vm.formData.canteenId = 'missing'
    wrapper.vm.onCanteenChange()
    expect(wrapper.vm.formData.canteen).toBe('')

    wrapper.unmount()
  })

  it('onWindowChange populates name/number/floor and handles missing', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    wrapper.vm.windows = [{ id: 'w1', name: 'W1', number: '01', floor: { level: '1', name: '一层' } }]

    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.onWindowChange()
    expect(wrapper.vm.formData.windowName).toBe('W1')
    expect(wrapper.vm.formData.windowNumber).toBe('01')
    expect(wrapper.vm.formData.floor).toBe('一层')

    wrapper.vm.formData.windowId = 'missing'
    wrapper.vm.onWindowChange()
    expect(wrapper.vm.formData.windowName).toBe('')
    expect(wrapper.vm.formData.windowNumber).toBe('')
    expect(wrapper.vm.formData.floor).toBe('')

    wrapper.unmount()
  })

  it('tag and date range helpers work', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })

    wrapper.vm.newTag = ' 麻辣 '
    wrapper.vm.addTag()
    expect(wrapper.vm.formData.tags).toEqual(['麻辣'])

    wrapper.vm.newTag = '麻辣'
    wrapper.vm.addTag()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('TAG已存在')

    wrapper.vm.removeTag(0)
    expect(wrapper.vm.formData.tags).toEqual([])

    wrapper.vm.addDateRange()
    expect(wrapper.vm.formData.availableDates.length).toBe(1)
    wrapper.vm.removeDateRange(0)
    expect(wrapper.vm.formData.availableDates.length).toBe(0)

    wrapper.unmount()
  })

  it('handleImageUpload validates size, reads preview, clears input; set cover/remove work', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })

    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })

    const small = new File(['x'], 'ok.png', { type: 'image/png' })
    Object.defineProperty(small, 'size', { value: 1024 })

    const evt: any = { target: { files: [big, small], value: 'x' } }
    wrapper.vm.handleImageUpload(evt)

    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('大小超过10MB')
    expect(wrapper.vm.formData.imageFiles.length).toBe(1)
    expect(wrapper.vm.formData.imageFiles[0].isNew).toBe(true)
    expect(wrapper.vm.formData.imageFiles[0].url).toContain('data:image')
    expect(evt.target.value).toBe('')

    wrapper.vm.formData.imageFiles.push({ id: 'e', url: 'u', isNew: false })
    wrapper.vm.setAsCover(1)
    expect(wrapper.vm.formData.imageFiles[0].id).toBe('e')

    wrapper.vm.removeImage(0)
    expect(wrapper.vm.formData.imageFiles.length).toBe(1)

    wrapper.unmount()
  })

  it('addSubItem and editSubDish route to correct targets', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    wrapper.vm.formData.id = 'd1'
    wrapper.vm.addSubItem()
    expect(mocks.routerMock.push).toHaveBeenCalledWith({
      path: '/add-sub-dish',
      query: { parentId: 'd1', subItemName: '', fromEdit: 'true' },
    })

    wrapper.vm.editSubDish('s1')
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/edit-dish/s1')

    wrapper.unmount()
  })

  it('submitForm validates required fields and price/subItemPrice', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.name = ''
    wrapper.vm.formData.canteenId = ''
    wrapper.vm.formData.windowId = ''
    wrapper.vm.formData.price = -1

    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.name).toBe('请输入菜品名称')
    expect(wrapper.vm.errors.canteenId).toBe('请选择食堂')
    expect(wrapper.vm.errors.windowId).toBe('请选择窗口')
    expect(wrapper.vm.errors.price).toContain('价格必须为有效的数字')

    // subItemPrice branch: empty price, fallback to subItems
    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.price = ''
    wrapper.vm.formData.subItems = [{ name: '小份', price: '-1' }]

    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.subItemPrice).toContain('子项价格必须为有效的数字')

    wrapper.unmount()
  })

  it('submitForm image processing confirm-cancel stops before update', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.id = 'd1'
    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.canteen = 'C1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.windowName = 'W1'
    wrapper.vm.formData.windowNumber = '01'

    const f1 = new File(['x'], '1.png', { type: 'image/png' })
    Object.defineProperty(f1, 'size', { value: 1024 })

    wrapper.vm.formData.imageFiles = [
      { id: 'n1', file: f1, url: 'p1', isNew: true },
      { id: 'e1', url: 'existing', isNew: false },
    ]

    mocks.dishApiMock.uploadImage.mockResolvedValueOnce({ code: 500, message: 'bad' })
    ;(window.confirm as any).mockReturnValueOnce(false)

    await wrapper.vm.submitForm()

    expect(window.confirm).toHaveBeenCalled()
    expect(mocks.dishApiMock.updateDish).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('submitForm success updates store and navigates; failures alert message', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })

    // 等待 onMounted 的 loadDishData 跑完，避免占用后续 mockResolvedValueOnce
    await flushAll(2)
    mocks.dishApiMock.getDishById.mockClear()

    wrapper.vm.formData.id = 'd1'
    wrapper.vm.formData.name = ' n '
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.canteen = 'C1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.windowName = 'W1'
    wrapper.vm.formData.windowNumber = ''
    wrapper.vm.formData.ingredients = '花生, 牛奶、 鸡蛋'
    wrapper.vm.formData.allergens = '花生,牛奶'
    wrapper.vm.formData.tags = ['麻辣']
    wrapper.vm.formData.availableDates = [
      { startDate: '2025-01-01', endDate: '2025-01-31' },
      { startDate: '', endDate: '' },
    ]

    // current dish fetch for preserve ids
    mocks.dishApiMock.getDishById.mockResolvedValueOnce({
      code: 200,
      data: { id: 'd1', subDishId: ['s1'], parentDishId: null },
    })

    mocks.dishApiMock.updateDish.mockResolvedValueOnce({ code: 200, data: { id: 'd1', name: 'N2' } })
    await wrapper.vm.submitForm()

    // 防止上一次提交的 submitting 状态影响后续分支
    wrapper.vm.isSubmitting = false

    expect(mocks.dishStoreMock.updateDish).toHaveBeenCalledWith('d1', { id: 'd1', name: 'N2' })
    expect(window.alert).toHaveBeenCalledWith('菜品信息已更新！')
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/modify-dish')

    // non-200
    ;(window.alert as any).mockClear()
    mocks.dishApiMock.getDishById.mockResolvedValueOnce({ code: 200, data: { id: 'd1' } })
    mocks.dishApiMock.updateDish.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.submitForm()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('bad')

    // throw
    ;(window.alert as any).mockClear()
    mocks.dishApiMock.getDishById.mockResolvedValueOnce({ code: 200, data: { id: 'd1' } })
    mocks.dishApiMock.updateDish.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.submitForm()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('boom')

    wrapper.unmount()
  })

  it('watchers: route.params.id reloads; refreshSubDishes triggers reload and clears query', async () => {
    mocks.dishApiMock.getDishById.mockResolvedValue({ code: 200, data: { id: 'd1', name: 'Dish' } })

    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    // params change
    ;(mocks.routeMock.params as any).id = 'd2'
    await flushAll(2)
    expect(mocks.dishApiMock.getDishById).toHaveBeenCalledWith('d2')

    // query refreshSubDishes
    wrapper.vm.formData.id = 'd2'
    // vue-router 场景下 query 通常是一个新的对象；这里也用替换引用来触发 watch
    ;(mocks.routeMock as any).query = reactive({ refreshSubDishes: 'true' })
    await flushAll(2)

    expect(mocks.routerMock.replace).toHaveBeenCalledWith({ path: '/edit-dish/d1', query: {} })

    wrapper.unmount()
  })

  it('goBack navigates to modify page', async () => {
    const wrapper = shallowMount(EditDish, { global: { stubs: { Header: true } } })
    wrapper.vm.goBack()
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/modify-dish')
    wrapper.unmount()
  })
})
