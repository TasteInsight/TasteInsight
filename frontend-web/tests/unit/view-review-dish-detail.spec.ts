import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(), routerReplace: vi.fn(),
  route: { params: { id: 'u1' } },
  reviewApi: { getPendingUploadById: vi.fn(), updateUpload: vi.fn(), approveUpload: vi.fn(), rejectUpload: vi.fn(), revokeUpload: vi.fn() },
  getWindows: vi.fn(), hasPermission: vi.fn(),
  showAlert: vi.fn(), showConfirm: vi.fn(), showConfirmDanger: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace }), useRoute: () => mocks.route }))
vi.mock('@/api/modules/review', () => ({ reviewApi: mocks.reviewApi }))
vi.mock('@/api/modules/canteen', () => ({ canteenApi: { getWindows: mocks.getWindows } }))
vi.mock('@/store/modules/use-auth-store', () => ({ useAuthStore: () => ({ hasPermission: mocks.hasPermission }) }))
vi.mock('@/composables/useModal', () => ({ showAlert: mocks.showAlert, showConfirm: mocks.showConfirm, showConfirmDanger: mocks.showConfirmDanger }))

import ReviewDishDetail from '../../src/views/ReviewDishDetail.vue'

enableAutoUnmount(afterEach)

const originalDish = {
  id: 'd1', name: '红烧肉', canteenId: 'c1', canteenName: '一食堂', windowId: 'w1', windowName: '窗口A',
  windowNumber: '01', floorId: 'f1', floorName: '二层', floorLevel: '2', price: 12, priceUnit: '元/份',
  images: ['https://images.test/original.jpg'], ingredients: ['猪肉'], allergens: ['大豆'], tags: ['家常菜'],
  description: '原描述', spicyLevel: 0, saltiness: 2, sweetness: null, oiliness: 3,
  availableMealTime: ['lunch'], availableDates: [], status: 'online', updatedAt: '2026-10-11T01:00:00.000Z',
}
const contribution = {
  ...originalDish, id: 'u1', price: 0, priceUnit: '元/两', description: '本次描述',
  images: ['https://images.test/new.jpg'], revision: 3, kind: 'create', status: 'pending',
  uploaderName: '张三', uploaderType: 'user', createdAt: '2026-10-11T02:00:00.000Z',
  targetDishId: null, approvedDishId: null, changedFields: [], targetDish: null,
  duplicateCandidates: [originalDish], rejectReason: null,
}

const mountPage = () => mount(ReviewDishDetail, { global: { stubs: { Header: defineComponent({ template: '<header />' }) } } })
const clickButton = async (wrapper: ReturnType<typeof mountPage>, label: string) => {
  const button = wrapper.findAll('button').find(item => item.text() === label)
  expect(button, `button ${label}`).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}

