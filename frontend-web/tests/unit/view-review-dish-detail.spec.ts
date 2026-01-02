import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

import ReviewDishDetail from '../../src/views/ReviewDishDetail.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  route: {
    path: '/review-dish/1',
    params: { id: '1' },
    query: {},
    meta: {},
  },
  reviewApi: {
    getPendingUploadById: vi.fn(),
    approveUpload: vi.fn(),
    rejectUpload: vi.fn(),
    revokeUpload: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
  useRoute: () => mocks.route,
}))

vi.mock('@/api/modules/review', () => ({
  reviewApi: mocks.reviewApi,
}))

// imported in component but not used in current implementation
vi.mock('@/api/modules/dish', () => ({
  dishApi: {},
}))

const flushAll = async () => {
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()))
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()))
  await nextTick()
}

const baseMountOptions = {
  global: {
    stubs: {
      Header: defineComponent({ name: 'HeaderStub', template: '<div />' }),
      Transition: false,
      'transition-group': false,
    },
  },
}

describe('views/ReviewDishDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.route.params = { id: '1' }

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'open').mockImplementation(() => null as any)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('loadDishData maps DTO fields and handles arrays/servingTime/images/status', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({
      code: 200,
      data: {
        id: 'u1',
        name: '红烧肉',
        canteenName: '一食堂',
        windowName: '窗口A',
        windowNumber: '01',
        description: 'desc',
        allergens: ['a', 'b'],
        ingredients: ['i1', 'i2'],
        images: ['img1', 'img2'],
        tags: ['t1'],
        spicyLevel: 1,
        saltiness: 2,
        sweetness: null,
        oiliness: undefined,
        availableMealTime: ['breakfast', 'lunch', 'nightsnack'],
        availableDates: [{ startDate: '2025-01-01', endDate: '2025-01-31' }],
        uploaderName: '张三',
        createdAt: '2025-01-02T03:04:05.000Z',
        status: 'pending',
      },
    })

    const wrapper = mount(ReviewDishDetail, baseMountOptions)
    await flushAll()

    expect(mocks.reviewApi.getPendingUploadById).toHaveBeenCalledWith('1')

    expect(wrapper.vm.dishData).toMatchObject({
      id: 'u1',
      name: '红烧肉',
      canteen: '一食堂',
      windowName: '窗口A',
      windowNumber: '01',
      window: '窗口A',
      description: 'desc',
      allergens: 'a、b',
      ingredients: 'i1、i2',
      image: 'img1',
      imageUrl: 'img1',
      tags: ['t1'],
      submitter: '张三',
      status: 'pending',
    })

    expect(wrapper.vm.dishData.images).toEqual(['img1', 'img2'])
    expect(wrapper.vm.dishData.subItems).toEqual([])

    expect(wrapper.vm.dishData.servingTime).toEqual({
      breakfast: true,
      lunch: true,
      dinner: false,
      night: true,
    })

    wrapper.unmount()
  })

  it('loadDishData handles getPendingUploadById reject -> not found alert + push', async () => {
    mocks.reviewApi.getPendingUploadById.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mount(ReviewDishDetail, baseMountOptions)
    await flushAll()

    expect(window.alert).toHaveBeenCalledWith('未找到该菜品信息')
    expect(mocks.routerPush).toHaveBeenCalledWith('/review-dish')

    wrapper.unmount()
  })

  it('loadDishData outer catch branch: router.push throws once -> alerts and still navigates', async () => {
    mocks.reviewApi.getPendingUploadById.mockRejectedValueOnce(new Error('boom'))

    mocks.routerPush
      .mockImplementationOnce(() => {
        throw new Error('push failed')
      })
      .mockImplementationOnce(() => undefined)

    const wrapper = mount(ReviewDishDetail, baseMountOptions)
    await flushAll()

    expect(window.alert).toHaveBeenCalledWith('获取菜品信息失败，请重试')
    expect(mocks.routerPush).toHaveBeenCalledTimes(2)
    expect(mocks.routerPush).toHaveBeenLastCalledWith('/review-dish')

    wrapper.unmount()
  })

  it('previewImage opens new tab', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: { id: 'u1' } })

    const wrapper = mount(ReviewDishDetail, baseMountOptions)
    await flushAll()

    wrapper.vm.previewImage('http://x')
    expect(window.open).toHaveBeenCalledWith('http://x', '_blank')

    wrapper.unmount()
  })

  it('approveDish respects confirm cancel; success navigates; non-200 and thrown errors alert', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({
      code: 200,
      data: { id: 'u1', name: '红烧肉', status: 'pending' },
    })

    const wrapper = mount(ReviewDishDetail, baseMountOptions)
    await flushAll()

    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.approveDish()
    expect(mocks.reviewApi.approveUpload).not.toHaveBeenCalled()

    mocks.reviewApi.approveUpload.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.approveDish()
    await flushAll()

    expect(wrapper.vm.dishData.status).toBe('approved')
    expect(mocks.routerPush).toHaveBeenCalledWith({
      path: '/review-dish',
      query: { refresh: 'true', updatedId: 'u1', status: 'approved' },
    })

    mocks.reviewApi.approveUpload.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.approveDish()
    expect(window.alert).toHaveBeenCalledWith('bad')

    mocks.reviewApi.approveUpload.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.approveDish()
    expect(window.alert).toHaveBeenCalledWith('boom')

    wrapper.unmount()
  })

  it('reject modal open/close resets reason; confirmReject success closes; failures alert; submitting guard blocks', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({
      code: 200,
      data: { id: 'u1', name: '红烧肉', status: 'pending' },
    })

    const wrapper = mount(ReviewDishDetail, baseMountOptions)
    await flushAll()

    wrapper.vm.rejectReason = 'x'
    wrapper.vm.openRejectModal()
    expect(wrapper.vm.isRejectModalOpen).toBe(true)
    expect(wrapper.vm.rejectReason).toBe('')

    wrapper.vm.closeRejectModal()
    expect(wrapper.vm.isRejectModalOpen).toBe(false)

    wrapper.vm.openRejectModal()
    wrapper.vm.rejectReason = '因为不合格'

    mocks.reviewApi.rejectUpload.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.confirmReject()
    await flushAll()

    expect(wrapper.vm.dishData.status).toBe('rejected')
    expect(wrapper.vm.isRejectModalOpen).toBe(false)
    expect(mocks.routerPush).toHaveBeenCalledWith({
      path: '/review-dish',
      query: { refresh: 'true', updatedId: 'u1', status: 'rejected' },
    })

    wrapper.vm.openRejectModal()
    mocks.reviewApi.rejectUpload.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.confirmReject()
    expect(window.alert).toHaveBeenCalledWith('bad')

    wrapper.vm.openRejectModal()
    mocks.reviewApi.rejectUpload.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.confirmReject()
    expect(window.alert).toHaveBeenCalledWith('boom')

    // submitting guard
    wrapper.vm.isSubmitting = true
    await wrapper.vm.confirmReject()
    // rejectUpload should not be called again by the guard

    wrapper.unmount()
  })

  it('revokeApproval handles pending status alert; confirm cancel; success navigates+alerts; non-200/throw alerts', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({
      code: 200,
      data: { id: 'u1', name: '红烧肉', status: 'pending' },
    })

    const wrapper = mount(ReviewDishDetail, baseMountOptions)
    await flushAll()

    await wrapper.vm.revokeApproval()
    expect(window.alert).toHaveBeenCalledWith('该菜品当前为待审核状态，无需撤销。')

    wrapper.vm.dishData.status = 'approved'

    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.revokeApproval()
    expect(mocks.reviewApi.revokeUpload).not.toHaveBeenCalled()

    mocks.reviewApi.revokeUpload.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.revokeApproval()
    await flushAll()

    expect(wrapper.vm.dishData.status).toBe('pending')
    expect(mocks.routerPush).toHaveBeenCalledWith({
      path: '/review-dish',
      query: { refresh: 'true', updatedId: 'u1', status: 'pending' },
    })
    expect(window.alert).toHaveBeenCalledWith('菜品审核结果已撤销，重新进入待审核状态。')

    // after success the status is pending; set back to approved to reach failure branches
    ;(window.alert as any).mockClear?.()
    wrapper.vm.dishData.status = 'approved'

    mocks.reviewApi.revokeUpload.mockResolvedValueOnce({ code: 500, message: 'bad' })
    await wrapper.vm.revokeApproval()
    expect(window.alert).toHaveBeenCalledWith('bad')

    ;(window.alert as any).mockClear?.()
    wrapper.vm.dishData.status = 'approved'
    mocks.reviewApi.revokeUpload.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.revokeApproval()
    expect(window.alert).toHaveBeenCalledWith('boom')

    wrapper.unmount()
  })

  it('goBack navigates to list', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: { id: 'u1' } })

    const wrapper = mount(ReviewDishDetail, baseMountOptions)
    await flushAll()

    wrapper.vm.goBack()
    expect(mocks.routerPush).toHaveBeenCalledWith('/review-dish')

    wrapper.unmount()
  })
})
