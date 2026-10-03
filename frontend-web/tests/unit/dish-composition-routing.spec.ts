import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { RouterView } from 'vue-router'
import SingleAdd from '@/views/SingleAdd.vue'
import AddSubDish from '@/views/AddSubDish.vue'
import { useAuthStore } from '@/store/modules/use-auth-store'
import router from '@/router'

const mocks = vi.hoisted(() => ({
  createDish: vi.fn(),
  uploadImage: vi.fn(),
  getDishById: vi.fn(),
  getPendingUploadById: vi.fn(),
  getCanteens: vi.fn(),
  getWindows: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
}))

vi.mock('@/api/modules/dish', () => ({ dishApi: mocks }))
vi.mock('@/api/modules/review', () => ({ reviewApi: mocks }))
vi.mock('@/api/modules/canteen', () => ({ canteenApi: mocks }))
vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlert,
  showConfirm: mocks.showConfirm,
}))
vi.mock('@/views/Login.vue', () => ({ default: { template: '<div>登录</div>' } }))
vi.mock('@/views/ReviewDish.vue', () => ({ default: { template: '<div>审核</div>' } }))
vi.mock('@/views/BatchAdd.vue', () => ({ default: { template: '<div>批量录入</div>' } }))
vi.mock('@/views/EditDish.vue', () => ({ default: { template: '<div>编辑菜品</div>' } }))

