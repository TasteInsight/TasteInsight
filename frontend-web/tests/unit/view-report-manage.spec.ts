vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: mocks.showAlertMock, error: mocks.showAlertMock, info: mocks.showAlertMock }), notify: { success: mocks.showAlertMock, error: mocks.showAlertMock, info: mocks.showAlertMock } }))
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DOMWrapper, enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { Report } from '@/types/api'

const mocks = vi.hoisted(() => ({
  authStoreMock: {
    user: { scope: 'GLOBAL' as 'GLOBAL' | 'CANTEENS', canteenIds: [], canteens: [] },
    hasPermission: vi.fn(),
  },
  sessionVersion: 0,
  reviewApiMock: {
    getReports: vi.fn(),
    handleReport: vi.fn(),
  },
  showAlertMock: vi.fn(() => Promise.resolve()),
  showConfirmMock: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/api/modules/review', () => ({
  reviewApi: mocks.reviewApiMock,
}))

vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlertMock,
  showConfirm: mocks.showConfirmMock,
  showConfirmDanger: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('@/utils/auth-session', () => ({
  getAuthSessionVersion: () => mocks.sessionVersion,
}))

import ReportManage from '../../src/views/ReportManage.vue'

enableAutoUnmount(afterEach)

function flushMicrotasks() {
  return Promise.resolve()
}

function mountReportManage() {
  return mount(ReportManage, {
    global: { stubs: { Header: true, Pagination: true } },
  })
}

