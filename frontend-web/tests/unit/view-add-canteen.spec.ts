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
    permissions: ['canteen:view', 'canteen:create', 'canteen:edit', 'canteen:delete'],
    hasPermission: vi.fn((p: string) =>
      ['canteen:view', 'canteen:create', 'canteen:edit', 'canteen:delete'].includes(p),
    ),
  },
  canteenApiMock: {
    getCanteens: vi.fn(),
    getWindows: vi.fn(),
    createCanteen: vi.fn(),
    updateCanteen: vi.fn(),
    deleteCanteen: vi.fn(),
    deleteWindow: vi.fn(),
    updateWindow: vi.fn(),
    createWindow: vi.fn(),
  },
  dishApiMock: {
    uploadImage: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => mocks.routerMock,
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: mocks.canteenApiMock,
}))

// Used via dynamic import inside submitForm()
vi.mock('@/api/modules/dish', () => ({
  dishApi: mocks.dishApiMock,
}))

import AddCanteen from '@/views/AddCanteen.vue'

function flushMicrotasks() {
  return Promise.resolve()
}

class FileReaderMock {
  public onload: ((e: any) => void) | null = null
  readAsDataURL(_file: any) {
    this.onload?.({ target: { result: 'data:image/png;base64,AAA' } })
  }
}

