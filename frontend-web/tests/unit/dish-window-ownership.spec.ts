import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  store: { updateDish: vi.fn() },
  canteens: { getCanteens: vi.fn(), getWindows: vi.fn() },
  dishes: { getDishById: vi.fn(), createDish: vi.fn(), updateDish: vi.fn() },
}))
vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
  useRoute: () => ({ params: { id: 'dish1' }, query: {}, path: '/edit-dish/dish1' }),
}))
vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => ({ hasPermission: () => true }),
}))
vi.mock('@/store/modules/use-dish-store', () => ({ useDishStore: () => mocks.store }))
vi.mock('@/api/modules/dish', () => ({ dishApi: mocks.dishes }))
vi.mock('@/api/modules/canteen', () => ({ canteenApi: mocks.canteens }))
vi.mock('@/composables/useModal', () => ({
  showAlert: vi.fn(), showConfirm: vi.fn().mockResolvedValue(true), showConfirmDanger: vi.fn(),
}))

import SingleAdd from '@/views/SingleAdd.vue'
import EditDish from '@/views/EditDish.vue'
import { resetDishComposition } from '@/composables/dish-composition'
import { invalidateAuthSession } from '@/utils/auth-session'

function deferred() {
  let resolve!: (value: any) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<any>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const windowsResponse = (id: string) => ({ code: 200, data: { items: [{ id, name: id }] } })

describe.each([['SingleAdd', SingleAdd], ['EditDish', EditDish]] as const)('%s window ownership', (_name, Component) => {
  let wrapper: VueWrapper<any> | undefined
  beforeEach(() => {
    vi.resetAllMocks()
    resetDishComposition()
    mocks.canteens.getCanteens.mockResolvedValue({ code: 200, data: { items: [
      { id: 'A', name: 'A canteen' }, { id: 'B', name: 'B canteen' },
    ] } })
    mocks.canteens.getWindows.mockResolvedValue(windowsResponse('A-window'))
    mocks.dishes.getDishById.mockResolvedValue({ code: 200, data: {
      id: 'dish1', name: 'Dish', price: 10, canteenId: 'A', canteenName: 'A canteen',
      windowId: 'A-window', windowName: 'A-window',
    } })
    mocks.dishes.createDish.mockResolvedValue({ code: 201, data: { id: 'created' } })
    mocks.dishes.updateDish.mockResolvedValue({ code: 200, data: { id: 'dish1' } })
  })
  afterEach(() => wrapper?.unmount())

  const mountForm = async () => {
    wrapper = shallowMount(Component, { global: { stubs: { Header: true }, directives: { permission: {} } } })
    await flushPromises()
    return wrapper.vm
  }

  it('clears previous choices immediately while the new canteen is loading', async () => {
    const vm = await mountForm()
    mocks.canteens.getWindows.mockReturnValueOnce(deferred().promise)
    vm.windows = windowsResponse('A-window').data.items
    vm.formData.canteenId = 'B'
    vm.formData.windowId = 'A-window'
    vm.onCanteenChange()
    expect(vm.windows).toEqual([])
    expect(vm.formData.windowId).toBe('')
  })

  it.each(['success', 'failure'])('ignores an older canteen request after its late %s', async outcome => {
    const vm = await mountForm()
    const old = deferred()
    mocks.canteens.getWindows.mockReturnValueOnce(old.promise).mockResolvedValueOnce(windowsResponse('B-window'))
    vm.formData.canteenId = 'A'
    vm.onCanteenChange()
    vm.formData.canteenId = 'B'
    vm.onCanteenChange()
    await flushPromises()
    if (outcome === 'success') old.resolve(windowsResponse('A-window'))
    else old.reject(new Error('Old request failed'))
    await flushPromises()
    expect(vm.windows).toEqual(windowsResponse('B-window').data.items)
    vm.formData.windowId = vm.windows[0].id
    vm.onWindowChange()
    vm.formData.name = 'Dish'
    vm.formData.price = 10
    await vm.submitForm(false)
    const write = _name === 'SingleAdd' ? mocks.dishes.createDish : mocks.dishes.updateDish
    expect(write).toHaveBeenCalled()
    const payload = write.mock.calls[0][_name === 'SingleAdd' ? 0 : 1]
    expect(payload).toMatchObject({ canteenId: 'B', windowId: 'B-window' })
  })

  it('rejects an old response even when the selected canteen returns to the same id', async () => {
    const vm = await mountForm()
    const old = deferred()
    mocks.canteens.getWindows.mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(windowsResponse('B-window'))
      .mockResolvedValueOnce(windowsResponse('A-new-window'))
    for (const id of ['A', 'B', 'A']) {
      vm.formData.canteenId = id
      vm.onCanteenChange()
    }
    await flushPromises()
    old.resolve(windowsResponse('A-old-window'))
    await flushPromises()
    expect(vm.windows).toEqual(windowsResponse('A-new-window').data.items)
  })

  it('does not refill options after the selection is cleared', async () => {
    const vm = await mountForm()
    const old = deferred()
    mocks.canteens.getWindows.mockReturnValueOnce(old.promise)
    vm.formData.canteenId = 'A'
    vm.onCanteenChange()
    vm.formData.canteenId = ''
    vm.onCanteenChange()
    old.resolve(windowsResponse('A-window'))
    await flushPromises()
    expect(vm.windows).toEqual([])
  })

  it('does not refill options after the auth session changes', async () => {
    const vm = await mountForm()
    const old = deferred()
    mocks.canteens.getWindows.mockReturnValueOnce(old.promise)
    vm.formData.canteenId = 'A'
    vm.onCanteenChange()
    vm.windows = []
    invalidateAuthSession()
    old.resolve(windowsResponse('A-window'))
    await flushPromises()
    expect(vm.windows).toEqual([])
  })

  it('does not refill options after the view is disposed', async () => {
    const vm = await mountForm()
    const old = deferred()
    mocks.canteens.getWindows.mockReturnValueOnce(old.promise)
    vm.formData.canteenId = 'A'
    vm.onCanteenChange()
    wrapper!.unmount()
    wrapper = undefined
    old.resolve(windowsResponse('A-window'))
    await flushPromises()
    expect(vm.windows).toEqual([])
  })

  if (_name === 'EditDish') {
    it('does not overwrite user edits when initial window metadata arrives late', async () => {
      const old = deferred()
      mocks.canteens.getWindows.mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(windowsResponse('B-window'))
      wrapper = shallowMount(Component, { global: { stubs: { Header: true }, directives: { permission: {} } } })
      await flushPromises()
      const vm = wrapper.vm
      expect(vm.formData.name).toBe('Dish')
      vm.formData.name = 'Edited while loading windows'
      vm.formData.canteenId = 'B'
      vm.onCanteenChange()
      await flushPromises()
      vm.formData.windowId = 'B-window'
      vm.onWindowChange()
      old.resolve(windowsResponse('A-window'))
      await flushPromises()
      expect(vm.formData).toMatchObject({
        name: 'Edited while loading windows', canteenId: 'B', windowId: 'B-window', windowName: 'B-window',
      })
    })
  }
})
