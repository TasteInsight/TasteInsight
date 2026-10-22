import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { DishContribution } from '../../src/types/dish-contribution'

const mocks = vi.hoisted(() => ({ getWindows: vi.fn(), uploadImage: vi.fn() }))
vi.mock('@/api/modules/canteen', () => ({ canteenApi: { getWindows: mocks.getWindows } }))
vi.mock('@/api/modules/dish', () => ({ dishApi: { uploadImage: mocks.uploadImage } }))
import ContributionReviewForm from '../../src/components/Dishes/ContributionReviewForm.vue'

const upload: DishContribution = {
  id: 'u1',
  name: '豆腐',
  price: 6,
  priceUnit: '元/份',
  canteenId: 'c1',
  canteenName: '一食堂',
  windowId: 'w1',
  windowName: '窗口一',
  windowNumber: '01',
  floorName: '一层',
  spicyLevel: null,
  saltiness: 0,
  sweetness: null,
  oiliness: 1,
  revision: 3,
  kind: 'update',
  status: 'pending',
  images: ['https://images.test/one.png'],
  ingredients: ['豆腐'],
  tags: [],
  allergens: ['大豆'],
  availableMealTime: ['lunch'],
  availableDates: [],
  createdAt: '2026-10-11T02:00:00.000Z',
  updatedAt: '2026-10-11T02:00:00.000Z',
}
const renderForm = () =>
  mount(ContributionReviewForm, {
    global: { stubs: { TranslationFields: true } },
    props: { upload: structuredClone(upload), busy: false },
  })

describe('ContributionReviewForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getWindows.mockResolvedValue({
      code: 200,
      data: { items: [{ id: 'w2', name: '窗口二', number: '02', floor: { name: '二层' } }] },
    })
  })

  it('rejects blank price but emits an explicit zero without other untouched fields', async () => {
    const wrapper = renderForm()
    await flushPromises()
    await wrapper.get('#upload-price').setValue('')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('免费菜品可填写 0')
    await wrapper.get('#upload-price').setValue('0')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([[{ price: 0 }]])
    wrapper.unmount()
  })

  it('preserves null taste and original metadata when only a description changes', async () => {
    const wrapper = renderForm()
    await flushPromises()
    await wrapper.get('#upload-description').setValue('  微辣版本  ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([[{ description: '微辣版本' }]])
    expect(upload.spicyLevel).toBeNull()
    wrapper.unmount()
  })

  it('sends the selected window id only, leaving derived location ownership to the API', async () => {
    const wrapper = renderForm()
    await flushPromises()
    await wrapper.get('#upload-window').setValue('w2')
    expect(wrapper.text()).toContain('二层')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([[{ windowId: 'w2' }]])
    wrapper.unmount()
  })

  it('allows retrying window reads while retaining the draft and existing location', async () => {
    mocks.getWindows.mockRejectedValueOnce(new Error('窗口查询失败'))
    const wrapper = renderForm()
    await flushPromises()
    await wrapper.get('#upload-name').setValue('砂锅豆腐')
    expect(wrapper.get('#upload-window').attributes('disabled')).toBeDefined()
    const retry = wrapper.findAll('button').find((button) => button.text() === '重试窗口列表')!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.get('#upload-name').element).toHaveProperty('value', '砂锅豆腐')
    expect(wrapper.get('#upload-window').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('retains successful images if another image upload fails and saves only the new image array', async () => {
    const wrapper = renderForm()
    await flushPromises()
    mocks.uploadImage.mockResolvedValueOnce({
      code: 201,
      data: { url: 'https://images.test/two.png' },
    })
    mocks.uploadImage.mockRejectedValueOnce(new Error('第二张图片上传失败'))
    const files = [
      new File(['1'], 'one.png', { type: 'image/png' }),
      new File(['2'], 'two.png', { type: 'image/png' }),
    ]
    Object.defineProperty(wrapper.get('input[type="file"]').element, 'files', {
      value: files,
      configurable: true,
    })
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()
    expect(wrapper.text()).toContain('第二张图片上传失败')
    expect(wrapper.findAll('img')).toHaveLength(2)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([
      [{ images: ['https://images.test/one.png', 'https://images.test/two.png'] }],
    ])
    expect(upload.images).toEqual(['https://images.test/one.png'])
    wrapper.unmount()
  })

  it('cancels an unchanged form and prevents submissions while saving', async () => {
    const wrapper = renderForm()
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    await wrapper.get('#upload-name').setValue('新名称')
    await wrapper.setProps({ busy: true })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    wrapper.unmount()
  })
})

it('edits nutrition with zero and explicit clearing while leaving omitted values untouched', async () => {
  mocks.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
  const wrapper = mount(ContributionReviewForm, {
    global: { stubs: { TranslationFields: true } },
    props: {
      upload: { ...upload, calories: 100, protein: 12.5, carbohydrate: null, fat: 4 },
      busy: false,
    },
  })
  await flushPromises()
  await wrapper.get('#upload-calories').setValue('0')
  await wrapper.get('#upload-protein').setValue('')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('save')).toEqual([[{ calories: 0, protein: null }]])
  wrapper.unmount()
})

it('rejects negative nutrition before emitting an edit', async () => {
  mocks.getWindows.mockResolvedValue({ code: 200, data: { items: [] } })
  const wrapper = renderForm()
  await wrapper.get('#upload-fat').setValue('-1')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(wrapper.text()).toContain('营养信息请填写大于等于 0 的有效数值')
  wrapper.unmount()
})