describe('views/AddCanteen', () => {
  const originalFileReader = (globalThis as any).FileReader

  beforeEach(() => {
    vi.clearAllMocks()

    mocks.canteenApiMock.getCanteens.mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            id: 'c1',
            name: '紫荆园',
            position: 'A',
            description: 'd',
            images: ['http://img/1.png'],
            floors: [{ level: '1', name: '一层' }],
          },
        ],
      },
    })

    mocks.canteenApiMock.getWindows.mockResolvedValue({
      code: 200,
      data: {
        items: [
          { id: 'w1', name: '窗口1', number: '01', floor: { level: '1', name: '一层' } },
          { id: 'w2', name: '窗口2', number: '02', floor: null },
        ],
      },
    })

    mocks.canteenApiMock.deleteCanteen.mockResolvedValue({ code: 200 })
    mocks.canteenApiMock.deleteWindow.mockResolvedValue({ code: 200 })
    mocks.canteenApiMock.createCanteen.mockResolvedValue({ code: 200, data: { id: 'new1', name: 'n' } })
    mocks.canteenApiMock.updateCanteen.mockResolvedValue({ code: 200, data: { id: 'c1' } })

    mocks.canteenApiMock.updateWindow.mockResolvedValue({ code: 200 })
    mocks.canteenApiMock.createWindow.mockResolvedValue({ code: 200 })

    mocks.dishApiMock.uploadImage.mockResolvedValue({ code: 200, data: { url: 'http://img/u.png' } })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)

    ;(globalThis as any).FileReader = FileReaderMock
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
    ;(globalThis as any).FileReader = originalFileReader
  })

  it('loads canteens on mount and filters by name/position', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await flushMicrotasks()

    expect(mocks.canteenApiMock.getCanteens).toHaveBeenCalled()
    expect(wrapper.vm.canteens).toHaveLength(1)

    wrapper.vm.searchQuery = '紫'
    expect(wrapper.vm.filteredCanteens).toHaveLength(1)

    wrapper.vm.searchQuery = 'a'
    expect(wrapper.vm.filteredCanteens).toHaveLength(1)

    wrapper.vm.searchQuery = 'nope'
    expect(wrapper.vm.filteredCanteens).toHaveLength(0)

    wrapper.unmount()
  })

  it('loadCanteens handles API throw', async () => {
    mocks.canteenApiMock.getCanteens.mockRejectedValueOnce(new Error('boom'))
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await flushMicrotasks()

    expect(window.alert).toHaveBeenCalledWith('加载食堂列表失败，请刷新重试')
    wrapper.unmount()
  })

  it('createNewCanteen enforces permission and switches view', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    wrapper.vm.createNewCanteen()
    expect(window.alert).toHaveBeenCalledWith('您没有权限创建食堂')

    mocks.authStoreMock.hasPermission.mockImplementation((p: string) =>
      ['canteen:create', 'canteen:view', 'canteen:edit', 'canteen:delete'].includes(p),
    )
    wrapper.vm.createNewCanteen()
    expect(wrapper.vm.viewMode).toBe('edit')
    expect(wrapper.vm.editingCanteen).toBe(null)

    wrapper.unmount()
  })

  it('editCanteen populates form (images/floors/openingHours) and loads windows', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    const canteen = {
      id: 'c1',
      name: '紫荆园',
      position: 'A',
      description: 'd',
      images: ['u1', 'u2'],
      floors: [{ level: '1', name: '一层' }, { level: '-1', name: 'B1' }],
      openingHours: [
        {
          // new grouped format
          floorLevel: '1',
          schedule: [
            {
              dayOfWeek: '周一',
              slots: [{ openTime: '06:30', closeTime: '22:00' }],
            },
          ],
        },
        {
          // old format
          dayOfWeek: '每天',
          slots: [{ openTime: '07:00', closeTime: '21:00' }],
          floor: { level: '-1', name: 'B1' },
        },
      ],
    }

    await wrapper.vm.editCanteen(canteen)

    expect(wrapper.vm.viewMode).toBe('edit')
    expect(wrapper.vm.formData.name).toBe('紫荆园')
    expect(wrapper.vm.formData.imageFiles).toHaveLength(2)
    expect(wrapper.vm.formData.floorInput).toContain('一层')
    expect(wrapper.vm.formData.openingHours.length).toBeGreaterThan(0)

    expect(mocks.canteenApiMock.getWindows).toHaveBeenCalledWith('c1', { page: 1, pageSize: 100 })
    expect(wrapper.vm.windows).toHaveLength(2)

    wrapper.unmount()
  })

  it('editCanteen enforces permission', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    await wrapper.vm.editCanteen({ id: 'c1', name: 'n' })
    expect(window.alert).toHaveBeenCalledWith('您没有权限编辑食堂')

    wrapper.unmount()
  })

  it('deleteCanteen handles permission, confirm cancel, success, and non-200', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    // no permission
    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    await wrapper.vm.deleteCanteen({ id: 'c1', name: 'n' })
    expect(window.alert).toHaveBeenCalledWith('您没有权限删除食堂')

    // confirm cancel
    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.deleteCanteen({ id: 'c1', name: 'n' })
    expect(mocks.canteenApiMock.deleteCanteen).not.toHaveBeenCalled()

    // success
    ;(window.confirm as any).mockReturnValueOnce(true)
    await wrapper.vm.deleteCanteen({ id: 'c1', name: 'n' })
    expect(window.alert).toHaveBeenCalledWith('删除成功！')

    // non-200
    mocks.canteenApiMock.deleteCanteen.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.deleteCanteen({ id: 'c1', name: 'n' })
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('bad')

    wrapper.unmount()
  })

  it('handleImageUpload validates size, reads data URL, and clears input value', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })

    const small = new File(['x'], 'ok.png', { type: 'image/png' })
    Object.defineProperty(small, 'size', { value: 1024 })

    const evt: any = { target: { files: [big, small], value: 'x' } }
    wrapper.vm.handleImageUpload(evt)

    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('大小超过10MB')
    expect(wrapper.vm.formData.imageFiles.length).toBe(1)
    expect(evt.target.value).toBe('')

    wrapper.unmount()
  })

  it('removeImage and setAsCover reorder imageFiles', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.imageFiles = [
      { id: 'a', url: 'u1', isNew: false },
      { id: 'b', url: 'u2', isNew: false },
      { id: 'c', url: 'u3', isNew: false },
    ]

    wrapper.vm.setAsCover(2)
    expect(wrapper.vm.formData.imageFiles[0].id).toBe('c')

    wrapper.vm.removeImage(0)
    expect(wrapper.vm.formData.imageFiles[0].id).toBe('a')

    wrapper.unmount()
  })

  it('addWindow requires floors; add/remove opening hours', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.floorInput = ''
    wrapper.vm.addWindow()
    expect(window.alert).toHaveBeenCalledWith('请先配置并保存楼层信息后再添加窗口')

    wrapper.vm.formData.floorInput = '一层/B1'
    wrapper.vm.addWindow()
    expect(wrapper.vm.windows.length).toBe(1)

    wrapper.vm.addOpeningHours()
    expect(wrapper.vm.formData.openingHours.length).toBe(1)

    wrapper.vm.removeOpeningHours(0)
    expect(wrapper.vm.formData.openingHours.length).toBe(0)

    wrapper.unmount()
  })

  it('removeWindow handles unsaved window and saved window branches', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.windows = [{ name: 'x' }] as any
    await wrapper.vm.removeWindow(0)
    expect(wrapper.vm.windows).toEqual([])

    wrapper.vm.windows = [{ id: 'w1', name: 'x' }] as any

    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.removeWindow(0, 'w1')
    expect(mocks.canteenApiMock.deleteWindow).not.toHaveBeenCalled()

    ;(window.confirm as any).mockReturnValueOnce(true)
    await wrapper.vm.removeWindow(0, 'w1')
    expect(mocks.canteenApiMock.deleteWindow).toHaveBeenCalledWith('w1')

    // non-200
    wrapper.vm.windows = [{ id: 'w2', name: 'x' }] as any
    mocks.canteenApiMock.deleteWindow.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.removeWindow(0, 'w2')
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('bad')

    wrapper.unmount()
  })

  it('submitForm validates name/floorInput and floor parsing/range', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.formData.name = ''
    wrapper.vm.formData.floorInput = ''
    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.name).toBe('请填写食堂名称')
    expect(wrapper.vm.errors.floorInput).toBe('请填写楼层信息')

    // unparseable
    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.floorInput = '未知层'
    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.floorInput).toContain('无法解析楼层信息')

    // out of range
    wrapper.vm.formData.floorInput = '10层'
    await wrapper.vm.submitForm()
    expect(wrapper.vm.errors.floorInput).toContain('超出范围')

    wrapper.unmount()
  })

  it('submitForm create success stays in edit mode (early return) and uploads images', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.viewMode = 'edit'
    wrapper.vm.formData.name = ' n '
    wrapper.vm.formData.floorInput = '一层'

    const f = new File(['x'], 'ok.png', { type: 'image/png' })
    Object.defineProperty(f, 'size', { value: 1024 })
    wrapper.vm.formData.imageFiles = [{ id: 'i1', file: f, url: '', isNew: true }]

    await wrapper.vm.submitForm()

    expect(mocks.dishApiMock.uploadImage).toHaveBeenCalled()
    expect(mocks.canteenApiMock.createCanteen).toHaveBeenCalled()
    expect(wrapper.vm.editingCanteen).toBeTruthy()
    expect(wrapper.vm.viewMode).toBe('edit')

    wrapper.unmount()
  })

  it('submitForm edit validates window/openingHours floors and update flow saves windows', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.viewMode = 'edit'
    wrapper.vm.editingCanteen = { id: 'c1' }

    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.floorInput = '一层/B1'

    // invalid: window missing floor
    wrapper.vm.windows = [{ id: 'w1', name: '窗口1', floor: '' }] as any
    await wrapper.vm.submitForm()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('选择楼层')

    // invalid: opening hours missing floor
    wrapper.vm.windows = [] as any
    wrapper.vm.formData.openingHours = [{ day: '周一', open: '06:30', close: '22:00', floor: '' }] as any
    await wrapper.vm.submitForm()
    expect((window.alert as any).mock.calls.flat().join(' ')).toContain('选择楼层')

    // success path: update canteen + save windows + backToList
    wrapper.vm.formData.openingHours = [{ day: '周一', open: '06:30', close: '22:00', floor: '1' }] as any
    wrapper.vm.windows = [
      { id: 'w1', name: '窗口1', number: '01', floor: '1', floorLabel: '一层' },
      { name: '新窗口', number: '02', floor: '1', floorLabel: '一层' },
      { name: '   ', number: '03', floor: '1', floorLabel: '一层' },
    ] as any

    await wrapper.vm.submitForm()

    expect(mocks.canteenApiMock.updateCanteen).toHaveBeenCalledWith('c1', expect.any(Object))
    expect(mocks.canteenApiMock.updateWindow).toHaveBeenCalled()
    expect(mocks.canteenApiMock.createWindow).toHaveBeenCalled()
    expect(wrapper.vm.viewMode).toBe('list')

    wrapper.unmount()
  })

  it('submitForm image processing: partial failure confirm cancel stops saving', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.viewMode = 'edit'
    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.floorInput = '一层'

    const f1 = new File(['x'], '1.png', { type: 'image/png' })
    const f2 = new File(['x'], '2.png', { type: 'image/png' })
    Object.defineProperty(f1, 'size', { value: 1024 })
    Object.defineProperty(f2, 'size', { value: 1024 })

    wrapper.vm.formData.imageFiles = [
      { id: 'i1', file: f1, url: '', isNew: true },
      { id: 'i2', file: f2, url: '', isNew: true },
    ]

    mocks.dishApiMock.uploadImage.mockResolvedValueOnce({ code: 200, data: { url: 'u1' } })
    mocks.dishApiMock.uploadImage.mockResolvedValueOnce({ code: 500, message: 'bad' })

    ;(window.confirm as any).mockReturnValueOnce(false)

    await wrapper.vm.submitForm()

    expect(mocks.canteenApiMock.createCanteen).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('submitForm image processing: upload rejected triggers confirm and can continue saving', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.viewMode = 'edit'
    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.floorInput = '一层'

    const f = new File(['x'], '1.png', { type: 'image/png' })
    Object.defineProperty(f, 'size', { value: 1024 })

    wrapper.vm.formData.imageFiles = [{ id: 'i1', file: f, url: '', isNew: true }]
    mocks.dishApiMock.uploadImage.mockRejectedValueOnce(new Error('boom'))

    ;(window.confirm as any).mockReturnValueOnce(true)
    await wrapper.vm.submitForm()

    expect(window.confirm).toHaveBeenCalled()
    expect((window.confirm as any).mock.calls.flat().join(' ')).toContain('图片处理失败')
    expect(mocks.canteenApiMock.createCanteen).toHaveBeenCalled()

    wrapper.unmount()
  })
})
