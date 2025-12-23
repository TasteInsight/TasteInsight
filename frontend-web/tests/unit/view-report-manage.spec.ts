import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  authStoreMock: {
    hasPermission: vi.fn((p: string) => ['review:delete', 'report:handle'].includes(p)),
  },
  reviewApiMock: {
    getReports: vi.fn(),
    handleReport: vi.fn(),
  },
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/api/modules/review', () => ({
  reviewApi: mocks.reviewApiMock,
}))

import ReportManage from '../../src/views/ReportManage.vue'

function flushMicrotasks() {
  return Promise.resolve()
}

describe('views/ReportManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.reviewApiMock.getReports.mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            id: 'r1',
            status: 'pending',
            targetType: 'review',
            createdAt: '2025-01-01T10:00:00',
            reporterNickname: 'u1',
            targetContent: {
              content: 'bad',
              images: ['http://img/1.png', 'http://img/2.png'],
              userNickname: 't1',
              isDeleted: false,
            },
          },
          {
            id: 'r2',
            status: 'approved',
            targetType: 'comment',
            createdAt: '2025-01-02T10:00:00',
            reporterNickname: 'u2',
            targetContent: { content: 'spam', isDeleted: false, userNickname: 't2' },
          },
        ],
      },
    })

    mocks.reviewApiMock.handleReport.mockResolvedValue({ code: 200 })

    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
  })

  it('loads reports on mount and supports status/targetType filtering', async () => {
    const wrapper = shallowMount(ReportManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    expect(mocks.reviewApiMock.getReports).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    expect(wrapper.vm.reports).toHaveLength(2)
    expect(wrapper.vm.totalReports).toBe(2)

    // status filter affects API params
    wrapper.vm.statusFilter = 'pending'
    wrapper.vm.handleFilterChange()
    await flushMicrotasks()
    await nextTick()

    expect(mocks.reviewApiMock.getReports).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, status: 'pending' })

    // targetType filter is client-side
    wrapper.vm.targetTypeFilter = 'review'
    wrapper.vm.handleFilterChange()
    await flushMicrotasks()
    await nextTick()

    expect(wrapper.vm.reports.every((r: any) => r.targetType === 'review')).toBe(true)
    expect(wrapper.vm.totalReports).toBe(1)

    wrapper.unmount()
  })

  it('loadReports handles non-200 and thrown errors', async () => {
    mocks.reviewApiMock.getReports.mockResolvedValueOnce({ code: 500, message: 'bad' })

    const wrapper = shallowMount(ReportManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    expect(wrapper.vm.reports).toEqual([])
    expect(wrapper.vm.totalReports).toBe(0)

    mocks.reviewApiMock.getReports.mockRejectedValueOnce(new Error('boom'))
    wrapper.vm.handlePageChange(2)
    await flushMicrotasks()
    await nextTick()

    expect(window.alert).toHaveBeenCalledWith('加载举报列表失败，请刷新重试')
    expect(wrapper.vm.reports).toEqual([])
    expect(wrapper.vm.totalReports).toBe(0)

    wrapper.unmount()
  })

  it('handlePageChange updates page and reloads', async () => {
    const wrapper = shallowMount(ReportManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    wrapper.vm.handlePageChange(3)
    await flushMicrotasks()
    await nextTick()

    expect(wrapper.vm.currentPage).toBe(3)
    expect(mocks.reviewApiMock.getReports).toHaveBeenLastCalledWith({ page: 3, pageSize: 20 })

    wrapper.unmount()
  })

  it('handleDeleteReview covers permission/confirm/success/non-200/catch and updates selectedReport', async () => {
    const wrapper = shallowMount(ReportManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    const report = wrapper.vm.reports[0]

    // permission denied
    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleDeleteReview(report)
    expect(window.alert).toHaveBeenCalledWith('您没有权限删除评价')

    // confirm cancel
    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.handleDeleteReview(report)
    expect(mocks.reviewApiMock.handleReport).toHaveBeenCalledTimes(0)

    // success: reload and update selectedReport from refreshed list
    wrapper.vm.openDetailDialog(report)

    mocks.reviewApiMock.getReports.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [
          {
            ...report,
            targetContent: { ...report.targetContent, isDeleted: true },
          },
        ],
      },
    })

    ;(window.confirm as any).mockReturnValueOnce(true)
    mocks.reviewApiMock.handleReport.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.handleDeleteReview(report)

    expect(mocks.reviewApiMock.handleReport).toHaveBeenLastCalledWith('r1', { action: 'delete_content' })
    expect(window.alert).toHaveBeenCalledWith('删除成功')
    expect(wrapper.vm.selectedReport?.id).toBe('r1')
    expect(wrapper.vm.selectedReport?.targetContent?.isDeleted).toBe(true)

    // non-200
    mocks.reviewApiMock.handleReport.mockResolvedValueOnce({ code: 400, message: 'nope' })
    await wrapper.vm.handleDeleteReview(report)
    expect(window.alert).toHaveBeenCalledWith('nope')

    // catch
    mocks.reviewApiMock.handleReport.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleDeleteReview(report)
    expect(window.alert).toHaveBeenCalledWith('删除评价失败，请重试')

    wrapper.unmount()
  })

  it('handleDeleteComment covers permission/confirm and catch', async () => {
    const wrapper = shallowMount(ReportManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    const report = wrapper.vm.reports.find((r: any) => r.targetType === 'comment')

    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleDeleteComment(report)
    expect(window.alert).toHaveBeenCalledWith('您没有权限删除评论')

    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.handleDeleteComment(report)
    expect(mocks.reviewApiMock.handleReport).toHaveBeenCalledTimes(0)

    mocks.reviewApiMock.handleReport.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleDeleteComment(report)
    expect(window.alert).toHaveBeenCalledWith('删除评论失败，请重试')

    wrapper.unmount()
  })

  it('handleReport handles permission/confirm/success/non-200/catch and sets default result', async () => {
    const wrapper = shallowMount(ReportManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    const report = wrapper.vm.reports[0]

    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleReport(report, 'reject_report')
    expect(window.alert).toHaveBeenCalledWith('您没有权限处理举报')

    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    ;(window.confirm as any).mockReturnValueOnce(false)
    await wrapper.vm.handleReport(report, 'reject_report')
    expect(mocks.reviewApiMock.handleReport).toHaveBeenCalledTimes(0)

    // success updates selectedReport when opened
    wrapper.vm.openDetailDialog(report)
    mocks.reviewApiMock.getReports.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [{ ...report, status: 'rejected', handleResult: '举报被拒绝' }],
      },
    })
    mocks.reviewApiMock.handleReport.mockResolvedValueOnce({ code: 200 })
    ;(window.confirm as any).mockReturnValueOnce(true)

    await wrapper.vm.handleReport(report, 'reject_report')

    expect(mocks.reviewApiMock.handleReport).toHaveBeenLastCalledWith('r1', {
      action: 'reject_report',
      result: '举报被拒绝',
    })
    expect(window.alert).toHaveBeenCalledWith('处理成功')
    expect(wrapper.vm.selectedReport?.status).toBe('rejected')

    // non-200
    mocks.reviewApiMock.handleReport.mockResolvedValueOnce({ code: 400, message: 'bad' })
    await wrapper.vm.handleReport(report, 'reject_report')
    expect(window.alert).toHaveBeenCalledWith('bad')

    // catch
    mocks.reviewApiMock.handleReport.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleReport(report, 'reject_report')
    expect(window.alert).toHaveBeenCalledWith('处理举报失败，请重试')

    wrapper.unmount()
  })

  it('image preview open/close, navigation, and keyboard shortcuts', async () => {
    const wrapper = shallowMount(ReportManage, {
      global: { stubs: { Header: true, Pagination: true } },
    })

    await flushMicrotasks()
    await nextTick()

    wrapper.vm.openImagePreview(['a', 'b', 'c'], 1)
    expect(wrapper.vm.imagePreview.show).toBe(true)
    expect(wrapper.vm.imagePreview.currentIndex).toBe(1)

    wrapper.vm.previousImage()
    expect(wrapper.vm.imagePreview.currentIndex).toBe(0)

    wrapper.vm.previousImage() // stays at 0
    expect(wrapper.vm.imagePreview.currentIndex).toBe(0)

    wrapper.vm.nextImage()
    wrapper.vm.nextImage()
    expect(wrapper.vm.imagePreview.currentIndex).toBe(2)

    wrapper.vm.nextImage() // stays at last
    expect(wrapper.vm.imagePreview.currentIndex).toBe(2)

    // keyboard: left/right/escape
    wrapper.vm.openImagePreview(['a', 'b'], 0)

    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })
    window.dispatchEvent(right)
    await nextTick()
    expect(right.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.currentIndex).toBe(1)

    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true })
    window.dispatchEvent(left)
    await nextTick()
    expect(left.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.currentIndex).toBe(0)

    const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    window.dispatchEvent(esc)
    await nextTick()
    expect(esc.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.show).toBe(false)

    wrapper.unmount()
  })
})
