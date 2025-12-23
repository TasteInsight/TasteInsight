import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
  authStoreMock: {
    user: { id: 'a1', username: 'admin' },
    token: 'token',
    permissions: ['dish:create'],
    hasPermission: vi.fn((p: string) => p === 'dish:create'),
  },
  dishStoreMock: {
    addDish: vi.fn(),
  },
  dishApiMock: {
    uploadImage: vi.fn(),
    createDish: vi.fn(),
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
  useDishStore: () => mocks.dishStoreMock,
}))

vi.mock('@/api/modules/dish', () => ({
  dishApi: mocks.dishApiMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

import SingleAdd from '../../src/views/SingleAdd.vue'

function flushMicrotasks() {
  return Promise.resolve()
}

class FileReaderMock {
  public onload: ((e: any) => void) | null = null
  readAsDataURL(_file: any) {
    this.onload?.({ target: { result: 'data:image/png;base64,AAA' } })
  }
}

describe('views/SingleAdd', () => {
  const originalFileReader = (globalThis as any).FileReader

  beforeEach(() => {
    vi.clearAllMocks()

    mocks.canteenApiMock.getCanteens.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'c1', name: 'C1' }] },
    })

    mocks.canteenApiMock.getWindows.mockResolvedValue({
      code: 200,
      data: {
        items: [
          { id: 'w1', name: 'W1', number: '01', floor: { level: '1', name: '一层' } },
          { id: 'w2', name: 'W2', number: '02', floor: null },
        ],
      },
    })

    mocks.dishApiMock.uploadImage.mockResolvedValue({ code: 200, data: { url: 'http://img/u.png' } })
    mocks.dishApiMock.createDish.mockResolvedValue({ code: 201, data: { id: 'd1', name: 'n' } })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)

    ;(globalThis as any).FileReader = FileReaderMock
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
    ;(globalThis as any).FileReader = originalFileReader
  })

  it('loads canteens on mount; onCanteenChange loads windows and resets window fields', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    await flushMicrotasks()
    expect(mocks.canteenApiMock.getCanteens).toHaveBeenCalled()

    wrapper.vm.canteens = [{ id: 'c1', name: 'C1' }]
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.windowName = 'x'
    wrapper.vm.formData.windowNumber = 'y'
    wrapper.vm.formData.floor = 'z'

    wrapper.vm.onCanteenChange()
    await flushMicrotasks()

    expect(mocks.canteenApiMock.getWindows).toHaveBeenCalledWith('c1', { page: 1, pageSize: 100 })
    expect(wrapper.vm.formData.canteen).toBe('C1')
    expect(wrapper.vm.formData.windowId).toBe('')
    expect(wrapper.vm.formData.windowName).toBe('')
    expect(wrapper.vm.formData.windowNumber).toBe('')
    expect(wrapper.vm.formData.floor).toBe('')

    wrapper.unmount()
  })

  it('onCanteenChange covers loadWindows empty-id and API failure branches', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    // empty canteenId -> windows cleared, no API call
    wrapper.vm.windows = [{ id: 'w0' }]
    wrapper.vm.formData.canteenId = ''
    wrapper.vm.onCanteenChange()
    await flushMicrotasks()
    expect(wrapper.vm.windows).toEqual([])
    expect(mocks.canteenApiMock.getWindows).not.toHaveBeenCalled()

    // API failure -> windows cleared
    mocks.canteenApiMock.getWindows.mockRejectedValueOnce(new Error('boom'))
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.onCanteenChange()
    await flushMicrotasks()
    expect(wrapper.vm.windows).toEqual([])

    wrapper.unmount()
  })

  it('onWindowChange populates window fields and floor label', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    wrapper.vm.windows = [
      { id: 'w1', name: 'W1', number: '01', floor: { level: '1', name: '一层' } },
      { id: 'w2', name: 'W2', number: '02', floor: null },
    ]

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

  it('tag + subItem + dateRange helpers work', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    // addTag
    wrapper.vm.newTag = ' 麻辣 '
    wrapper.vm.addTag()
    expect(wrapper.vm.formData.tags).toEqual(['麻辣'])
    expect(wrapper.vm.newTag).toBe('')

    // duplicate tag
    wrapper.vm.newTag = '麻辣'
    wrapper.vm.addTag()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('TAG已存在')

    wrapper.vm.removeTag(0)
    expect(wrapper.vm.formData.tags).toEqual([])

    // subItems
    wrapper.vm.addSubItem()
    expect(wrapper.vm.formData.subItems.length).toBe(1)

    wrapper.vm.updateSubItemName(0, '小份')
    expect(wrapper.vm.formData.subItems[0].name).toBe('小份')

    wrapper.vm.removeSubItem(0)
    expect(wrapper.vm.formData.subItems.length).toBe(0)

    // date ranges
    wrapper.vm.addDateRange()
    expect(wrapper.vm.formData.availableDates.length).toBe(1)
    wrapper.vm.removeDateRange(0)
    expect(wrapper.vm.formData.availableDates.length).toBe(0)

    wrapper.unmount()
  })

  it('handleImageUpload validates size, reads preview, clears input', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })

    const small = new File(['x'], 'ok.png', { type: 'image/png' })
    Object.defineProperty(small, 'size', { value: 1024 })

    const evt: any = { target: { files: [big, small], value: 'x' } }
    wrapper.vm.handleImageUpload(evt)

    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('大小超过10MB')
    expect(wrapper.vm.formData.imageFiles.length).toBe(1)
    expect(wrapper.vm.formData.imageFiles[0].preview).toContain('data:image')
    expect(evt.target.value).toBe('')

    // reorder + remove
    wrapper.vm.formData.imageFiles.push({ id: 'b', file: small, preview: 'p2' })
    wrapper.vm.setAsCover(1)
    expect(wrapper.vm.formData.imageFiles[0].id).toBe('b')
    wrapper.vm.removeImage(0)
    expect(wrapper.vm.formData.imageFiles[0].id).not.toBe('b')

    wrapper.unmount()
  })

  it('submitForm enforces permission and validates required fields + price', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    await wrapper.vm.submitForm()
    expect(window.alert).toHaveBeenCalledWith('您没有权限创建菜品')

    mocks.authStoreMock.hasPermission.mockImplementation((p: string) => p === 'dish:create')

    wrapper.vm.formData.name = ''
    wrapper.vm.formData.canteenId = ''
    wrapper.vm.formData.windowId = ''
    wrapper.vm.formData.price = -1
    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.name).toBe('请输入菜品名称')
    expect(wrapper.vm.errors.canteenId).toBe('请选择食堂')
    expect(wrapper.vm.errors.windowId).toBe('请选择窗口')

    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.price = -1
    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.price).toContain('价格必须为有效的数字')

    wrapper.unmount()
  })

  it('submitForm uploads images, confirm-cancel stops, and upload throw alerts', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.canteen = 'C1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.windowName = 'W1'
    wrapper.vm.formData.windowNumber = '01'

    const f1 = new File(['x'], '1.png', { type: 'image/png' })
    const f2 = new File(['x'], '2.png', { type: 'image/png' })
    Object.defineProperty(f1, 'size', { value: 1024 })
    Object.defineProperty(f2, 'size', { value: 1024 })
    wrapper.vm.formData.imageFiles = [
      { id: 'i1', file: f1, preview: 'p1' },
      { id: 'i2', file: f2, preview: 'p2' },
    ]

    // partial success -> confirm cancel
    mocks.dishApiMock.uploadImage.mockResolvedValueOnce({ code: 200, data: { url: 'u1' } })
    mocks.dishApiMock.uploadImage.mockResolvedValueOnce({ code: 500, message: 'bad' })
    ;(window.confirm as any).mockReturnValueOnce(false)

    await wrapper.vm.submitForm()
    expect(window.confirm).toHaveBeenCalled()
    expect(mocks.dishApiMock.createDish).not.toHaveBeenCalled()

    // upload throw branch
    mocks.dishApiMock.uploadImage.mockRejectedValueOnce(new Error('boom'))
    wrapper.vm.formData.imageFiles = [{ id: 'i3', file: f1, preview: 'p3' }]
    await wrapper.vm.submitForm()
    expect(window.alert).toHaveBeenCalledWith('图片上传失败，请重试')

    wrapper.unmount()
  })

  it('submitForm creates dish and redirects (or not) and handles non-200/throw', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.name = ' n '
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.canteen = 'C1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.windowName = 'W1'
    wrapper.vm.formData.windowNumber = ''
    wrapper.vm.formData.price = 0
    wrapper.vm.formData.ingredients = '花生, 牛奶、 鸡蛋'
    wrapper.vm.formData.allergens = '花生,牛奶'
    wrapper.vm.formData.tags = ['麻辣']
    wrapper.vm.formData.availableDates = [
      { startDate: '2025-01-01', endDate: '2025-01-31' },
      { startDate: '', endDate: '' },
    ]
    wrapper.vm.formData.servingTime = { breakfast: true, lunch: false, dinner: true, night: false }

    mocks.dishApiMock.createDish.mockResolvedValueOnce({ code: 201, data: { id: 'd1' } })
    await wrapper.vm.submitForm(true)

    expect(mocks.dishStoreMock.addDish).toHaveBeenCalled()
    expect(wrapper.vm.parentDishId).toBe('d1')
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/review-dish')

    // redirect false
    mocks.dishApiMock.createDish.mockResolvedValueOnce({ code: 200, data: { id: 'd2' } })
    ;(window.alert as any).mockClear()
    await wrapper.vm.submitForm(false)
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('父菜品保存成功')

    // non-200 -> error message
    mocks.dishApiMock.createDish.mockResolvedValueOnce({ code: 500, message: 'bad' })
    ;(window.alert as any).mockClear()
    await wrapper.vm.submitForm(false)
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('bad')

    // throw -> generic error
    mocks.dishApiMock.createDish.mockRejectedValueOnce(new Error('boom'))
    ;(window.alert as any).mockClear()
    await wrapper.vm.submitForm(false)
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('boom')

    wrapper.unmount()
  })

  it('goToSubItemDetail validates name and creates parent dish before redirect', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.subItems = [{ name: '', tempId: 't1' }]
    await wrapper.vm.goToSubItemDetail(0)
    expect(window.alert).toHaveBeenCalledWith('请先输入子项名称')

    // when parentDishId missing, it should call submitForm(false)
    wrapper.vm.formData.subItems = [{ name: '小份', tempId: 't2' }]
    wrapper.vm.formData.name = '父菜品'
    wrapper.vm.formData.canteenId = 'c1'
    wrapper.vm.formData.canteen = 'C1'
    wrapper.vm.formData.windowId = 'w1'
    wrapper.vm.formData.windowName = 'W1'
    wrapper.vm.formData.windowNumber = '01'

    mocks.dishApiMock.createDish.mockResolvedValueOnce({ code: 200, data: { id: 'pd1' } })
    await wrapper.vm.goToSubItemDetail(0)

    expect(wrapper.vm.parentDishId).toBe('pd1')
    expect(mocks.routerMock.push).toHaveBeenCalledWith({
      path: '/add-sub-dish',
      query: expect.objectContaining({
        parentId: 'pd1',
        subItemName: '小份',
        subItemTempId: 't2',
        subItemIndex: 0,
      }),
    })

    // failure to create parent dish -> no redirect
    mocks.routerMock.push.mockClear()
    wrapper.vm.parentDishId = null
    mocks.dishApiMock.createDish.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.goToSubItemDetail(0)
    expect(mocks.routerMock.push).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('resetForm resets state including windows/newTag', async () => {
    const wrapper = shallowMount(SingleAdd, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.name = 'x'
    wrapper.vm.windows = [{ id: 'w1' }]
    wrapper.vm.newTag = 't'
    wrapper.vm.resetForm()

    expect(wrapper.vm.formData.name).toBe('')
    expect(wrapper.vm.formData.price).toBe(0)
    expect(wrapper.vm.newTag).toBe('')
    expect(wrapper.vm.windows).toEqual([])

    wrapper.unmount()
  })
})
