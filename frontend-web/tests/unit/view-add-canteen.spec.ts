import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount, mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'
import { invalidateAuthSession } from '../../src/utils/auth-session'

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
  showAlertMock: vi.fn(() => Promise.resolve()),
  showConfirmMock: vi.fn(() => Promise.resolve(true)),
  showConfirmDangerMock: vi.fn(() => Promise.resolve(true)),
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

vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlertMock,
  showConfirm: mocks.showConfirmMock,
  showConfirmDanger: mocks.showConfirmDangerMock,
}))

import AddCanteen from '../../src/views/AddCanteen.vue'

function flushMicrotasks() {
  return Promise.resolve()
}

function deferred<T = any>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const editableCanteen = (id: string, openingHours: any[] = []) => ({
  id, name: `食堂${id}`, floors: [{ level: '1', name: '一层' }, { level: '-1', name: 'B1' }],
  openingHours,
})
const windowsResponse = (id: string) => ({
  code: 200,
  data: { items: [{ id: `w${id}`, name: `窗口${id}`, floor: { level: '1', name: '一层' } }] },
})

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

    // Reset modal mocks
    mocks.showAlertMock.mockClear()
    mocks.showConfirmMock.mockClear()
    mocks.showConfirmDangerMock.mockClear()
    mocks.showAlertMock.mockResolvedValue(undefined)
    mocks.showConfirmMock.mockResolvedValue(true)
    mocks.showConfirmDangerMock.mockResolvedValue(true)

    ;(globalThis as any).FileReader = FileReaderMock
  })

  afterEach(() => {
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

    expect(mocks.showAlertMock).toHaveBeenCalledWith('加载食堂列表失败，请刷新重试')
    wrapper.unmount()
  })

  it('createNewCanteen enforces permission and switches view', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    wrapper.vm.createNewCanteen()
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限创建食堂')

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
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限编辑食堂')

    wrapper.unmount()
  })

  it('round trips every grouped meal slot, floor and closed day without mutating its source', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    const openingHours = [
      { floorLevel: '1', schedule: [
        { dayOfWeek: 'Monday', isClosed: false, slots: [
          { mealType: 'breakfast', openTime: '06:30', closeTime: '09:00' },
          { mealType: 'lunch', openTime: '11:00', closeTime: '13:00' },
          { mealType: 'dinner', openTime: '17:00', closeTime: '19:30' },
        ] },
        { dayOfWeek: 'Tuesday', isClosed: true, slots: [] },
      ] },
      { floorLevel: '-1', schedule: [
        { dayOfWeek: 'Sunday', isClosed: true, slots: [
          { mealType: 'nightsnack', openTime: '20:00', closeTime: '23:00' },
        ] },
      ] },
    ]
    const source = JSON.parse(JSON.stringify(openingHours))
    await wrapper.vm.editCanteen(editableCanteen('c1', openingHours))
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen.mock.calls[0]?.[1].openingHours).toEqual(source)
    expect(openingHours).toEqual(source)
    await wrapper.vm.editCanteen(editableCanteen('c1', mocks.canteenApiMock.updateCanteen.mock.calls[0][1].openingHours))
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen.mock.calls[1]?.[1].openingHours).toEqual(source)
    wrapper.unmount()
  })

  it('merges legacy same-day slots and expands daily hours once per floor and day', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    const breakfast = { mealType: 'breakfast', openTime: '06:30', closeTime: '09:00' }
    const lunch = { mealType: 'lunch', openTime: '11:00', closeTime: '13:00' }
    await wrapper.vm.editCanteen(editableCanteen('c1', [
      { day: '每天', floor: '1', slots: [breakfast, lunch], isClosed: false },
      { dayOfWeek: 'Monday', floor: { level: '1' }, slots: [breakfast], isClosed: false },
      { dayOfWeek: 'Sunday', floor: { level: '-1' }, slots: [], isClosed: true },
    ]))
    await wrapper.vm.submitForm()
    const saved = mocks.canteenApiMock.updateCanteen.mock.calls[0]?.[1].openingHours
    expect(saved).toEqual([
      { floorLevel: '1', schedule: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(dayOfWeek => ({
        dayOfWeek, slots: [breakfast, lunch], isClosed: false,
      })) },
      { floorLevel: '-1', schedule: [{ dayOfWeek: 'Sunday', slots: [], isClosed: true }] },
    ])
    wrapper.unmount()
  })

  it('keeps generic floor schedules and allows changing a closed day through the form', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(editableCanteen('c1', [
      { floorLevel: 'default', schedule: [{ dayOfWeek: 'Monday', slots: [], isClosed: true }] },
    ]))
    await nextTick()
    const closed = wrapper.find('input[type="checkbox"][aria-label="当日休息"]')
    expect(closed.exists()).toBe(true)
    await closed.setValue(false)
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen.mock.calls[0]?.[1].openingHours).toEqual([
      { floorLevel: 'default', schedule: [{ dayOfWeek: 'Monday', slots: [], isClosed: false }] },
    ])
    wrapper.unmount()
  })

  it('edits an individual meal without changing adjacent slots or the source record', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const source = editableCanteen('c1', [{ floorLevel: '1', schedule: [{
      dayOfWeek: 'Monday', isClosed: false, slots: [
        { mealType: 'breakfast', openTime: '06:30', closeTime: '09:00' },
        { mealType: 'lunch', openTime: '11:00', closeTime: '13:00' },
      ],
    }] }])
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(source)
    await nextTick()
    const times = wrapper.findAll('input[type="time"]')
    expect(times).toHaveLength(4)
    await times[2].setValue('11:30')
    expect(source.openingHours[0].schedule[0].slots[1].openTime).toBe('11:00')
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen.mock.calls[0][1].openingHours[0].schedule[0].slots).toEqual([
      { mealType: 'breakfast', openTime: '06:30', closeTime: '09:00' },
      { mealType: 'lunch', openTime: '11:30', closeTime: '13:00' },
    ])
    wrapper.unmount()
  })

  it('preserves a stored floor level when its display name has no floor number', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen({
      id: 'A', name: '食堂A', floors: [{ level: '-1', name: '地下餐厅' }, { level: '2', name: '清真区' }],
      openingHours: [{ floorLevel: '-1', schedule: [{ dayOfWeek: 'Monday', slots: [], isClosed: true }] }],
    })
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen).toHaveBeenCalledWith('A', expect.objectContaining({
      floors: [{ level: '-1', name: '地下餐厅' }, { level: '2', name: '清真区' }],
      openingHours: [{ floorLevel: '-1', schedule: [{ dayOfWeek: 'Monday', slots: [], isClosed: true }] }],
    }))
    wrapper.unmount()
  })

  it('reports overlapping daily and specific-day closure conflicts instead of discarding a setting', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(editableCanteen('A', [
      { floor: '1', day: '每天', slots: [], isClosed: false },
      { floor: '1', dayOfWeek: 'Sunday', slots: [], isClosed: true },
    ]))
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen).not.toHaveBeenCalled()
    expect(mocks.showAlertMock).toHaveBeenCalledWith(expect.stringContaining('营业与休息设置冲突'))
    wrapper.unmount()
  })

  it('keeps the B editor and B windows when A loading finishes last, then saves only B', async () => {
    const a = deferred(), b = deferred()
    mocks.canteenApiMock.getWindows.mockImplementation((id: string) => id === 'A' ? a.promise : b.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    const loadA = wrapper.vm.editCanteen(editableCanteen('A'))
    const loadB = wrapper.vm.editCanteen(editableCanteen('B'))
    b.resolve(windowsResponse('B'))
    await loadB
    a.resolve(windowsResponse('A'))
    await loadA
    expect(wrapper.vm.windows.map((window: any) => window.id)).toEqual(['wB'])
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen).toHaveBeenCalledWith('B', expect.objectContaining({ name: '食堂B' }))
    expect(mocks.canteenApiMock.updateWindow).toHaveBeenCalledWith('wB', expect.any(Object))
    expect(mocks.canteenApiMock.updateWindow).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('does not submit an editor while its windows are unresolved or failed', async () => {
    const pending = deferred()
    mocks.canteenApiMock.getWindows.mockReturnValue(pending.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    const loading = wrapper.vm.editCanteen(editableCanteen('A'))
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen).not.toHaveBeenCalled()
    pending.reject(new Error('offline'))
    await loading
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen).not.toHaveBeenCalled()
    mocks.canteenApiMock.getWindows.mockResolvedValue(windowsResponse('A'))
    await wrapper.vm.retryLoadWindows()
    await wrapper.vm.submitForm()
    expect(mocks.canteenApiMock.updateCanteen).toHaveBeenCalledWith('A', expect.any(Object))
    wrapper.unmount()
  })

  it('does not reopen a cancelled editor after its windows finish loading', async () => {
    const pending = deferred()
    mocks.canteenApiMock.getWindows.mockReturnValue(pending.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    const loading = wrapper.vm.editCanteen(editableCanteen('A'))
    wrapper.vm.backToList()
    pending.resolve(windowsResponse('A'))
    await loading
    expect(wrapper.vm.viewMode).toBe('list')
    expect(wrapper.vm.windows).toEqual([])
    wrapper.unmount()
  })

  it('finishes an in-flight save from its snapshot without modifying a later editor', async () => {
    mocks.canteenApiMock.getWindows.mockImplementation((id: string) => Promise.resolve(windowsResponse(id)))
    const pending = deferred()
    mocks.canteenApiMock.updateCanteen.mockReturnValueOnce(pending.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(editableCanteen('A'))
    const saving = wrapper.vm.submitForm()
    await wrapper.vm.editCanteen(editableCanteen('B'))
    pending.resolve({ code: 200, data: { id: 'A' } })
    await saving
    expect(mocks.canteenApiMock.updateWindow).toHaveBeenCalledWith('wA', expect.objectContaining({ name: '窗口A' }))
    expect(mocks.canteenApiMock.updateWindow).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.editingCanteen.id).toBe('B')
    expect(wrapper.vm.formData.name).toBe('食堂B')
    expect(wrapper.vm.windows[0].id).toBe('wB')
    expect(wrapper.vm.viewMode).toBe('edit')
    expect(mocks.showAlertMock).not.toHaveBeenCalledWith('食堂信息已更新！')
    wrapper.unmount()
  })

  it('stops a superseded upload before writing canteen data', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const upload = deferred()
    mocks.dishApiMock.uploadImage.mockReturnValueOnce(upload.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(editableCanteen('A'))
    wrapper.vm.formData.imageFiles = [{ isNew: true, file: new File(['x'], 'a.png') }]
    const saving = wrapper.vm.submitForm()
    await flushPromises()
    await wrapper.vm.editCanteen(editableCanteen('B'))
    upload.resolve({ code: 200, data: { url: 'https://example.com/a.png' } })
    await saving
    expect(mocks.canteenApiMock.updateCanteen).not.toHaveBeenCalled()
    expect(wrapper.vm.editingCanteen.id).toBe('B')
    wrapper.unmount()
  })

  it('keeps a newer submission busy when an older save finishes', async () => {
    mocks.canteenApiMock.getWindows.mockImplementation((id: string) => Promise.resolve(windowsResponse(id)))
    const a = deferred(), b = deferred()
    mocks.canteenApiMock.updateCanteen.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(editableCanteen('A'))
    const savingA = wrapper.vm.submitForm()
    wrapper.vm.backToList()
    await wrapper.vm.editCanteen(editableCanteen('B'))
    const savingB = wrapper.vm.submitForm()
    a.resolve({ code: 200, data: { id: 'A' } })
    await savingA
    expect(wrapper.vm.isSubmitting).toBe(true)
    expect(wrapper.vm.editingCanteen.id).toBe('B')
    b.resolve({ code: 200, data: { id: 'B' } })
    await savingB
    expect(mocks.canteenApiMock.updateWindow.mock.calls.map(call => call[0])).toEqual(['wA', 'wB'])
    wrapper.unmount()
  })

  it('ignores a previous editor window deletion confirmation and completed deletion', async () => {
    mocks.canteenApiMock.getWindows.mockImplementation((id: string) => Promise.resolve(windowsResponse(id)))
    const confirmation = deferred()
    mocks.showConfirmMock.mockReturnValueOnce(confirmation.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(editableCanteen('A'))
    const confirming = wrapper.vm.removeWindow(0, 'wA')
    await wrapper.vm.editCanteen(editableCanteen('B'))
    confirmation.resolve(true)
    await confirming
    expect(mocks.canteenApiMock.deleteWindow).not.toHaveBeenCalled()
    const deletion = deferred()
    mocks.canteenApiMock.deleteWindow.mockReturnValueOnce(deletion.promise)
    const deleting = wrapper.vm.removeWindow(0, 'wB')
    await flushPromises()
    await wrapper.vm.editCanteen(editableCanteen('C'))
    deletion.resolve({ code: 200 })
    await deleting
    expect(wrapper.vm.windows[0].id).toBe('wC')
    wrapper.unmount()
  })

  it('does not append an image read for a cancelled editor to the next editor', async () => {
    let finishRead: (() => void) | undefined
    ;(globalThis as any).FileReader = class {
      onload: ((event: any) => void) | null = null
      readAsDataURL() { finishRead = () => this.onload?.({ target: { result: 'data:image/png;base64,AAA' } }) }
    }
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    wrapper.vm.createNewCanteen()
    wrapper.vm.handleImageUpload({ target: { files: [new File(['x'], 'a.png')], value: '' } })
    wrapper.vm.backToList()
    wrapper.vm.createNewCanteen()
    finishRead?.()
    expect(wrapper.vm.formData.imageFiles).toEqual([])
    wrapper.unmount()
  })

  it('stops follow-up writes and clears the editor when the authentication session changes', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue(windowsResponse('A'))
    const pending = deferred()
    mocks.canteenApiMock.updateCanteen.mockReturnValueOnce(pending.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(editableCanteen('A'))
    const saving = wrapper.vm.submitForm()
    invalidateAuthSession()
    pending.resolve({ code: 200, data: { id: 'A' } })
    await saving
    expect(mocks.canteenApiMock.updateWindow).not.toHaveBeenCalled()
    expect(wrapper.vm.editingCanteen).toBeNull()
    expect(wrapper.vm.windows).toEqual([])
    expect(wrapper.vm.canteens).toEqual([])
    wrapper.unmount()
  })

  it('does not let a hidden KeepAlive load restore its stale windows after reactivation', async () => {
    const first = deferred(), second = deferred()
    mocks.canteenApiMock.getWindows.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const Parent = defineComponent({
      components: { AddCanteen },
      setup: () => ({ show: ref(true) }),
      template: '<KeepAlive><AddCanteen v-if="show" /></KeepAlive>',
    })
    const wrapper = mount(Parent, { global: { stubs: { Header: true } } })
    const editor = wrapper.findComponent(AddCanteen)
    const loading = editor.vm.editCanteen(editableCanteen('A'))
    editor.vm.formData.description = '未保存的描述'
    wrapper.vm.show = false
    await nextTick()
    wrapper.vm.show = true
    await nextTick()
    second.resolve(windowsResponse('fresh'))
    await flushPromises()
    first.resolve(windowsResponse('stale'))
    await loading
    expect(editor.vm.windows.map((window: any) => window.id)).toEqual(['wfresh'])
    expect(editor.vm.formData.description).toBe('未保存的描述')
    expect(editor.vm.isWindowsLoading).toBe(false)
    wrapper.unmount()
  })

  it('retains a new window identity saved while hidden and updates it after KeepAlive resumes', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const pending = deferred()
    mocks.canteenApiMock.updateCanteen.mockReturnValueOnce(pending.promise)
    mocks.canteenApiMock.createWindow.mockResolvedValue({ code: 200, data: {
      id: 'new-window', canteenId: 'A', name: '新增窗口', number: '01', floor: { level: '1', name: '一层' },
    } })
    const Parent = defineComponent({
      components: { AddCanteen },
      setup: () => ({ show: ref(true) }),
      template: '<KeepAlive><AddCanteen v-if="show" /></KeepAlive>',
    })
    const wrapper = mount(Parent, { global: { stubs: { Header: true } } })
    const editor = wrapper.findComponent(AddCanteen)
    await editor.vm.editCanteen(editableCanteen('A'))
    editor.vm.addWindow()
    Object.assign(editor.vm.windows[0], { name: '新增窗口', number: '01', floor: '1' })
    const saving = editor.vm.submitForm()
    wrapper.vm.show = false
    await nextTick()
    pending.resolve({ code: 200, data: { id: 'A' } })
    await saving
    expect(mocks.canteenApiMock.createWindow).toHaveBeenCalledTimes(1)
    const savedWindow = editor.vm.windows[0]
    expect(editor.vm.viewMode).toBe('edit')
    expect(editor.vm.isSubmitting).toBe(false)
    expect(mocks.showAlertMock).not.toHaveBeenCalledWith('食堂信息已更新！')
    wrapper.vm.show = true
    await nextTick()
    editor.vm.windows[0].name = '修改后的窗口'
    await editor.vm.submitForm()
    expect(mocks.canteenApiMock.createWindow).toHaveBeenCalledTimes(1)
    expect(savedWindow.id).toBe('new-window')
    expect(mocks.canteenApiMock.updateWindow).toHaveBeenCalledWith('new-window', expect.objectContaining({ name: '修改后的窗口' }))
    wrapper.unmount()
  })

  it('does not attach a completed old window creation to a later editor draft', async () => {
    mocks.canteenApiMock.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    const pending = deferred()
    mocks.canteenApiMock.createWindow.mockReturnValueOnce(pending.promise)
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    await wrapper.vm.editCanteen(editableCanteen('A'))
    wrapper.vm.addWindow()
    Object.assign(wrapper.vm.windows[0], { name: '窗口A', floor: '1' })
    const saving = wrapper.vm.submitForm()
    await flushPromises()
    expect(mocks.canteenApiMock.createWindow).toHaveBeenCalledWith(expect.objectContaining({ canteenId: 'A' }))
    await wrapper.vm.editCanteen(editableCanteen('B'))
    wrapper.vm.addWindow()
    Object.assign(wrapper.vm.windows[0], { name: '窗口B', floor: '1' })
    pending.resolve({ code: 200, data: { id: 'new-A-window', canteenId: 'A' } })
    await saving
    expect(wrapper.vm.editingCanteen.id).toBe('B')
    expect(wrapper.vm.windows[0].id).toBeUndefined()
    expect(wrapper.vm.windows[0].name).toBe('窗口B')
    expect(wrapper.vm.viewMode).toBe('edit')
    wrapper.unmount()
  })

  it('deleteCanteen handles permission, confirm cancel, success, and non-200', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    // no permission
    mocks.authStoreMock.hasPermission.mockImplementationOnce(() => false)
    await wrapper.vm.deleteCanteen({ id: 'c1', name: 'n' })
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限删除食堂')

    // confirm cancel
    mocks.showConfirmDangerMock.mockResolvedValueOnce(false)
    await wrapper.vm.deleteCanteen({ id: 'c1', name: 'n' })
    expect(mocks.canteenApiMock.deleteCanteen).not.toHaveBeenCalled()

    // success
    mocks.showConfirmDangerMock.mockResolvedValueOnce(true)
    await wrapper.vm.deleteCanteen({ id: 'c1', name: 'n' })
    expect(mocks.showAlertMock).toHaveBeenCalledWith('删除成功！')

    // non-200
    mocks.showConfirmDangerMock.mockResolvedValueOnce(true)
    mocks.canteenApiMock.deleteCanteen.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.deleteCanteen({ id: 'c1', name: 'n' })
    expect(mocks.showAlertMock).toHaveBeenCalledWith('bad')

    wrapper.unmount()
  })

  it('handleImageUpload validates size, reads data URL, and clears input value', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    wrapper.vm.createNewCanteen()

    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })

    const small = new File(['x'], 'ok.png', { type: 'image/png' })
    Object.defineProperty(small, 'size', { value: 1024 })

    const evt: any = { target: { files: [big, small], value: 'x' } }
    wrapper.vm.handleImageUpload(evt)

    expect(mocks.showAlertMock).toHaveBeenCalledWith(expect.stringContaining('大小超过10MB'))
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
    expect(mocks.showAlertMock).toHaveBeenCalledWith('请先配置并保存楼层信息后再添加窗口')

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
    await wrapper.vm.editCanteen(editableCanteen('c1'))

    wrapper.vm.windows = [{ name: 'x' }] as any
    await wrapper.vm.removeWindow(0)
    expect(wrapper.vm.windows).toEqual([])

    wrapper.vm.windows = [{ id: 'w1', name: 'x' }] as any

    mocks.showConfirmMock.mockResolvedValueOnce(false)
    await wrapper.vm.removeWindow(0, 'w1')
    expect(mocks.canteenApiMock.deleteWindow).not.toHaveBeenCalled()

    mocks.showConfirmMock.mockResolvedValueOnce(true)
    await wrapper.vm.removeWindow(0, 'w1')
    expect(mocks.canteenApiMock.deleteWindow).toHaveBeenCalledWith('w1')

    // non-200
    wrapper.vm.windows = [{ id: 'w2', name: 'x' }] as any
    mocks.showConfirmMock.mockResolvedValueOnce(true)
    mocks.canteenApiMock.deleteWindow.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.removeWindow(0, 'w2')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('bad')

    wrapper.unmount()
  })

  it('submitForm validates name/floorInput and floor parsing/range', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })
    wrapper.vm.createNewCanteen()

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

    wrapper.vm.createNewCanteen()
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

  it('submitForm edit validates window floors and update flow saves windows', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    await wrapper.vm.editCanteen(editableCanteen('c1'))

    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.floorInput = '一层/B1'

    // invalid: window missing floor
    wrapper.vm.windows = [{ id: 'w1', name: '窗口1', floor: '' }] as any
    await wrapper.vm.submitForm()
    expect(mocks.showAlertMock).toHaveBeenCalledWith(expect.stringContaining('选择楼层'))

    mocks.showAlertMock.mockClear()

    // success path: update canteen + save windows + backToList
    wrapper.vm.formData.openingHours = [{ day: '周一', floor: '1', isClosed: false, slots: [{ mealType: 'breakfast', openTime: '06:30', closeTime: '22:00' }] }] as any
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

    wrapper.vm.createNewCanteen()
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

    mocks.showConfirmMock.mockResolvedValueOnce(false)

    await wrapper.vm.submitForm()

    expect(mocks.canteenApiMock.createCanteen).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('submitForm image processing: upload rejected triggers confirm and can continue saving', async () => {
    const wrapper = shallowMount(AddCanteen, { global: { stubs: { Header: true } } })

    wrapper.vm.createNewCanteen()
    wrapper.vm.formData.name = 'n'
    wrapper.vm.formData.floorInput = '一层'

    const f = new File(['x'], '1.png', { type: 'image/png' })
    Object.defineProperty(f, 'size', { value: 1024 })

    wrapper.vm.formData.imageFiles = [{ id: 'i1', file: f, url: '', isNew: true }]
    mocks.dishApiMock.uploadImage.mockRejectedValueOnce(new Error('boom'))

    mocks.showConfirmMock.mockResolvedValueOnce(true)
    await wrapper.vm.submitForm()

    expect(mocks.showConfirmMock).toHaveBeenCalled()
    expect(mocks.canteenApiMock.createCanteen).toHaveBeenCalled()

    wrapper.unmount()
  })
})