describe('pending dish composition routing', () => {
  let wrapper: VueWrapper | undefined
  let auth: ReturnType<typeof useAuthStore>
  let pinia: ReturnType<typeof createPinia>
  let uploads: Map<string, any>

  const settle = async () => {
    await flushPromises()
    await nextTick()
    await flushPromises()
  }

  const open = async (approve = false, path = '/single-add') => {
    auth.permissions = ['dish:create', 'dish:edit', ...(approve ? ['upload:approve'] : [])]
    await router.push(path)
    await router.isReady()
    wrapper = mount(RouterView, {
      global: { plugins: [pinia, router], stubs: { Header: true, Sidebar: true } },
    })
    await settle()
  }

  const parent = () => wrapper!.findComponent(SingleAdd)
  const child = () => wrapper!.findComponent(AddSubDish)
  const fillParent = (name: string) => {
    Object.assign(parent().vm.formData, {
      name,
      canteenId: 'c1',
      canteen: '食堂',
      windowId: 'w1',
      windowName: '窗口',
      windowNumber: '01',
    })
  }
  const addChildren = (...names: string[]) => {
    names.forEach((name) => {
      parent().vm.addSubItem()
      parent().vm.formData.subItems.at(-1).name = name
    })
  }
  const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => { resolve = done })
    return { promise, resolve }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
    auth = useAuthStore()
    auth.token = 'session-a'
    auth.isAuthenticated = true
    auth.user = { id: 'admin-a', username: 'a', role: 'admin' } as any
    uploads = new Map()
    mocks.createDish.mockImplementation(async (data) => {
      const upload = { ...data, id: `upload-${uploads.size + 1}` }
      uploads.set(upload.id, upload)
      return { code: 201, data: upload }
    })
    mocks.getPendingUploadById.mockImplementation(async (id) => ({
      code: 200,
      data: uploads.get(id),
    }))
    mocks.getDishById.mockResolvedValue({
      code: 200,
      data: { id: 'approved-parent', name: '已审核菜品', canteenName: '食堂', windowName: '窗口' },
    })
    mocks.getCanteens.mockResolvedValue({ code: 200, data: { items: [{ id: 'c1', name: '食堂' }] } })
    mocks.getWindows.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'w1', name: '窗口', number: '01' }] },
    })
    mocks.uploadImage.mockResolvedValue({ code: 200, data: { url: '/image.png' } })
    mocks.showAlert.mockResolvedValue(undefined)
    mocks.showConfirm.mockResolvedValue(true)
  })

  afterEach(async () => {
    wrapper?.unmount()
    wrapper = undefined
    auth.logout()
    await router.push('/login')
    await settle()
  })

  it.each([false, true])('starts a fresh parent after completion (approve=%s)', async (approve) => {
    await open(approve)
    fillParent('A')
    await parent().vm.submitForm()
    await settle()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(approve ? '/review-dish' : '/single-add'))
    if (approve) await router.push('/single-add')
    await settle()
    expect(parent().vm.formData.name).toBe('')
    expect(parent().vm.parentUploadId).toBeNull()

    fillParent('B')
    addChildren('B 小份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    expect(mocks.createDish.mock.calls.map(([data]) => data.name)).toEqual(['A', 'B'])
    expect(router.currentRoute.value.query.parentUploadId).toBe('upload-2')
    await child().vm.submitForm()
    await settle()
    expect(mocks.createDish).toHaveBeenLastCalledWith(expect.objectContaining({
      name: 'B 小份', parentUploadId: 'upload-2',
    }))
  })

  it.each([false, true])('retains sibling drafts and parent through child submit/cancel (approve=%s)', async (approve) => {
    await open(approve)
    fillParent('多规格菜品')
    addChildren('小份', '大份')
    const originalUid = parent().vm.$.uid
    await parent().vm.goToSubItemDetail(0)
    await settle()
    expect(child().exists()).toBe(true)
    await child().vm.submitForm()
    await settle()
    expect(router.currentRoute.value.path).toBe('/single-add')
    expect(parent().vm.$.uid).not.toBe(originalUid)
    expect(parent().vm.formData.name).toBe('多规格菜品')
    expect(parent().vm.parentUploadId).toBe('upload-1')
    expect(parent().vm.formData.subItems.map((item: any) => item.name)).toEqual(['小份', '大份'])
    expect(parent().vm.formData.subItems[0].uploadId).toBe('upload-2')
    expect(parent().get('input[placeholder="例如：水煮肉片"]').element.matches(':disabled')).toBe(true)

    await parent().vm.goToSubItemDetail(1)
    await settle()
    await child().vm.goBack()
    await settle()
    expect(router.currentRoute.value.path).toBe('/single-add')
    expect(parent().vm.formData.subItems[1].name).toBe('大份')
    expect(parent().vm.parentUploadId).toBe('upload-1')
    await parent().vm.goToSubItemDetail(1)
    await settle()
    await child().vm.submitForm()
    await settle()
    expect(mocks.createDish.mock.calls.map(([data]) => [data.name, data.parentUploadId])).toEqual([
      ['多规格菜品', undefined], ['小份', 'upload-1'], ['大份', 'upload-1'],
    ])
    await parent().vm.submitForm()
    await settle()
    expect(mocks.createDish).toHaveBeenCalledTimes(3)
    if (approve) await router.push('/single-add')
    await settle()
    expect(parent().vm.formData.subItems).toEqual([])
    expect(parent().vm.parentUploadId).toBeNull()
  })

  it('does not resubmit a completed child from its previous route', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份', '大份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const completedChildRoute = router.currentRoute.value.fullPath
    await child().vm.submitForm()
    await settle()
    await router.push(completedChildRoute)
    await settle()
    await child().vm.submitForm()
    await settle()
    expect(mocks.createDish).toHaveBeenCalledTimes(2)
  })

  it('records an accepted child after browser back returns to its active parent', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份', '大份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const result = deferred<any>()
    mocks.createDish.mockReturnValueOnce(result.promise)
    const submission = child().vm.submitForm()
    await settle()
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/single-add'))
    await settle()
    mocks.showAlert.mockClear()
    result.resolve({ code: 201, data: { id: 'accepted-child' } })
    await submission
    await settle()
    expect.soft(parent().vm.formData.subItems[0].uploadId).toBe('accepted-child')
    expect(mocks.showAlert).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/single-add')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    if (child().exists()) await child().vm.submitForm()
    expect(mocks.createDish).toHaveBeenCalledTimes(2)
  })

  it('keeps a child submission pending across remounts and prevents a second POST', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const result = deferred<any>()
    mocks.createDish.mockReturnValueOnce(result.promise)
    const submission = child().vm.submitForm()
    await settle()
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/single-add'))
    await settle()
    expect.soft(parent().get('input[placeholder="子项名称（如：小份、中份、大份）"]').element.matches(':disabled')).toBe(true)
    await parent().vm.goToSubItemDetail(0)
    await settle()
    expect.soft(child().vm.isSubmitting).toBe(true)
    await child().vm.submitForm()
    expect.soft(mocks.createDish).toHaveBeenCalledTimes(2)
    mocks.showAlert.mockClear()
    result.resolve({ code: 201, data: { id: 'accepted-child' } })
    await submission
    await settle()
    expect(child().vm.isSubmitted).toBe(true)
    expect(child().vm.isSubmitting).toBe(false)
    expect(router.currentRoute.value.path).toBe('/add-sub-dish')
    expect(mocks.showAlert).not.toHaveBeenCalled()
  })

  it('continues the owned child submission after image upload across remounts', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const upload = deferred<any>()
    mocks.uploadImage.mockReturnValueOnce(upload.promise)
    const file = new File(['image'], 'small.png', { type: 'image/png' })
    child().vm.formData.imageFiles = [{ id: 'small-image', file, preview: '' }]
    const submission = child().vm.submitForm()
    await settle()
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/single-add'))
    await settle()
    await parent().vm.goToSubItemDetail(0)
    await settle()
    await child().vm.submitForm()
    expect(mocks.uploadImage).toHaveBeenCalledTimes(1)
    mocks.showAlert.mockClear()
    upload.resolve({ code: 200, data: { url: '/small.png' } })
    await submission
    await settle()
    expect(mocks.createDish).toHaveBeenCalledTimes(2)
    expect(mocks.createDish).toHaveBeenLastCalledWith(expect.objectContaining({
      name: '小份', parentUploadId: 'upload-1', images: ['/small.png'],
    }))
    expect(child().vm.formData.imageFiles[0].file).toBe(file)
    expect(child().vm.isSubmitted).toBe(true)
    expect(child().vm.isSubmitting).toBe(false)
    expect(mocks.showAlert).not.toHaveBeenCalled()
  })

  it('releases shared pending state after a failed child POST so the reopened view can retry', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const result = deferred<any>()
    mocks.createDish.mockReturnValueOnce(result.promise)
    const submission = child().vm.submitForm()
    await settle()
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/single-add'))
    await settle()
    await parent().vm.goToSubItemDetail(0)
    await settle()
    mocks.showAlert.mockClear()
    result.resolve({ code: 500, message: '创建失败' })
    await submission
    await settle()
    expect(child().vm.isSubmitting).toBe(false)
    expect(child().vm.isSubmitted).toBe(false)
    expect(mocks.showAlert).not.toHaveBeenCalled()
    await child().vm.submitForm()
    await settle()
    expect(mocks.createDish).toHaveBeenCalledTimes(3)
    expect(parent().vm.formData.subItems[0].uploadId).toBe('upload-2')
  })

  it('does not ask an unmounted child view to confirm an image failure', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const upload = deferred<any>()
    mocks.uploadImage.mockReturnValueOnce(upload.promise)
    child().vm.formData.imageFiles = [{
      id: 'small-image', file: new File(['image'], 'small.png', { type: 'image/png' }), preview: '',
    }]
    const submission = child().vm.submitForm()
    await settle()
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/single-add'))
    await settle()
    mocks.showAlert.mockClear()
    upload.resolve({ code: 500, message: '上传失败' })
    await submission
    await settle()
    expect(parent().vm.formData.subItems[0].isSubmitting).toBe(false)
    expect(parent().vm.formData.subItems[0].uploadId).toBeUndefined()
    expect(mocks.createDish).toHaveBeenCalledTimes(1)
    expect(mocks.showAlert).not.toHaveBeenCalled()
    expect(mocks.showConfirm).not.toHaveBeenCalled()
  })

  it('preserves an edited child name through browser back and reopen', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    await child().get('input[placeholder="例如：水煮肉片"]').setValue('小份套餐')
    child().vm.formData.price = 12
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/single-add'))
    await settle()
    expect.soft(parent().vm.formData.subItems[0].name).toBe('小份套餐')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    expect(child().vm.formData.price).toBe(12)
    expect(child().vm.formData.name).toBe('小份套餐')
  })

  it.each(['cancel', 'submit'])('remounts the child editor for %s after a history jump between sibling query routes', async (action) => {
    await open()
    fillParent('父菜品')
    addChildren('小份', '大份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const smallRoute = router.currentRoute.value.fullPath
    await child().vm.goBack()
    await settle()
    await parent().vm.goToSubItemDetail(1)
    await settle()
    const largeViewId = child().vm.$.uid
    expect(child().vm.formData.name).toBe('大份')
    router.go(-2)
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(smallRoute))
    await settle()
    expect.soft(child().vm.$.uid).not.toBe(largeViewId)
    expect.soft(child().vm.formData.name).toBe('小份')
    if (action === 'submit') {
      await child().vm.submitForm()
      expect(mocks.createDish).toHaveBeenLastCalledWith(expect.objectContaining({ name: '小份' }))
    } else {
      await child().vm.goBack()
    }
    await settle()
    expect(router.currentRoute.value.path).toBe('/single-add')
  })

  it.each(['end', 'logout'])('does not record a pending child response after composition %s', async (boundary) => {
    await open()
    fillParent('父菜品')
    addChildren('小份')
    const item = parent().vm.formData.subItems[0]
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const result = deferred<any>()
    mocks.createDish.mockReturnValueOnce(result.promise)
    const submission = child().vm.submitForm()
    await settle()
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/single-add'))
    await settle()
    if (boundary === 'end') await parent().vm.resetForm()
    else auth.logout()
    mocks.showAlert.mockClear()
    result.resolve({ code: 201, data: { id: 'obsolete-child' } })
    await submission
    await settle()
    expect(item.uploadId).toBeUndefined()
    expect(parent().vm.formData.subItems).toEqual([])
    expect(parent().vm.parentUploadId).toBeNull()
    expect(mocks.showAlert).not.toHaveBeenCalled()
  })

  it('clears composition when leaving its routes', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份', '大份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    await router.push('/batch-add')
    await router.push('/single-add')
    await settle()
    expect(parent().vm.formData.name).toBe('')
    expect(parent().vm.parentUploadId).toBeNull()
    expect(parent().vm.formData.subItems).toEqual([])
  })

  it('does not reopen an expired composition child after completing the parent', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    const childRoute = router.currentRoute.value.fullPath
    await child().vm.submitForm()
    await settle()
    await parent().vm.submitForm()
    await settle()
    await router.push(childRoute)
    await settle()
    await child().vm.submitForm()
    await settle()
    expect(mocks.createDish).toHaveBeenCalledTimes(2)
    expect(child().text()).toContain('本次录入已结束')
  })

  it('preserves a cancelled child form and applies a renamed sibling on reopen', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份', '大份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    child().vm.formData.price = 12
    child().vm.formData.description = '规格详情'
    await child().vm.goBack()
    await settle()
    parent().vm.formData.subItems[0].name = '小份套餐'
    await parent().vm.goToSubItemDetail(0)
    await settle()
    expect(child().vm.formData.name).toBe('小份套餐')
    expect(child().vm.formData.price).toBe(12)
    expect(child().vm.formData.description).toBe('规格详情')
    expect(mocks.createDish).toHaveBeenCalledTimes(1)
  })

  it('does not restore a late file preview into a new composition', async () => {
    const readers: Array<{ onload: (event: any) => void }> = []
    vi.stubGlobal('FileReader', class {
      onload = () => {}
      constructor() { readers.push(this) }
      readAsDataURL() {}
    })
    try {
      await open()
      fillParent('父菜品')
      parent().vm.handleImageUpload({ target: {
        files: [new File(['image'], 'image.png', { type: 'image/png' })], value: 'image.png',
      } })
      await router.push('/batch-add')
      await router.push('/single-add')
      await settle()
      readers[0].onload({ target: { result: 'data:old-image' } })
      expect(parent().vm.formData.imageFiles).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('clears parent and sibling state synchronously on logout', async () => {
    await open()
    fillParent('账号 A 菜品')
    addChildren('小份', '大份')
    await parent().vm.goToSubItemDetail(0)
    await settle()
    await child().vm.goBack()
    await settle()
    expect(parent().vm.parentUploadId).toBe('upload-1')
    auth.logout()
    expect(parent().vm.formData.name).toBe('')
    expect(parent().vm.parentUploadId).toBeNull()
    expect(parent().vm.formData.subItems).toEqual([])
  })

  it('keeps an explicitly saved parent open until unfinished child drafts are confirmed', async () => {
    await open()
    fillParent('父菜品')
    addChildren('小份', '大份')
    await parent().vm.submitForm()
    await settle()
    expect(parent().vm.parentUploadId).toBe('upload-1')
    expect(parent().vm.formData.subItems).toHaveLength(2)
    mocks.showConfirm.mockResolvedValueOnce(false)
    await parent().vm.submitForm()
    expect(parent().vm.parentUploadId).toBe('upload-1')
    expect(mocks.createDish).toHaveBeenCalledTimes(1)
    await parent().vm.submitForm()
    await settle()
    expect(parent().vm.parentUploadId).toBeNull()
    expect(parent().vm.formData.subItems).toEqual([])
    expect(mocks.createDish).toHaveBeenCalledTimes(1)
  })

  it.each(['parent', 'child'])('stops %s creation after an upload outlives its session', async (kind) => {
    await open()
    fillParent('账号 A 菜品')
    if (kind === 'child') {
      addChildren('小份')
      await parent().vm.goToSubItemDetail(0)
      await settle()
    }
    const view = kind === 'child' ? child() : parent()
    const upload = deferred<any>()
    mocks.uploadImage.mockReturnValueOnce(upload.promise)
    view.vm.formData.imageFiles = [{
      id: 'image-a', file: new File(['image'], 'a.png', { type: 'image/png' }), preview: 'data:image',
    }]
    const submission = view.vm.submitForm()
    await settle()
    expect(mocks.uploadImage).toHaveBeenCalledTimes(1)
    auth.logout()
    await router.push('/login')
    auth.token = 'session-b'
    auth.isAuthenticated = true
    auth.user = { id: 'admin-b', username: 'b', role: 'admin' } as any
    auth.permissions = ['dish:create']
    await router.push('/single-add')
    await settle()
    fillParent('账号 B 草稿')
    upload.resolve({ code: 200, data: { url: '/a.png' } })
    await submission
    await settle()
    expect(mocks.createDish).toHaveBeenCalledTimes(kind === 'child' ? 1 : 0)
    expect(parent().vm.formData.name).toBe('账号 B 草稿')
    expect(parent().vm.parentUploadId).toBeNull()
    expect(mocks.showConfirm).not.toHaveBeenCalled()
  })

  it.each(['parent', 'child'])('ignores a late %s create result after leaving the composition', async (kind) => {
    await open()
    fillParent('父菜品 A')
    addChildren('小份')
    if (kind === 'child') {
      await parent().vm.goToSubItemDetail(0)
      await settle()
    }
    const result = deferred<any>()
    mocks.createDish.mockReturnValueOnce(result.promise)
    const submission = kind === 'child' ? child().vm.submitForm() : parent().vm.goToSubItemDetail(0)
    await settle()
    await router.push('/batch-add')
    await router.push('/single-add')
    await settle()
    fillParent('父菜品 B')
    mocks.showAlert.mockClear()
    result.resolve({ code: 201, data: { id: 'old-upload' } })
    await submission
    await settle()
    expect(router.currentRoute.value.path).toBe('/single-add')
    expect(parent().vm.formData.name).toBe('父菜品 B')
    expect(parent().vm.parentUploadId).toBeNull()
    expect(parent().vm.formData.subItems).toEqual([])
    expect(mocks.showAlert).not.toHaveBeenCalled()
  })

  it.each(['reset', 'logout'])('discards a file preview after the parent is %s', async (boundary) => {
    const reader = { onload: (_event: any) => {} }
    vi.stubGlobal('FileReader', class {
      constructor() { return reader }
    })
    Object.assign(reader, { readAsDataURL: () => {} })
    try {
      await open()
      fillParent('父菜品')
      parent().vm.handleImageUpload({ target: {
        files: [new File(['image'], 'a.png', { type: 'image/png' })], value: 'a.png',
      } })
      if (boundary === 'reset') await parent().vm.resetForm()
      if (boundary === 'logout') auth.logout()
      reader.onload({ target: { result: 'data:old-image' } })
      expect(parent().vm.formData.imageFiles).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each(['parent', 'child'])('uploads a selected %s image before its preview is ready', async (kind) => {
    const reader = { onload: (_event: any) => {}, readAsDataURL: () => {} }
    vi.stubGlobal('FileReader', class { constructor() { return reader } })
    try {
      await open()
      fillParent('父菜品')
      addChildren('小份')
      if (kind === 'child') {
        await parent().vm.goToSubItemDetail(0)
        await settle()
      }
      const view = kind === 'child' ? child() : parent()
      const file = new File(['image'], 'selected.png', { type: 'image/png' })
      view.vm.handleImageUpload({ target: { files: [file], value: 'selected.png' } })
      await view.vm.submitForm()
      await settle()
      expect(mocks.uploadImage).toHaveBeenCalledWith(file)
      expect(mocks.createDish).toHaveBeenLastCalledWith(expect.objectContaining({ images: ['/image.png'] }))
      reader.onload({ target: { result: 'data:preview' } })
      const savedForm = kind === 'child' ? parent().vm.formData.subItems[0].formData : parent().vm.formData
      expect(savedForm.imageFiles).toHaveLength(1)
      expect(savedForm.imageFiles[0].preview).toBe('data:preview')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('retains the approved-parent return path', async () => {
    await open(false, '/add-sub-dish?parentId=approved-parent&subItemName=小份')
    await child().vm.submitForm()
    await settle()
    expect(mocks.createDish).toHaveBeenLastCalledWith(expect.objectContaining({ parentDishId: 'approved-parent' }))
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/edit-dish/approved-parent'))
  })
})
