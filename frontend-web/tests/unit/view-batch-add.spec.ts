import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'

import BatchAdd from '@/views/BatchAdd.vue'

const mocks = vi.hoisted(() => ({
  dishApiMock: {
    parseBatchExcel: vi.fn(),
    confirmBatchImport: vi.fn(),
  },
}))

vi.mock('@/api/modules/dish', () => ({
  dishApi: mocks.dishApiMock,
}))

function makeFile(name: string, size = 1000, type = '') {
  const file = new File(['x'.repeat(Math.min(size, 10))], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('views/BatchAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockImplementation(() => true)
  })

  afterEach(() => {
    ;(window.alert as any).mockRestore?.()
    ;(window.confirm as any).mockRestore?.()
    vi.useRealTimers()
  })

  it('downloadTemplate alerts (placeholder)', async () => {
    const wrapper = shallowMount(BatchAdd, {
      global: { stubs: { Header: true } },
    })

    wrapper.vm.downloadTemplate()
    expect(window.alert).toHaveBeenCalledWith('模板下载功能开发中...')

    wrapper.unmount()
  })

  it('triggerFileInput clicks when ref exists', async () => {
    const wrapper = shallowMount(BatchAdd, {
      global: { stubs: { Header: true } },
    })

    const click = vi.fn()
    wrapper.vm.fileInput = { click } as any
    wrapper.vm.triggerFileInput()
    expect(click).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('parseFile rejects invalid mime/ext and oversize', async () => {
    const wrapper = shallowMount(BatchAdd, {
      global: { stubs: { Header: true } },
    })

    // invalid extension
    await wrapper.vm.parseFile(makeFile('a.txt', 10, 'text/plain'))
    expect(window.alert).toHaveBeenCalledWith('请上传 Excel 文件（.xlsx 或 .xls 格式）')
    expect(mocks.dishApiMock.parseBatchExcel).not.toHaveBeenCalled()

    // invalid mime even if extension ok
    ;(window.alert as any).mockClear()
    await wrapper.vm.parseFile(makeFile('a.xlsx', 10, 'text/plain'))
    expect(window.alert).toHaveBeenCalledWith('请上传 Excel 文件（.xlsx 或 .xls 格式）')
    expect(mocks.dishApiMock.parseBatchExcel).not.toHaveBeenCalled()

    // oversize
    ;(window.alert as any).mockClear()
    await wrapper.vm.parseFile(makeFile('a.xlsx', 10 * 1024 * 1024 + 1, 'application/vnd.ms-excel'))
    expect(window.alert).toHaveBeenCalledWith('文件大小不能超过 10MB')

    wrapper.unmount()
  })

  it('parseFile success sets parsedData tempId and handles empty items', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    mocks.dishApiMock.parseBatchExcel.mockResolvedValueOnce({
      code: 200,
      data: {
        items: [{ name: 'n1', status: 'valid' }],
      },
    })

    const wrapper = shallowMount(BatchAdd, {
      global: { stubs: { Header: true } },
    })

    const f = makeFile('ok.xlsx', 10, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    await wrapper.vm.parseFile(f)

    expect(wrapper.vm.uploadedFile).toBe(f)
    expect(wrapper.vm.isParsing).toBe(false)
    expect(wrapper.vm.parseError).toBe(null)
    expect(wrapper.vm.parsedData).toHaveLength(1)
    expect(wrapper.vm.parsedData[0].tempId).toBe('temp-0-1700000000000')

    // empty items alerts
    mocks.dishApiMock.parseBatchExcel.mockResolvedValueOnce({
      code: 200,
      data: { items: [] },
    })

    ;(window.alert as any).mockClear()
    await wrapper.vm.parseFile(f)
    expect(window.alert).toHaveBeenCalledWith('解析完成，但未找到有效数据')

    nowSpy.mockRestore()
    wrapper.unmount()
  })

  it('parseFile non-200 or throw sets parseError and alerts', async () => {
    const wrapper = shallowMount(BatchAdd, {
      global: { stubs: { Header: true } },
    })

    const f = makeFile('ok.xlsx', 10, 'application/vnd.ms-excel')

    mocks.dishApiMock.parseBatchExcel.mockResolvedValueOnce({
      code: 500,
      message: 'bad',
    })

    await wrapper.vm.parseFile(f)
    expect(wrapper.vm.parseError).toBe('bad')
    expect(window.alert).toHaveBeenCalledWith('bad')
    expect(wrapper.vm.parsedData).toEqual([])

    ;(window.alert as any).mockClear()
    mocks.dishApiMock.parseBatchExcel.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.parseFile(f)
    expect(wrapper.vm.parseError).toBe('boom')
    expect(window.alert).toHaveBeenCalledWith('boom')

    wrapper.unmount()
  })

  it('handleFileSelect and handleFileDrop call parseFile only when file exists', async () => {
    const wrapper = shallowMount(BatchAdd, {
      global: { stubs: { Header: true } },
    })

    // need to mock api since parseFile is an internal closure (not spy-able)
    mocks.dishApiMock.parseBatchExcel.mockResolvedValue({
      code: 200,
      data: { items: [] },
    })

    wrapper.vm.handleFileSelect({ target: { files: [] } } as any)
    expect(mocks.dishApiMock.parseBatchExcel).not.toHaveBeenCalled()

    const f = makeFile('ok.xlsx', 10, '')
    wrapper.vm.handleFileSelect({ target: { files: [f] } } as any)
    await Promise.resolve()
    expect(mocks.dishApiMock.parseBatchExcel).toHaveBeenCalledWith(f)

    mocks.dishApiMock.parseBatchExcel.mockClear()
    wrapper.vm.handleFileDrop({ dataTransfer: { files: [] } } as any)
    expect(mocks.dishApiMock.parseBatchExcel).not.toHaveBeenCalled()

    wrapper.vm.handleFileDrop({ dataTransfer: { files: [f] } } as any)
    await Promise.resolve()
    expect(mocks.dishApiMock.parseBatchExcel).toHaveBeenCalledWith(f)
    wrapper.unmount()
  })

  it('submitBatchData handles no valid items, confirm cancel, success, and failure', async () => {
    const wrapper = shallowMount(BatchAdd, {
      global: { stubs: { Header: true } },
    })

    // no valid/warning
    wrapper.vm.parsedData = [{ status: 'invalid' }] as any
    await wrapper.vm.submitBatchData()
    expect(window.alert).toHaveBeenCalledWith('没有可导入的有效数据')

    // confirm cancel
    ;(window.alert as any).mockClear()
    ;(window.confirm as any).mockReturnValueOnce(false)
    wrapper.vm.parsedData = [{ status: 'valid', name: 'n' }] as any
    await wrapper.vm.submitBatchData()
    expect(mocks.dishApiMock.confirmBatchImport).not.toHaveBeenCalled()

    // success no failures => resets
    ;(window.confirm as any).mockReturnValueOnce(true)
    mocks.dishApiMock.confirmBatchImport.mockResolvedValueOnce({
      code: 200,
      data: { successCount: 1, failCount: 0, errors: [] },
    })

    wrapper.vm.uploadedFile = makeFile('ok.xlsx') as any
    wrapper.vm.parsedData = [{ status: 'valid', name: 'n' }] as any
    await wrapper.vm.submitBatchData()
    expect(window.alert).toHaveBeenCalledWith('导入完成！成功：1 条')
    expect(wrapper.vm.uploadedFile).toBe(null)
    expect(wrapper.vm.parsedData).toEqual([])

    // success with failures & errors mapping
    ;(window.alert as any).mockClear()
    wrapper.vm.parsedData = [{ status: 'warning', name: 'n' }] as any
    mocks.dishApiMock.confirmBatchImport.mockResolvedValueOnce({
      code: 200,
      data: {
        successCount: 0,
        failCount: 2,
        errors: [
          { index: 0, type: 'permission', message: 'no perm' },
          { index: 1, type: 'validation', message: 'bad data' },
          { index: 2, type: 'other', message: 'oops' },
        ],
      },
    })

    await wrapper.vm.submitBatchData()
    const msg = (window.alert as any).mock.calls[0][0] as string
    expect(msg).toContain('成功：0 条')
    expect(msg).toContain('失败：2 条')
    expect(msg).toContain('[权限]')
    expect(msg).toContain('[校验]')
    expect(msg).toContain('[系统]')

    // api non-200 => alert error
    ;(window.alert as any).mockClear()
    wrapper.vm.parsedData = [{ status: 'valid', name: 'n' }] as any
    mocks.dishApiMock.confirmBatchImport.mockResolvedValueOnce({ code: 500, message: 'import bad' })
    await wrapper.vm.submitBatchData()
    expect(window.alert).toHaveBeenCalledWith('import bad')

    // throw => alert
    ;(window.alert as any).mockClear()
    mocks.dishApiMock.confirmBatchImport.mockRejectedValueOnce(new Error('boom'))
    await wrapper.vm.submitBatchData()
    expect(window.alert).toHaveBeenCalledWith('boom')

    wrapper.unmount()
  })

  it('exportErrorList alerts when no invalid, otherwise creates and clicks download link', async () => {
    const wrapper = mount(BatchAdd, {
      global: {
        stubs: { Header: true },
      },
    })

    wrapper.vm.parsedData = [{ status: 'valid' }] as any
    wrapper.vm.exportErrorList()
    expect(window.alert).toHaveBeenCalledWith('没有错误数据可导出')

    ;(window.alert as any).mockClear()

    const url = 'blob:mock'
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(url)
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const clickSpy = vi.fn()
    const origCreate = document.createElement.bind(document)
    const createElSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
      const el = origCreate(tagName)
      if (String(tagName).toLowerCase() === 'a') {
        ;(el as any).click = clickSpy
      }
      return el
    })

    wrapper.vm.parsedData = [
      { status: 'invalid', canteenName: 'c', message: 'm1' },
      { status: 'warning' },
      { status: 'invalid', canteenName: 'c2', message: '' },
    ] as any

    wrapper.vm.exportErrorList()

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledWith(url)

    createElSpy.mockRestore()
    createSpy.mockRestore()
    revokeSpy.mockRestore()

    wrapper.unmount()
  })
})
