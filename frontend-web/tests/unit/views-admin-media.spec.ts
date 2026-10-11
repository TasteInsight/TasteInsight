import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  dishApi: { getDishById: vi.fn(), getDishReviews: vi.fn() },
  reviewApi: { getPendingUploadById: vi.fn() },
  canteenApi: { getCanteens: vi.fn(), getWindows: vi.fn() },
  router: { push: vi.fn(), replace: vi.fn() },
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'dish-1' }, query: {}, path: '/view-dish/dish-1' }),
  useRouter: () => mocks.router,
}))
vi.mock('@/api/modules/dish', () => ({ dishApi: mocks.dishApi }))
vi.mock('@/api/modules/review', () => ({ reviewApi: mocks.reviewApi }))
vi.mock('@/api/modules/canteen', () => ({ canteenApi: mocks.canteenApi }))
vi.mock('@/store/modules/use-auth-store', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('@/store/modules/use-dish-store', () => ({ useDishStore: () => ({ updateDish: vi.fn() }) }))
vi.mock('@/composables/useModal', () => ({ showAlert: vi.fn(), showConfirm: vi.fn() }))

import AdminImage from '../../src/components/Common/AdminImage.vue'
import EditDish from '../../src/views/EditDish.vue'
import ViewDishDetail from '../../src/views/ViewDishDetail.vue'
import ReviewDishDetail from '../../src/views/ReviewDishDetail.vue'

enableAutoUnmount(afterEach)

const options = {
  global: { stubs: { Header: true }, directives: { permission: () => undefined } },
}

describe('admin media consumers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const dish = { id: 'dish-1', name: '清炒时蔬', images: ['/first.jpg', '/second.jpg'], status: 'pending' }
    mocks.dishApi.getDishById.mockResolvedValue({ code: 200, data: dish })
    mocks.reviewApi.getPendingUploadById.mockResolvedValue({ code: 200, data: dish })
    mocks.dishApi.getDishReviews.mockResolvedValue({
      code: 200,
      data: { items: [], meta: { page: 1, totalPages: 0 }, rating: { average: 0, total: 0, detail: {} } },
    })
    mocks.canteenApi.getCanteens.mockResolvedValue({ code: 200, data: { items: [] } })
    mocks.canteenApi.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
    vi.spyOn(window, 'open').mockReturnValue(null)
  })

  it.each([ViewDishDetail, ReviewDishDetail])('%s collapses failed detail media and retries before previewing', async (view) => {
    const wrapper = mount(view, options)
    await flushPromises()
    const mainImage = wrapper.findAllComponents(AdminImage).find((image) => image.props('alt') === '菜品图片')!

    await mainImage.get('img').trigger('error')

    expect(mainImage.text()).toContain('图片加载失败')
    expect(mainImage.element.closest('.aspect-square, .h-48')).toBeNull()
    expect(mainImage.find('button[aria-label="预览菜品图片"]').exists()).toBe(false)
    expect(window.open).not.toHaveBeenCalled()

    await mainImage.get('button').trigger('click')
    expect(window.open).not.toHaveBeenCalled()
    await mainImage.get('img').trigger('load')
    await mainImage.get('button').trigger('click')
    expect(window.open).toHaveBeenCalledWith('/first.jpg', '_blank')
  })

  it.each([ViewDishDetail, ReviewDishDetail])('%s renders missing detail media without a large empty frame', async (view) => {
    mocks.dishApi.getDishById.mockResolvedValue({ code: 200, data: { id: 'dish-1', images: [] } })
    mocks.reviewApi.getPendingUploadById.mockResolvedValue({ code: 200, data: { id: 'dish-1', images: [] } })
    const wrapper = mount(view, options)
    await flushPromises()
    const mainImage = wrapper.findComponent(AdminImage)

    expect(mainImage.text()).toBe('暂无图片')
    expect(mainImage.find('button').exists()).toBe(false)
    expect(mainImage.element.closest('.aspect-square, .h-48')).toBeNull()
  })

  it('keeps upload files, cover selection and image removal intact after an edit preview fails', async () => {
    const wrapper = mount(EditDish, options)
    await flushPromises()
    const file = new File(['image data'], 'new-cover.png', { type: 'image/png' })
    const draft = { id: 'new-image', url: 'data:image/png;base64,eA==', file, isNew: true }
    wrapper.vm.formData.imageFiles.push(draft)
    await nextTick()
    const cover = wrapper.findAllComponents(AdminImage).find((image) => image.props('alt') === '封面图')!

    await cover.get('img').trigger('error')

    expect(cover.text()).toContain('图片加载失败')
    expect(cover.element.closest('[class~="h-[300px]"]')).toBeNull()
    expect(wrapper.vm.formData.imageFiles.map((image: { url: string }) => image.url)).toEqual([
      '/first.jpg', '/second.jpg', draft.url,
    ])
    expect(wrapper.get('input[type="file"]').attributes('multiple')).toBeDefined()
    await wrapper.findAll('button[title="设为封面"]')[1].trigger('click')
    expect(wrapper.vm.formData.imageFiles[0].file).toBe(file)
    expect(cover.get('img').attributes('src')).toBe(draft.url)

    await wrapper.findAll('button[title="删除图片"]')[0].trigger('click')
    expect(wrapper.vm.formData.imageFiles.map((image: { url: string }) => image.url)).toEqual(['/first.jpg', '/second.jpg'])
    expect(cover.get('img').attributes('src')).toBe('/first.jpg')
  })
})
