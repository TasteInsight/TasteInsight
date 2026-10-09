import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const mocks = vi.hoisted(() => ({
  transport: vi.fn(),
  showAlert: vi.fn(() => Promise.resolve()),
  showConfirm: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  actual.default.defaults.adapter = mocks.transport
  return actual
})
vi.mock('@/config', () => ({
  default: { baseURL: 'http://admin.test/api/v1', timeout: 1000, headers: {} },
}))
vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlert,
  showConfirm: mocks.showConfirm,
  showConfirmDanger: vi.fn(() => Promise.resolve(true)),
}))

import EditDish from '@/views/EditDish.vue'
import Login from '@/views/Login.vue'
import Sidebar from '@/components/Layout/Sidebar.vue'
import { dishApi } from '@/api/modules/dish'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { useDishStore } from '@/store/modules/use-dish-store'

const pinia = createPinia()
setActivePinia(pinia)
const auth = useAuthStore()
const dishes = useDishStore()

const originalDish = {
  id: 'd1', name: 'Original dish', canteenId: 'c1', canteenName: 'C1',
  windowId: 'w1', windowName: 'W1', windowNumber: '01', price: 12,
  description: 'Original description', images: ['https://images.test/original.png'],
  tags: ['original'], ingredients: ['rice'], allergens: [],
  availableMealTime: ['lunch'], availableDates: [], parentDishId: 'parent1', subDishId: [],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { data, config, status, statusText: String(status), headers: {} }
}

type Handler = (config: InternalAxiosRequestConfig) => unknown | Promise<unknown>
let handlers: Map<string, Handler>
let requests: { method: string; url: string; authorization: unknown; data: any }[]
let app: VueWrapper | undefined
let router: Router

async function mountEditor() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/edit-dish/:id', component: EditDish },
      { path: '/login', component: Login },
      { path: '/modify-dish', component: { template: '<div>Dish list</div>' } },
      { path: '/account-b', component: { template: '<div>Account B</div>' } },
      { path: '/other', component: { template: '<div>Other page</div>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div>Other page</div>' } },
    ],
  })
  await router.push('/edit-dish/d1')
  await router.isReady()
  app = mount(defineComponent({ components: { Sidebar }, template: '<Sidebar /><RouterView />' }), {
    global: { plugins: [pinia, router], stubs: { Header: true }, directives: { permission: {} } },
  })
  await flushPromises()
  return app.getComponent(EditDish)
}

async function switchAccount() {
  await (app!.getComponent(Sidebar).vm as any).handleLogout()
  await flushPromises()
  expect(app!.findComponent(EditDish).exists()).toBe(false)
  const login = app!.getComponent(Login)
  await login.get('#username').setValue('B')
  await login.get('#password').setValue('password')
  await login.get('form').trigger('submit')
  await flushPromises()
  expect(auth.user?.username).toBe('B')
  await router.push('/account-b')
  dishes.dishes = [{ ...originalDish, name: 'Account B current dish' }] as any
  mocks.showAlert.mockClear()
  mocks.showConfirm.mockClear()
}

function addNewImage(editor: Pick<VueWrapper<any>, 'vm'>) {
  ;(editor.vm as any).formData.imageFiles.push({
    id: 'new-image', file: new File(['image'], 'dish.png', { type: 'image/png' }),
    url: 'data:image/png;base64,AA', isNew: true,
  })
}

function expectNoStaleCompletion() {
  expect(mocks.showAlert).not.toHaveBeenCalled()
  expect(mocks.showConfirm).not.toHaveBeenCalled()
  expect(router.currentRoute.value.path).toBe('/account-b')
  expect(dishes.dishes[0].name).toBe('Account B current dish')
}

