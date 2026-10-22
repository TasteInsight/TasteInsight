import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, it, expect, vi } from 'vitest'
import AllergenManage from '@/views/AllergenManage.vue'
import { contentLocalizationApi } from '@/api/modules/content-localization'
vi.mock('@/api/modules/content-localization', () => ({
  contentLocalizationApi: { catalog: vi.fn(), saveAllergen: vi.fn(), draft: vi.fn() },
}))
vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => ({ user: { scope: 'GLOBAL' }, hasPermission: () => true }),
}))
vi.mock('@/utils/auth-session', () => ({ authSessionVersion: ref(0) }))
const entry = { value: '燕麦', nameZh: '燕麦', nameEn: 'Oats', aliases: ['燕麦', 'Oats'] }
beforeEach(() => vi.clearAllMocks())
it('keeps the saved entry when an earlier catalogue request returns late', async () => {
  let resolve!: (value: any) => void
  vi.mocked(contentLocalizationApi.catalog).mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  vi.mocked(contentLocalizationApi.saveAllergen).mockResolvedValue({
    code: 200,
    message: 'ok',
    data: entry,
  })
  const wrapper = mount(AllergenManage)
  await wrapper.get('form input').setValue('燕麦')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(wrapper.text()).toContain('已保存')
  resolve({ data: [] })
  await flushPromises()
  expect(wrapper.get('.allergen-row').text()).toContain('Oats')
  expect(wrapper.get('[type=submit]').attributes('disabled')).toBeUndefined()
  wrapper.unmount()
})
it('retries failed reads without locking an in-flight save', async () => {
  vi.mocked(contentLocalizationApi.catalog).mockRejectedValue(new Error('offline'))
  let resolve!: (value: any) => void
  vi.mocked(contentLocalizationApi.saveAllergen).mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  const wrapper = mount(AllergenManage)
  await flushPromises()
  expect(wrapper.get('[role=alert]').text()).toContain('词表加载失败')
  await wrapper.get('form input').setValue('燕麦')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(wrapper.find('[role=alert]').exists()).toBe(false)
  expect(wrapper.get('[type=submit]').attributes('disabled')).toBeDefined()
  resolve({ data: entry })
  await flushPromises()
  expect(wrapper.get('[type=submit]').attributes('disabled')).toBeUndefined()
  expect(wrapper.text()).toContain('已保存')
  wrapper.unmount()
})
