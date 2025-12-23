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
    query: { parentId: 'p1', subItemName: '小份' } as any,
  },
  dishStoreMock: {
    addDish: vi.fn(),
    updateDish: vi.fn(),
  },
  dishApiMock: {
    getDishById: vi.fn(),
    uploadImage: vi.fn(),
    createDish: vi.fn(),
    updateDish: vi.fn(),
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

import AddSubDish from '../../src/views/AddSubDish.vue'

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

describe('views/AddSubDish', () => {
  const originalFileReader = (globalThis as any).FileReader
  let randomUuidSpy: any

  beforeEach(() => {
    vi.clearAllMocks()

    ;(mocks as any).routeMock = reactive({
      query: reactive({ parentId: 'p1', subItemName: '小份' }),
    })

    mocks.dishApiMock.getDishById.mockResolvedValue({
      code: 200,
      data: {
        id: 'p1',
        name: '父菜品',
        canteenName: 'C1',
        floorName: '一层',
        windowName: 'W1',
        windowNumber: '01',
        subDishId: ['s0'],
      },
    })

    mocks.dishApiMock.uploadImage.mockResolvedValue({ code: 200, data: { url: 'http://img/u.png' } })
    mocks.dishApiMock.createDish.mockResolvedValue({ code: 201, data: { id: 's1', name: '小份' } })
    mocks.dishApiMock.updateDish.mockResolvedValue({ code: 200, data: {} })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)

    ;(globalThis as any).FileReader = FileReaderMock
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-1-uuid-2-uuid-3-uuid-4-uuid-5')
    } else {
      // 极端情况下没有 randomUUID，提供一个可用的替代
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: () => 'uuid-1-uuid-2-uuid-3-uuid-4-uuid-5' },
        configurable: true,
      })
    }
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
    ;(globalThis as any).FileReader = originalFileReader
    randomUuidSpy?.mockRestore?.()
  })

  it('onMounted loads parent dish and inherits canteen/floor/window + sets parentDishName', async () => {
    const wrapper = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })
    await flushAll(3)

    expect(mocks.dishApiMock.getDishById).toHaveBeenCalledWith('p1')
    expect(wrapper.vm.parentDishName).toBe('父菜品')
    expect(wrapper.vm.formData.canteen).toBe('C1')
    expect(wrapper.vm.formData.floor).toBe('一层')
    expect(wrapper.vm.formData.windowName).toBe('W1')
    expect(wrapper.vm.formData.windowNumber).toBe('01')

    wrapper.unmount()
  })

  it('tag + dateRange helpers work', async () => {
    const wrapper = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })

    wrapper.vm.newTag = ' 麻辣 '
    wrapper.vm.addTag()
    expect(wrapper.vm.formData.tags).toEqual(['麻辣'])
    expect(wrapper.vm.newTag).toBe('')

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

  it('handleImageUpload validates size, reads preview, clears input; setAsCover/remove work', async () => {
    const wrapper = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })

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

    wrapper.vm.formData.imageFiles.push({ id: 'uuid-2', file: small, preview: 'p2' })
    wrapper.vm.setAsCover(1)
    expect(wrapper.vm.formData.imageFiles[0].id).toBe('uuid-2')

    wrapper.vm.removeImage(0)
    expect(wrapper.vm.formData.imageFiles.length).toBe(1)

    wrapper.unmount()
  })

  it('submitForm validates required fields + parentDishId + price', async () => {
    const wrapper = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    wrapper.vm.formData.name = ''
    wrapper.vm.formData.canteen = ''
    wrapper.vm.formData.floor = ''
    wrapper.vm.formData.windowName = ''
    wrapper.vm.formData.price = -1

    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.name).toBe('请输入菜品名称')
    expect(wrapper.vm.errors.canteen).toBe('食堂名称不能为空')
    expect(wrapper.vm.errors.floor).toBe('食堂楼层不能为空')
    expect(wrapper.vm.errors.windowName).toBe('窗口名称不能为空')
    expect(wrapper.vm.errors.price).toContain('价格必须为有效的数字')

    // missing parentDishId
    ;(mocks.routeMock.query as any).parentId = ''
    const wrapper2 = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    wrapper2.vm.formData.name = 'n'
    wrapper2.vm.formData.canteen = 'C1'
    wrapper2.vm.formData.floor = '1'
    wrapper2.vm.formData.windowName = 'W1'
    wrapper2.vm.formData.price = 0

    await wrapper2.vm.submitForm()
    expect(window.alert).toHaveBeenCalledWith('缺少父菜品ID，无法创建子项')

    wrapper.unmount()
    wrapper2.unmount()
  })

  it('submitForm uploads images: partial fail confirm-cancel stops; throw alerts', async () => {
    const wrapper = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    wrapper.vm.formData.name = '小份'
    wrapper.vm.formData.canteen = 'C1'
    wrapper.vm.formData.floor = '一层'
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

    mocks.dishApiMock.uploadImage
      .mockResolvedValueOnce({ code: 200, data: { url: 'u1' } })
      .mockResolvedValueOnce({ code: 500, message: 'bad' })
    ;(window.confirm as any).mockReturnValueOnce(false)

    await wrapper.vm.submitForm()
    expect(window.confirm).toHaveBeenCalled()
    expect(mocks.dishApiMock.createDish).not.toHaveBeenCalled()

    // throw
    wrapper.vm.formData.imageFiles = [{ id: 'i3', file: f1, preview: 'p3' }]
    mocks.dishApiMock.uploadImage.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.submitForm()
    expect(window.alert).toHaveBeenCalledWith('图片上传失败，请重试')

    wrapper.unmount()
  })

  it('submitForm success creates dish, updates parent subDishId, updates store, and redirects', async () => {
    const wrapper = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    wrapper.vm.formData.name = ' 小份 '
    wrapper.vm.formData.canteen = 'C1'
    wrapper.vm.formData.floor = '一层'
    wrapper.vm.formData.windowName = 'W1'
    wrapper.vm.formData.windowNumber = ''
    wrapper.vm.formData.ingredients = '花生, 牛奶、 鸡蛋'
    wrapper.vm.formData.allergens = '花生,牛奶'
    wrapper.vm.formData.tags = ['麻辣']
    wrapper.vm.formData.availableDates = [
      { startDate: '2025-01-01', endDate: '2025-01-31' },
      { startDate: '', endDate: '' },
    ]

    mocks.dishApiMock.createDish.mockResolvedValueOnce({ code: 201, data: { id: 's1', name: '小份' } })

    // parent fetch for updating subDishId
    mocks.dishApiMock.getDishById.mockResolvedValueOnce({
      code: 200,
      data: { id: 'p1', name: '父菜品', subDishId: ['s0'] },
    })

    await wrapper.vm.submitForm()

    expect(mocks.dishApiMock.createDish).toHaveBeenCalled()
    expect(mocks.dishStoreMock.addDish).toHaveBeenCalledWith({ id: 's1', name: '小份' })

    expect(mocks.dishApiMock.updateDish).toHaveBeenCalledWith('p1', { subDishId: ['s0', 's1'] })
    expect(mocks.dishStoreMock.updateDish).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ subDishId: ['s0', 's1'] }),
    )

    expect(window.alert).toHaveBeenCalledWith('子项添加成功！')
    expect(mocks.routerMock.push).toHaveBeenCalledWith({
      path: '/edit-dish/p1',
      query: { refreshSubDishes: 'true' },
    })

    wrapper.unmount()
  })

  it('submitForm handles createDish failure and parent update failure without blocking success', async () => {
    const wrapper = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })
    await flushAll(2)

    wrapper.vm.formData.name = '小份'
    wrapper.vm.formData.canteen = 'C1'
    wrapper.vm.formData.floor = '一层'
    wrapper.vm.formData.windowName = 'W1'

    // createDish non-200
    mocks.dishApiMock.createDish.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.submitForm()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('bad')

    // createDish success but parent update throws
    ;(window.alert as any).mockClear()
    mocks.dishApiMock.createDish.mockResolvedValueOnce({ code: 200, data: { id: 's2', name: '小份' } })
    mocks.dishApiMock.getDishById.mockResolvedValueOnce({ code: 200, data: { id: 'p1', subDishId: [] } })
    mocks.dishApiMock.updateDish.mockRejectedValueOnce(new Error('boom'))

    await wrapper.vm.submitForm()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('子项添加成功')

    wrapper.unmount()
  })

  it('goBack routes to parent edit or to /single-add when parentId missing', async () => {
    const wrapper = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })

    wrapper.vm.goBack()
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/edit-dish/p1')

    ;(mocks.routeMock.query as any).parentId = ''
    const wrapper2 = shallowMount(AddSubDish, { global: { stubs: { Header: true } } })

    wrapper2.vm.goBack()
    expect(mocks.routerMock.push).toHaveBeenCalledWith('/single-add')

    wrapper.unmount()
    wrapper2.unmount()
  })
})
