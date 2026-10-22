import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TranslationFields from '@/components/Content/TranslationFields.vue'
import { contentLocalizationApi } from '@/api/modules/content-localization'
vi.mock('@/api/modules/content-localization', () => ({
  contentLocalizationApi: { draft: vi.fn(), translationStatus: vi.fn() },
}))
vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => ({ user: { scope: 'CANTEENS' }, hasPermission: () => false }),
}))
vi.mock('@/utils/auth-session', () => ({ authSessionVersion: ref(0) }))
describe('translation suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contentLocalizationApi.translationStatus).mockResolvedValue({
      code: 200,
      message: 'ok',
      data: { enabled: true, available: true },
    })
  })
  it('keeps existing translations until an explicit apply action', async () => {
    vi.mocked(contentLocalizationApi.draft).mockResolvedValue({
      code: 200,
      message: 'ok',
      data: { nameEn: 'Tomato eggs', descriptionEn: 'New description' },
    })
    const wrapper = mount(TranslationFields, {
      props: { name: '番茄炒蛋', nameEn: 'Existing', descriptionEn: 'Existing description' },
    })
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:nameEn')).toBeUndefined()
    expect(wrapper.get('input').element.value).toBe('Existing')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '采用建议')!
      .trigger('click')
    expect(wrapper.emitted('update:nameEn')).toEqual([['Tomato eggs']])
    expect(wrapper.emitted('update:descriptionEn')).toEqual([['New description']])
    wrapper.unmount()
  })
  it.each([{ name: '另一道菜' }, { nameEn: 'Manual edit' }])(
    'discards responses after the form changes',
    async (patch) => {
      let resolve!: (value: any) => void
      vi.mocked(contentLocalizationApi.draft).mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done
          }),
      )
      const wrapper = mount(TranslationFields, { props: { name: '原菜名' } })
      await flushPromises()
      await wrapper.get('button').trigger('click')
      const signal = vi.mocked(contentLocalizationApi.draft).mock.calls[0][1]
      await wrapper.setProps(patch)
      resolve({ data: { nameEn: 'Late suggestion', descriptionEn: '' } })
      await flushPromises()
      expect(signal.aborted).toBe(true)
      expect(wrapper.text()).not.toContain('Late suggestion')
      expect(wrapper.emitted('update:nameEn')).toBeUndefined()
      wrapper.unmount()
    },
  )
  it('keeps manual English editable without configuration permissions when translation is disabled', async () => {
    vi.mocked(contentLocalizationApi.translationStatus).mockResolvedValue({
      code: 200,
      message: 'ok',
      data: { enabled: false, available: false },
    })
    const wrapper = mount(TranslationFields, { props: { name: '菜品', nameEn: 'Manual' } })
    await flushPromises()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('联系配置管理员')
    expect(wrapper.find('router-link').exists()).toBe(false)
    await wrapper.get('input').setValue('Hand edited')
    expect(wrapper.emitted('update:nameEn')).toEqual([['Hand edited']])
    expect(contentLocalizationApi.draft).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('preserves manual entry when capability lookup fails and can retry', async () => {
    vi.mocked(contentLocalizationApi.translationStatus).mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(TranslationFields, { props: { name: '菜品', nameEn: 'Manual' } })
    await flushPromises()
    expect(wrapper.text()).toContain('状态读取失败')
    expect(wrapper.get('input').attributes('disabled')).toBeUndefined()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重试')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('preserves the form on failure and allows retry', async () => {
    vi.mocked(contentLocalizationApi.draft).mockRejectedValue(new Error('network'))
    const wrapper = mount(TranslationFields, { props: { name: '菜品', nameEn: 'Manual' } })
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('生成失败')
    expect(wrapper.get('input').element.value).toBe('Manual')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