describe('views/ReportManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mocks.authStoreMock.user.scope = 'GLOBAL'
    mocks.authStoreMock.hasPermission.mockImplementation((permission: string) =>
      ['review:delete', 'comment:delete', 'post:delete', 'report:handle'].includes(permission),
    )
    mocks.sessionVersion = 0

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
        meta: { total: 42 },
      },
    })

    mocks.reviewApiMock.handleReport.mockResolvedValue({ code: 200 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads reports on mount and supports status/targetType filtering', async () => {
    const wrapper = mountReportManage()

    await flushMicrotasks()
    await nextTick()

    expect(mocks.reviewApiMock.getReports).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    expect(wrapper.vm.reports).toHaveLength(2)
    expect(wrapper.vm.totalReports).toBe(42)

    // status filter affects API params
    wrapper.vm.statusFilter = 'pending'
    wrapper.vm.handleFilterChange()
    await flushMicrotasks()
    await nextTick()

    expect(mocks.reviewApiMock.getReports).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, status: 'pending' })

    mocks.reviewApiMock.getReports.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [wrapper.vm.reports[0]],
        meta: { total: 21 },
      },
    })

    // targetType filter is passed to the server and preserves the server total
    wrapper.vm.targetTypeFilter = 'review'
    wrapper.vm.handleFilterChange()
    await flushMicrotasks()
    await nextTick()

    expect(mocks.reviewApiMock.getReports).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      status: 'pending',
      targetType: 'review',
    })
    expect(wrapper.vm.reports.every((r: any) => r.targetType === 'review')).toBe(true)
    expect(wrapper.vm.totalReports).toBe(21)

    wrapper.unmount()
  })

  it('loadReports handles non-200 and thrown errors', async () => {
    mocks.reviewApiMock.getReports.mockResolvedValueOnce({ code: 500, message: 'bad' })

    const wrapper = mountReportManage()

    await flushMicrotasks()
    await nextTick()

    expect(wrapper.vm.reports).toEqual([])
    expect(wrapper.vm.totalReports).toBe(0)

    mocks.reviewApiMock.getReports.mockRejectedValueOnce(new Error('boom'))
    wrapper.vm.handlePageChange(2)
    await flushMicrotasks()
    await nextTick()

    expect(mocks.showAlertMock).toHaveBeenCalledWith('加载举报列表失败，请刷新重试')
    expect(wrapper.vm.reports).toEqual([])
    expect(wrapper.vm.totalReports).toBe(0)

    wrapper.unmount()
  })

  it('handlePageChange updates page and reloads', async () => {
    const wrapper = mountReportManage()

    await flushMicrotasks()
    await nextTick()

    wrapper.vm.handlePageChange(3)
    await flushMicrotasks()
    await nextTick()

    expect(wrapper.vm.currentPage).toBe(3)
    expect(mocks.reviewApiMock.getReports).toHaveBeenLastCalledWith({ page: 3, pageSize: 20 })

    wrapper.unmount()
  })

  it('deleting reviews covers permission/confirm/success/non-200/catch and updates selectedReport', async () => {
    const wrapper = mountReportManage()

    await flushMicrotasks()
    await nextTick()

    const report = wrapper.vm.reports[0]

    // permission denied
    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleReport(report, 'delete_content')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限处理举报')

    // confirm cancel
    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    mocks.showConfirmMock.mockResolvedValueOnce(false)
    await wrapper.vm.handleReport(report, 'delete_content')
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

    mocks.showConfirmMock.mockResolvedValueOnce(true)
    mocks.reviewApiMock.handleReport.mockResolvedValueOnce({ code: 200 })
    await wrapper.vm.handleReport(report, 'delete_content')

    expect(mocks.reviewApiMock.handleReport).toHaveBeenLastCalledWith('r1', { action: 'delete_content' })
    expect(mocks.showAlertMock).toHaveBeenCalledWith('删除成功')
    expect(wrapper.vm.selectedReport?.id).toBe('r1')
    expect(wrapper.vm.selectedReport?.targetContent?.isDeleted).toBe(true)

    // non-200
    mocks.reviewApiMock.handleReport.mockResolvedValueOnce({ code: 400, message: 'nope' })
    await wrapper.vm.handleReport(report, 'delete_content')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('nope')

    // catch
    mocks.reviewApiMock.handleReport.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleReport(report, 'delete_content')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('删除评价失败，请重试')

    wrapper.unmount()
  })

  it('deleting comments covers permission/confirm and catch', async () => {
    const wrapper = mountReportManage()

    await flushMicrotasks()
    await nextTick()

    const source = wrapper.vm.reports.find(r => r.targetType === 'comment')
    if (!source) throw new Error('Expected the comment report fixture')
    const report = { ...source, status: 'pending' as const }

    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleReport(report, 'delete_content')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限处理举报')

    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    mocks.showConfirmMock.mockResolvedValueOnce(false)
    await wrapper.vm.handleReport(report, 'delete_content')
    expect(mocks.reviewApiMock.handleReport).toHaveBeenCalledTimes(0)

    mocks.reviewApiMock.handleReport.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleReport(report, 'delete_content')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('删除评论失败，请重试')

    wrapper.unmount()
  })

  it('handleReport handles permission/confirm/success/non-200/catch and sets default result', async () => {
    const wrapper = mountReportManage()

    await flushMicrotasks()
    await nextTick()

    const report = wrapper.vm.reports[0]

    mocks.authStoreMock.hasPermission.mockReturnValueOnce(false)
    await wrapper.vm.handleReport(report, 'reject_report')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('您没有权限处理举报')

    mocks.authStoreMock.hasPermission.mockReturnValue(true)
    mocks.showConfirmMock.mockResolvedValueOnce(false)
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
    mocks.showConfirmMock.mockResolvedValueOnce(true)

    await wrapper.vm.handleReport(report, 'reject_report')

    expect(mocks.reviewApiMock.handleReport).toHaveBeenLastCalledWith('r1', {
      action: 'reject_report',
      result: '举报被拒绝',
    })
    expect(mocks.showAlertMock).toHaveBeenCalledWith('处理成功')
    expect(wrapper.vm.selectedReport?.status).toBe('rejected')

    // non-200
    mocks.reviewApiMock.handleReport.mockResolvedValueOnce({ code: 400, message: 'bad' })
    await wrapper.vm.handleReport(report, 'reject_report')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('bad')

    // catch
    mocks.reviewApiMock.handleReport.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.handleReport(report, 'reject_report')
    expect(mocks.showAlertMock).toHaveBeenCalledWith('处理举报失败，请重试')

    wrapper.unmount()
  })

  it('image preview open/close, navigation, and keyboard shortcuts', async () => {
    const wrapper = mountReportManage()

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
    await nextTick()
    const preview = new DOMWrapper(document.body).get('dialog[aria-label="图片预览"]')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(wrapper.vm.imagePreview.currentIndex).toBe(0)

    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })
    preview.element.dispatchEvent(right)
    await nextTick()
    expect(right.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.currentIndex).toBe(1)

    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true })
    preview.element.dispatchEvent(left)
    await nextTick()
    expect(left.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.currentIndex).toBe(0)

    const esc = new Event('cancel', { cancelable: true })
    preview.element.dispatchEvent(esc)
    await nextTick()
    expect(esc.defaultPrevented).toBe(true)
    expect(wrapper.vm.imagePreview.show).toBe(false)

    wrapper.unmount()
  })

  const targetCases = [
    ['review', '评价', 'review:delete', ['https://images.test/review.png']],
    ['comment', '评论', 'comment:delete', undefined],
    ['post', '帖子', 'post:delete', ['https://images.test/post.png']],
    ['postComment', '帖子评论', 'post:delete', undefined],
  ] as const

  function makeReport(targetType: Report['targetType'], images?: readonly string[]): Report {
    return {
      id: `report-${targetType}`,
      reporterId: 'reporter',
      targetType,
      targetId: `content-${targetType}`,
      type: 'spam',
      reason: '广告内容',
      status: 'pending',
      handleResult: null,
      handledBy: null,
      handledAt: null,
      createdAt: '2026-10-09T10:00:00Z',
      reporter: { id: 'reporter', nickname: '举报人', avatar: null },
      targetContent: {
        content: '被举报内容',
        userId: 'author',
        userNickname: '作者',
        userAvatar: null,
        isDeleted: false,
        ...(images ? { images: [...images] } : {}),
      },
    }
  }

  it.each(targetCases)('renders and filters %s with its correct label and images', async (targetType, label, _permission, images) => {
    const report = makeReport(targetType, images)
    mocks.reviewApiMock.getReports.mockResolvedValue({ code: 200, data: { items: [report], meta: { total: 1 } } })
    const wrapper = mountReportManage()
    await flushPromises()

    expect(wrapper.get(`option[value="${targetType}"]`).text()).toBe(label)
    expect(wrapper.get('tbody tr').text()).toContain(label)
    await wrapper.findAll('select')[1].setValue(targetType)
    await flushPromises()
    expect(mocks.reviewApiMock.getReports).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, targetType })
    await wrapper.get('tbody button').trigger('click')
    const detail = new DOMWrapper(document.body).get('dialog[aria-labelledby="report-detail-title"]')
    expect(detail.text()).toContain(`删除${label}`)

    if (images) {
      expect(wrapper.get('tbody tr').text()).toContain('1 张')
      const thumbnail = detail.get(`button[aria-label="预览${label}图片 1"]`)
      await thumbnail.get('img').trigger('load')
      await thumbnail.trigger('click')
      const preview = new DOMWrapper(document.body).get('dialog[aria-label="图片预览"]')
      expect(preview.get('img').attributes('src')).toBe(images[0])
      expect(preview.get('img').attributes('alt')).toBe(`${label}图片 1`)
      await preview.trigger('cancel')
      expect(wrapper.vm.imagePreview.show).toBe(false)
      expect(wrapper.vm.selectedReport?.id).toBe(report.id)
      expect(detail.attributes('open')).toBeDefined()
    } else {
      expect(detail.find('button[aria-label^="预览"]').exists()).toBe(false)
    }
    wrapper.unmount()
  })

  it.each(targetCases)('handles %s deletion with its content permission and the report endpoint', async (targetType, label, permission, images) => {
    const report = makeReport(targetType, images)
    mocks.authStoreMock.hasPermission.mockImplementation((value: string) => ['report:handle', permission].includes(value))
    const wrapper = mountReportManage()
    await flushPromises()
    wrapper.vm.openDetailDialog(report)
    await nextTick()
    const button = new DOMWrapper(document.body).get('dialog[aria-labelledby="report-detail-title"]').findAll('button').find(item => item.text() === `删除${label}`)!
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(mocks.showConfirmMock).toHaveBeenCalledWith(`确定要删除这个${label}吗？此操作不可恢复。`, '确认删除')
    expect(mocks.reviewApiMock.handleReport).toHaveBeenCalledExactlyOnceWith(report.id, { action: 'delete_content' })
    wrapper.unmount()
  })

  it.each(targetCases)('does not delete %s without its own content permission, while rejection stays available', async (targetType, label, permission, images) => {
    const report = makeReport(targetType, images)
    mocks.authStoreMock.hasPermission.mockImplementation((value: string) => value !== permission)
    const wrapper = mountReportManage()
    await flushPromises()
    wrapper.vm.openDetailDialog(report)
    await nextTick()
    const button = new DOMWrapper(document.body).get('dialog[aria-labelledby="report-detail-title"]').findAll('button').find(item => item.text() === `删除${label}`)!
    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.vm.handleReport(report, 'delete_content')
    expect(mocks.showAlertMock).toHaveBeenCalledWith(`您没有权限删除${label}`)
    expect(mocks.reviewApiMock.handleReport).not.toHaveBeenCalled()
    await wrapper.vm.handleReport(report, 'reject_report')
    expect(mocks.reviewApiMock.handleReport).toHaveBeenCalledExactlyOnceWith(report.id, { action: 'reject_report', result: '举报被拒绝' })
    wrapper.unmount()
  })

  it('does not expose or process community reports for a canteen-scoped admin', async () => {
    mocks.authStoreMock.user.scope = 'CANTEENS'
    const wrapper = mountReportManage()
    await flushPromises()
    expect(wrapper.find('option[value="review"]').exists()).toBe(true)
    expect(wrapper.find('option[value="comment"]').exists()).toBe(true)
    expect(wrapper.find('option[value="post"]').exists()).toBe(false)
    expect(wrapper.find('option[value="postComment"]').exists()).toBe(false)
    for (const targetType of ['post', 'postComment'] as const) {
      await wrapper.vm.handleReport(makeReport(targetType), 'delete_content')
      await wrapper.vm.handleReport(makeReport(targetType), 'reject_report')
    }
    expect(mocks.reviewApiMock.handleReport).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['permission', 'session'] as const)('rechecks %s after confirmation and blocks duplicate submissions', async reason => {
    let confirm!: (value: boolean) => void
    mocks.showConfirmMock.mockReturnValueOnce(new Promise<boolean>(resolve => { confirm = resolve }))
    const wrapper = mountReportManage()
    await flushPromises()
    const report = makeReport('post')
    const pending = wrapper.vm.handleReport(report, 'delete_content')
    await wrapper.vm.handleReport(report, 'delete_content')
    expect(mocks.showConfirmMock).toHaveBeenCalledTimes(1)
    if (reason === 'permission') mocks.authStoreMock.hasPermission.mockReturnValue(false)
    else mocks.sessionVersion++
    confirm(true)
    await pending
    expect(mocks.reviewApiMock.handleReport).not.toHaveBeenCalled()
    expect(wrapper.vm.isHandling).toBe(false)
    wrapper.unmount()
  })

  it('does not submit already handled or deleted targets', async () => {
    const wrapper = mountReportManage()
    await flushPromises()
    const handled = makeReport('post')
    handled.status = 'approved'
    await wrapper.vm.handleReport(handled, 'delete_content')
    const deleted = makeReport('postComment')
    deleted.targetContent!.isDeleted = true
    await wrapper.vm.handleReport(deleted, 'delete_content')
    expect(mocks.reviewApiMock.handleReport).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