describe('edit dish operation session ownership', () => {
  beforeEach(async () => {
    setActivePinia(pinia)
    auth.logout()
    dishes.dishes = []
    handlers = new Map()
    requests = []
    mocks.showAlert.mockClear()
    mocks.showConfirm.mockReset().mockResolvedValue(true)
    mocks.transport.mockReset().mockImplementation(async (config: InternalAxiosRequestConfig) => {
      const method = config.method!.toUpperCase()
      const url = config.url!
      const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      requests.push({ method, url, authorization: config.headers.Authorization, data })
      const handler = handlers.get(`${method} ${url}`)
      if (handler) return handler(config)
      if (url === '/auth/admin/login') {
        const username = data.username
        return response(config, { code: 200, data: {
          token: { accessToken: `token-${username}`, refreshToken: `refresh-${username}` },
          admin: { id: username, username, role: 'admin' }, permissions: ['dish:view', 'dish:edit'],
        } })
      }
      if (url === '/admin/canteens') return response(config, { code: 200, data: { items: [{ id: 'c1', name: 'C1' }] } })
      if (url === '/admin/canteens/c1/windows') return response(config, { code: 200, data: { items: [{ id: 'w1', name: 'W1', number: '01' }] } })
      if (url === '/admin/dishes/d1') return response(config, { code: 200, data: { ...originalDish, ...data } })
      if (url === '/admin/dishes') return response(config, { code: 200, data: { items: [originalDish] } })
      if (url === '/upload/image') return response(config, { code: 200, data: { url: 'https://images.test/new.png' } })
      throw new Error(`Unexpected transport: ${method} ${url}`)
    })
    await auth.login({ username: 'A', password: 'password' })
    await flushPromises()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    app?.unmount()
    app = undefined
  })

  it('rejects an old-session detail response without retrying the list as the new account', async () => {
    await mountEditor()
    const detail = deferred<any>()
    handlers.set('GET /admin/dishes/d1', () => detail.promise)
    const pending = dishApi.getDishById('d1')
    const result = pending.then((value) => value, (error) => error)
    await flushPromises()
    const config = mocks.transport.mock.lastCall![0]
    await switchAccount()
    detail.resolve(response(config, { code: 200, data: originalDish }))
    expect(await result).toBeInstanceOf(Error)
    expect((await result).message).toBe('登录会话已变更，请重试')
    expect(requests.filter((request) => request.url === '/admin/dishes')).toEqual([])
    expectNoStaleCompletion()
  })

  it('does not continue loading or navigate after an initial read outlives the editor session', async () => {
    const canteens = deferred<any>()
    handlers.set('GET /admin/canteens', () => canteens.promise)
    await mountEditor()
    const config = mocks.transport.mock.lastCall![0]
    await switchAccount()
    canteens.resolve(response(config, { code: 200, data: { items: [{ id: 'c1', name: 'C1' }] } }))
    await flushPromises()
    expect(requests.filter((request) => request.url === '/admin/dishes/d1')).toEqual([])
    expectNoStaleCompletion()
  })

  it('stops after an upload completes in a different account without saving or asking to continue', async () => {
    const editor = await mountEditor()
    addNewImage(editor)
    const upload = deferred<any>()
    handlers.set('POST /upload/image', () => upload.promise)
    const pending = (editor.vm as any).submitForm()
    await flushPromises()
    const config = mocks.transport.mock.lastCall![0]
    await switchAccount()
    upload.resolve(response(config, { code: 200, data: { url: 'https://images.test/new.png' } }))
    await pending
    expect(requests.filter((request) => request.method === 'PUT')).toEqual([])
    expectNoStaleCompletion()
  })

  it('stops after an image-failure confirmation outlives its account', async () => {
    const editor = await mountEditor()
    addNewImage(editor)
    handlers.set('POST /upload/image', (config) => response(config, { code: 500, message: 'image rejected' }))
    const confirmation = deferred<boolean>()
    mocks.showConfirm.mockImplementation((_message?: string, title?: string) =>
      title === '图片处理失败' ? confirmation.promise : Promise.resolve(true))
    const pending = (editor.vm as any).submitForm()
    await flushPromises()
    expect(mocks.showConfirm).toHaveBeenCalledWith('1张图片处理失败，是否继续保存？', '图片处理失败')
    await switchAccount()
    confirmation.resolve(true)
    await pending
    expect(requests.filter((request) => request.method === 'PUT')).toEqual([])
    expectNoStaleCompletion()
  })

  it('does not publish a late save response into the new account', async () => {
    const editor = await mountEditor()
    const update = deferred<any>()
    handlers.set('PUT /admin/dishes/d1', () => update.promise)
    const pending = (editor.vm as any).submitForm()
    await flushPromises()
    const config = mocks.transport.mock.lastCall![0]
    await switchAccount()
    update.resolve(response(config, { code: 200, data: { ...originalDish, name: 'A saved dish' } }))
    await pending
    expect(requests.filter((request) => request.method === 'PUT').map((request) => request.authorization)).toEqual(['Bearer token-A'])
    expectNoStaleCompletion()
  })

  it.each(['upload', 'update'])('stops a save during %s when the editor unmounts in the same session', async (stage) => {
    const editor = await mountEditor()
    dishes.dishes = [originalDish] as any
    if (stage === 'upload') addNewImage(editor)
    const operation = deferred<any>()
    handlers.set(stage === 'upload' ? 'POST /upload/image' : 'PUT /admin/dishes/d1', () => operation.promise)
    const pending = (editor.vm as any).submitForm()
    await flushPromises()
    const config = mocks.transport.mock.lastCall![0]
    await router.push('/other')
    operation.resolve(response(config, { code: 200, data: { id: 'd1', name: 'Saved dish', url: 'https://images.test/new.png' } }))
    await pending
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(stage === 'upload' ? 0 : 1)
    expect(dishes.dishes[0].name).toBe('Original dish')
    expect(router.currentRoute.value.path).toBe('/other')
    expect(mocks.showAlert).not.toHaveBeenCalled()
  })

  it('stops a save when authentication changes before the editor has unmounted', async () => {
    const editor = await mountEditor()
    addNewImage(editor)
    const upload = deferred<any>()
    handlers.set('POST /upload/image', () => upload.promise)
    const pending = (editor.vm as any).submitForm()
    await flushPromises()
    const config = mocks.transport.mock.lastCall![0]
    await auth.login({ username: 'B', password: 'password' })
    expect(app!.findComponent(EditDish).exists()).toBe(true)
    upload.resolve(response(config, { code: 200, data: { url: 'https://images.test/new.png' } }))
    await pending
    expect(requests.filter((request) => request.method === 'PUT')).toEqual([])
    expect(mocks.showAlert).not.toHaveBeenCalled()
    expect(mocks.showConfirm).not.toHaveBeenCalled()
  })

  it('saves one immutable draft and omits server-owned dish relationships', async () => {
    const editor = await mountEditor()
    addNewImage(editor)
    const upload = deferred<any>()
    handlers.set('POST /upload/image', () => upload.promise)
    const pending = (editor.vm as any).submitForm()
    await flushPromises()
    const fieldsDisabled = editor.get('input[type="text"]').element.matches(':disabled')
    const config = mocks.transport.mock.lastCall![0]
    Object.assign((editor.vm as any).formData, { id: 'other-id', name: 'Edited while saving', description: 'Later description' })
    ;(editor.vm as any).formData.tags.push('later')
    ;(editor.vm as any).formData.imageFiles.reverse()
    upload.resolve(response(config, { code: 200, data: { url: 'https://images.test/new.png' } }))
    await pending
    const saves = requests.filter((request) => request.method === 'PUT')
    expect(saves).toHaveLength(1)
    expect(saves[0]).toMatchObject({ url: '/admin/dishes/d1', data: {
      name: 'Original dish', description: 'Original description', tags: ['original'],
      images: ['https://images.test/original.png', 'https://images.test/new.png'],
    } })
    expect(saves[0].data).not.toHaveProperty('parentDishId')
    expect(saves[0].data).not.toHaveProperty('subDishId')
    expect(requests.filter((request) => request.method === 'GET' && request.url === '/admin/dishes/d1')).toHaveLength(1)
    expect(fieldsDisabled).toBe(true)
  })

  it('allows same-session image failure confirmation and reports save failures', async () => {
    const editor = await mountEditor()
    addNewImage(editor)
    handlers.set('POST /upload/image', (config) => response(config, { code: 500, message: 'image rejected' }))
    handlers.set('PUT /admin/dishes/d1', (config) => response(config, { code: 500, message: 'save rejected' }))
    await (editor.vm as any).submitForm()
    expect(mocks.showConfirm).toHaveBeenCalledWith('1张图片处理失败，是否继续保存？', '图片处理失败')
    expect(mocks.showAlert).toHaveBeenCalledWith('save rejected')
    expect((editor.vm as any).isSubmitting).toBe(false)
    expect(router.currentRoute.value.path).toBe('/edit-dish/d1')
  })

  it('allows a token refresh within the same session to finish the save', async () => {
    const editor = await mountEditor()
    addNewImage(editor)
    handlers.set('POST /upload/image', (config) => {
      if (config.headers.Authorization === 'Bearer token-A') {
        throw new AxiosError('expired', undefined, config, undefined, response(config, {}, 401))
      }
      return response(config, { code: 200, data: { url: 'https://images.test/refreshed.png' } })
    })
    handlers.set('POST /auth/refresh', (config) => response(config, { data: {
      token: { accessToken: 'token-A-refreshed', refreshToken: 'refresh-A-new' },
    } }))
    await (editor.vm as any).submitForm()
    await nextTick()
    expect(requests.filter((request) => request.url === '/upload/image').map((request) => request.authorization))
      .toEqual(['Bearer token-A', 'Bearer token-A-refreshed'])
    expect(requests.find((request) => request.method === 'PUT')?.authorization).toBe('Bearer token-A-refreshed')
    expect(mocks.showAlert).toHaveBeenCalledWith('菜品信息已更新！')
  })

  it('does not retry an upload or save after its token refresh loses the session', async () => {
    const editor = await mountEditor()
    addNewImage(editor)
    handlers.set('POST /upload/image', (config) => {
      throw new AxiosError('expired', undefined, config, undefined, response(config, {}, 401))
    })
    const refresh = deferred<any>()
    handlers.set('POST /auth/refresh', () => refresh.promise)
    const pending = (editor.vm as any).submitForm()
    await flushPromises()
    const config = mocks.transport.mock.lastCall![0]
    expect(config.url).toBe('/auth/refresh')
    await switchAccount()
    refresh.resolve(response(config, { data: {
      token: { accessToken: 'late-token-A', refreshToken: 'late-refresh-A' },
    } }))
    await pending
    expect(requests.filter((request) => request.url === '/upload/image')).toHaveLength(1)
    expect(requests.filter((request) => request.method === 'PUT')).toEqual([])
    expect(auth.token).toBe('token-B')
    expectNoStaleCompletion()
  })
})