describe('views/ReviewDishDetail contribution moderation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.reviewApi.getPendingUploadById.mockReset().mockResolvedValue({ code: 200, data: structuredClone(contribution) })
    mocks.hasPermission.mockReturnValue(true)
    mocks.showConfirm.mockResolvedValue(true)
    mocks.showConfirmDanger.mockResolvedValue(true)
    mocks.getWindows.mockResolvedValue({ code: 200, data: { items: [{ id: 'w1', name: '窗口A', number: '01', floor: { id: 'f1', name: '二层', level: '2' } }] } })
  })

  it('renders full price and location while listing only provided taste dimensions', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('¥0/两')
    expect(wrapper.text()).toContain('二层')
    expect(wrapper.text()).toContain('窗口A')
    expect(wrapper.find('[data-field="sweetness"]').exists()).toBe(false)
    expect(wrapper.find('[data-field="spicyLevel"]').exists()).toBe(false)
    expect(wrapper.get('[data-field="saltiness"]').text()).toContain('2')
    expect(wrapper.get('[data-field="oiliness"]').text()).toContain('3')
    expect(wrapper.text()).toContain('新增菜品')
    expect(wrapper.text()).toContain('提交资料')
    expect(wrapper.html()).not.toContain('投稿')
    wrapper.unmount()
  })

  it('keeps load failures on the page with retry instead of navigating away', async () => {
    mocks.reviewApi.getPendingUploadById.mockRejectedValueOnce(new Error('网络连接失败'))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('网络连接失败')
    expect(mocks.routerPush).not.toHaveBeenCalled()
    await clickButton(wrapper, '重试')
    expect(wrapper.text()).toContain('红烧肉')
    wrapper.unmount()
  })

  it('trims and requires a rejection reason and sends the revision', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await clickButton(wrapper, '拒绝审核')
    const dialog = new DOMWrapper(document.body).get('dialog[aria-label="拒绝审核"]')
    await dialog.get('textarea').setValue('   ')
    await dialog.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.reviewApi.rejectUpload).not.toHaveBeenCalled()
    expect(dialog.text()).toContain('请填写拒绝原因')
    await dialog.get('textarea').setValue('  价格待核实  ')
    mocks.reviewApi.rejectUpload.mockResolvedValueOnce({ code: 200 })
    await dialog.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.reviewApi.rejectUpload).toHaveBeenCalledWith('u1', { reason: '价格待核实', revision: 3 })
    expect(mocks.routerReplace).toHaveBeenCalledWith({ name: 'ReviewDish' })
    wrapper.unmount()
  })

  it('requires an explicit target and merge fields and retains the selected baseline timestamp', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('#merge-dish').element).toHaveProperty('value', '')
    await wrapper.get('#merge-dish').setValue('d1')
    expect(wrapper.findAll('[data-comparison]')).toHaveLength(15)
    expect(wrapper.findAll('col')).toHaveLength(4)
    expect((wrapper.get('col').element as HTMLTableColElement).style.width).toBe('4rem')
    expect(wrapper.text()).not.toContain('图片将追加')
    await clickButton(wrapper, '通过并归并')
    expect(mocks.reviewApi.approveUpload).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请选择需要归并的字段')
    await wrapper.get('input[value="price"]').setValue(true)
    await wrapper.get('input[value="images"]').setValue(true)
    expect(wrapper.text()).toContain('图片将追加')
    mocks.reviewApi.approveUpload.mockResolvedValueOnce({ code: 200 })
    await clickButton(wrapper, '通过并归并')
    expect(mocks.reviewApi.approveUpload).toHaveBeenCalledWith('u1', {
      revision: 3, mergeDishId: 'd1', mergeDishUpdatedAt: originalDish.updatedAt, mergeFields: ['price', 'images'],
    })
    expect(mocks.showConfirm).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows original and declared contribution fields for updates', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: {
      ...contribution, kind: 'update', targetDishId: 'd1', targetDish: originalDish, changedFields: ['price', 'priceUnit'],
    } })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('补充资料')
    expect(wrapper.text()).toContain('原菜品资料')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('元/份')
    expect(wrapper.find('#merge-dish').exists()).toBe(false)
    expect(wrapper.findAll('[data-comparison]').map(row => row.attributes('data-comparison'))).toEqual(['price', 'priceUnit'])
    expect(wrapper.find('[data-comparison="description"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('未变更，保留原资料')
    expect(wrapper.text()).not.toContain('图片将追加')
    wrapper.unmount()
  })

  it('edits only changed allowed fields and uses the returned revision on approval', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await clickButton(wrapper, '编辑资料')
    expect(wrapper.html()).not.toContain('投稿')
    await wrapper.get('#upload-price-unit').setValue('元/斤')
    mocks.reviewApi.updateUpload.mockResolvedValueOnce({ code: 200, data: { ...contribution, priceUnit: '元/斤', revision: 4 } })
    await wrapper.get('form[data-testid="contribution-edit"]').trigger('submit')
    await flushPromises()
    expect(mocks.reviewApi.updateUpload).toHaveBeenCalledWith('u1', { revision: 3, priceUnit: '元/斤' })
    mocks.reviewApi.approveUpload.mockResolvedValueOnce({ code: 200 })
    await clickButton(wrapper, '通过审核')
    expect(mocks.reviewApi.approveUpload).toHaveBeenCalledWith('u1', { revision: 4 })
    wrapper.unmount()
  })

  it('reloads after 409 and requires reviewing refreshed data before another approval', async () => {
    const wrapper = mountPage()
    await flushPromises()
    mocks.reviewApi.approveUpload.mockRejectedValueOnce(Object.assign(new Error('资料已更新'), { status: 409 }))
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: { ...contribution, revision: 4, price: 9 } })
    await clickButton(wrapper, '通过审核')
    expect(mocks.reviewApi.getPendingUploadById).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('已刷新最新资料')
    expect(wrapper.text()).toContain('¥9/两')
    expect(mocks.reviewApi.approveUpload).toHaveBeenCalledTimes(1)
    expect(mocks.routerReplace).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['create', 'update'])('explains safe %s revocation and includes revision', async kind => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: { ...contribution, kind, status: 'approved', approvedDishId: 'd1' } })
    mocks.reviewApi.revokeUpload.mockResolvedValueOnce({ code: 200 })
    const wrapper = mountPage()
    await flushPromises()
    await clickButton(wrapper, '撤销审核结果')
    expect(mocks.showConfirmDanger.mock.calls[0][0]).toContain(kind === 'create' ? '下架' : '仅撤回本次修改的字段')
    expect(mocks.showConfirmDanger.mock.calls[0][0]).toContain('评价、收藏和计划')
    expect(mocks.reviewApi.revokeUpload).toHaveBeenCalledWith('u1', { revision: 3 })
    wrapper.unmount()
  })

  it('blocks all write affordances without upload approval permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const wrapper = mountPage()
    await flushPromises()
    for (const label of ['编辑资料', '通过审核', '拒绝审核']) {
      const button = wrapper.findAll('button').find(item => item.text() === label)
      expect(button?.attributes('disabled')).toBeDefined()
    }
    expect(mocks.reviewApi.approveUpload).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('locks moderation while confirming and does not submit after cancellation', async () => {
    let resolveConfirmation!: (confirmed: boolean) => void
    mocks.showConfirm.mockImplementationOnce(() => new Promise<boolean>(resolve => { resolveConfirmation = resolve }))
    const wrapper = mountPage()
    await flushPromises()
    const approve = wrapper.findAll('button').find(button => button.text() === '通过审核')!
    await approve.trigger('click')
    expect(approve.attributes('disabled')).toBeDefined()
    await approve.trigger('click')
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1)
    resolveConfirmation(false)
    await flushPromises()
    expect(mocks.reviewApi.approveUpload).not.toHaveBeenCalled()
    expect(approve.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps a saved merge target fixed on rereview and describes field-only revocation', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: {
      ...contribution, targetDishId: 'd1', targetDish: originalDish, baseSnapshot: originalDish, changedFields: ['images'], status: 'approved',
    } })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('#merge-dish').exists()).toBe(false)
    expect(wrapper.findAll('[data-comparison]').map(row => row.attributes('data-comparison'))).toEqual(['images'])
    expect(wrapper.text()).toContain('图片将追加')
    mocks.showConfirmDanger.mockResolvedValueOnce(false)
    await clickButton(wrapper, '撤销审核结果')
    expect(mocks.showConfirmDanger.mock.calls[0][0]).toContain('仅撤回本次修改的字段')
    expect(mocks.showConfirmDanger.mock.calls[0][0]).not.toContain('将下架')
    expect(mocks.reviewApi.revokeUpload).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['update', 'create'])('uses the accepted baseline for an approved %s record after the live dish changes', async kind => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: {
      ...contribution, kind, status: 'approved', price: 16, changedFields: ['price'],
      targetDishId: 'd1', approvedDishId: 'd1', targetDish: { ...originalDish, price: 17 },
      baseSnapshot: { ...originalDish, price: 15 },
    } })
    const wrapper = mountPage()
    await flushPromises()
    const values = wrapper.get('[data-comparison="price"]').findAll('td').map(cell => cell.text())
    expect(values).toEqual(['¥15', '¥16'])
    wrapper.unmount()
  })

  it('keeps pending comparisons on live target data even when a baseline snapshot exists', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: {
      ...contribution, kind: 'update', price: 16, changedFields: ['price'], targetDishId: 'd1',
      targetDish: { ...originalDish, price: 17 }, baseSnapshot: { ...originalDish, price: 15 },
    } })
    const wrapper = mountPage()
    await flushPromises()
    const values = wrapper.get('[data-comparison="price"]').findAll('td').map(cell => cell.text())
    expect(values).toEqual(['¥17', '¥16'])
    wrapper.unmount()
  })

  it('requires explicit baseline confirmation after a target conflict and never auto-approves', async () => {
    const update = { ...contribution, kind: 'update', targetDishId: 'd1', targetDish: originalDish, changedFields: ['price'] }
    mocks.reviewApi.getPendingUploadById.mockResolvedValue({ code: 200, data: update })
    mocks.reviewApi.approveUpload.mockRejectedValueOnce(Object.assign(new Error('正式菜品资料已变化'), { status: 409 }))
    const wrapper = mountPage()
    await flushPromises()
    await clickButton(wrapper, '通过审核')
    expect(mocks.reviewApi.updateUpload).not.toHaveBeenCalled()
    mocks.reviewApi.updateUpload.mockResolvedValueOnce({ code: 200, data: { ...update, revision: 4 } })
    await clickButton(wrapper, '确认当前资料并重审')
    expect(mocks.reviewApi.updateUpload).toHaveBeenCalledWith('u1', { revision: 3, targetDishUpdatedAt: originalDish.updatedAt })
    expect(mocks.reviewApi.approveUpload).toHaveBeenCalledTimes(1)
    mocks.reviewApi.approveUpload.mockResolvedValueOnce({ code: 200 })
    await clickButton(wrapper, '通过审核')
    expect(mocks.reviewApi.approveUpload).toHaveBeenLastCalledWith('u1', { revision: 4 })
    wrapper.unmount()
  })

  it('hides irrelevant merge controls and groups empty metadata without losing editing access', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: {
      ...contribution, price: 14, priceUnit: '份', description: null, tags: [], ingredients: [], allergens: [],
      duplicateCandidates: [], spicyLevel: 0, sweetness: 0, saltiness: 0, oiliness: 0,
    } })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('¥14/份')
    expect(wrapper.find('#merge-dish').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('核对相似菜品')
    expect(wrapper.text()).not.toContain('资料版本')
    expect(wrapper.find('[data-field="description"]').exists()).toBe(false)
    const missing = wrapper.get('[data-testid="missing-contribution-fields"]')
    for (const label of ['菜品描述', '标签', '原辅料', '过敏原', '供应日期段']) expect(missing.text()).toContain(label)
    const tastes = wrapper.get('[aria-label="口味"]')
    expect(tastes.findAll('[data-field]')).toHaveLength(0)
    expect(tastes.text().match(/未提供/g)).toHaveLength(1)
    expect(tastes.text()).not.toContain('0')
    await clickButton(wrapper, '编辑资料')
    for (const id of ['description', 'tags', 'ingredients', 'allergens']) expect(wrapper.find(`#upload-${id}`).exists()).toBe(true)
    wrapper.unmount()
  })

  it('keeps a price-only update comparison to one row with no image instructions', async () => {
    mocks.reviewApi.getPendingUploadById.mockResolvedValueOnce({ code: 200, data: {
      ...contribution, kind: 'update', targetDishId: 'd1', targetDish: originalDish, changedFields: ['price'],
    } })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.findAll('[data-comparison]').map(row => row.attributes('data-comparison'))).toEqual(['price'])
    const table = wrapper.get('table').element as HTMLTableElement
    expect(Number.parseFloat(table.style.minWidth)).toBe(0)
    expect(table.style.tableLayout).toBe('fixed')
    expect(wrapper.findAll('col')).toHaveLength(3)
    expect((wrapper.get('col').element as HTMLTableColElement).style.width).toBe('20%')
    expect(wrapper.text()).not.toContain('图片将追加')
    expect(wrapper.text()).not.toContain('未变更，保留原资料')
    expect(wrapper.findAll('button').some(button => button.text() === '通过审核')).toBe(true)
    wrapper.unmount()
  })
})
