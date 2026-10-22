import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Settings from '@/components/Content/TranslationSettings.vue'
import {
  contentLocalizationApi as api,
  type TranslationSettings,
} from '@/api/modules/content-localization'
import { authSessionVersion } from '@/utils/auth-session'
const auth = vi.hoisted(() => ({ user: { scope: 'GLOBAL' }, hasPermission: vi.fn(() => true) }))
vi.mock('@/store/modules/use-auth-store', () => ({ useAuthStore: () => auth }))
vi.mock('@/api/modules/content-localization', () => ({
  contentLocalizationApi: { translationSettings: vi.fn(), updateTranslationSettings: vi.fn() },
}))
vi.mock('@/utils/auth-session', async () => {
  const { ref } = await import('vue')
  return { authSessionVersion: ref(0) }
})
const settings = (patch: Partial<TranslationSettings> = {}): TranslationSettings => ({
  enabled: false,
  available: false,
  model: '',
  baseUrl: '',
  apiKeyConfigured: false,
  invalidFields: [],
  managedByEnv: { enabled: false, model: false, baseUrl: false, apiKey: false },
  ...patch,
})
const response = (data: TranslationSettings) => ({ code: 200, message: 'ok', data })
const mountSettings = (canEdit = true) => mount(Settings, { props: { canEdit } })
beforeEach(() => {
  vi.clearAllMocks()
  auth.user.scope = 'GLOBAL'
  auth.hasPermission.mockReturnValue(true)
  vi.mocked(api.translationSettings).mockResolvedValue(response(settings()))
})

describe('translation service settings', () => {
  it('saves independent credentials and clears the password field after success', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('input[maxlength="200"]').setValue('catalogue-model')
    await wrapper.get('input[type="url"]').setValue('https://translations.example/v1')
    await wrapper.get('input[type="password"]').setValue('test-only-translation-key')
    vi.mocked(api.updateTranslationSettings).mockResolvedValue(
      response(
        settings({
          enabled: true,
          available: true,
          model: 'catalogue-model',
          baseUrl: 'https://translations.example/v1',
          apiKeyConfigured: true,
        }),
      ),
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateTranslationSettings).toHaveBeenCalledWith(
      {
        enabled: true,
        model: 'catalogue-model',
        baseUrl: 'https://translations.example/v1',
        apiKey: 'test-only-translation-key',
      },
      expect.any(AbortSignal),
    )
    expect((wrapper.get('input[type="password"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.html()).not.toContain('test-only-translation-key')
    expect(wrapper.text()).toContain('已保存')
    wrapper.unmount()
  })
  it('preserves a stored key when blank and supports explicitly clearing it while disabled', async () => {
    vi.mocked(api.translationSettings).mockResolvedValue(
      response(settings({ model: 'old-model', apiKeyConfigured: true })),
    )
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('input[maxlength="200"]').setValue('new-model')
    vi.mocked(api.updateTranslationSettings).mockResolvedValue(
      response(settings({ model: 'new-model', apiKeyConfigured: true })),
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(vi.mocked(api.updateTranslationSettings).mock.calls[0][0]).not.toHaveProperty('apiKey')
    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)
    await wrapper.get('form').trigger('submit')
    expect(vi.mocked(api.updateTranslationSettings).mock.calls[1][0].apiKey).toBeNull()
    wrapper.unmount()
  })
  it('treats environment fields as readonly and omits them from a database update', async () => {
    const configured = settings({
      model: 'environment-model',
      apiKeyConfigured: true,
      managedByEnv: { enabled: false, model: true, baseUrl: true, apiKey: true },
    })
    vi.mocked(api.translationSettings).mockResolvedValue(response(configured))
    const wrapper = mountSettings()
    await flushPromises()
    for (const selector of [
      'input[maxlength="200"]',
      'input[type="url"]',
      'input[type="password"]',
    ])
      expect(wrapper.get(selector).attributes('disabled')).toBeDefined()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    vi.mocked(api.updateTranslationSettings).mockResolvedValue(
      response({ ...configured, enabled: true, available: true }),
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateTranslationSettings).toHaveBeenCalledWith(
      { enabled: true },
      expect.any(AbortSignal),
    )
    wrapper.unmount()
  })
  it('identifies invalid environment fields without exposing their sensitive value', async () => {
    vi.mocked(api.translationSettings).mockResolvedValue(
      response(
        settings({
          invalidFields: ['baseUrl'],
          managedByEnv: { enabled: false, model: false, baseUrl: true, apiKey: false },
        }),
      ),
    )
    const wrapper = mountSettings()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('服务地址配置无效')
    expect(wrapper.text()).toContain('联系部署管理员修正环境配置')
    expect(wrapper.get('input[type="url"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('does not enable an incomplete provider, but lets configuration be saved while disabled', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    expect(api.updateTranslationSettings).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('启用前请填写模型名称和 API Key')
    await wrapper.get('input[type="checkbox"]').setValue(false)
    await wrapper.get('input[maxlength="200"]').setValue('future-model')
    vi.mocked(api.updateTranslationSettings).mockResolvedValue(
      response(settings({ model: 'future-model' })),
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateTranslationSettings).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
  it('retains failed save drafts and prevents duplicate requests', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('input[maxlength="200"]').setValue('draft-model')
    let reject!: (error: Error) => void
    vi.mocked(api.updateTranslationSettings).mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail
      }),
    )
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(api.updateTranslationSettings).toHaveBeenCalledOnce()
    reject(new Error('offline'))
    await flushPromises()
    expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe(
      'draft-model',
    )
    expect(wrapper.text()).toContain('修改已保留')
    wrapper.unmount()
  })
  it('offers load retry and readonly access without a save action', async () => {
    vi.mocked(api.translationSettings).mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountSettings(false)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('读取失败')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('clears secrets and ignores late results after the account changes', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('input[type="password"]').setValue('test-only-private-draft')
    let resolve!: (value: any) => void
    vi.mocked(api.updateTranslationSettings).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    await wrapper.get('form').trigger('submit')
    const signal = vi.mocked(api.updateTranslationSettings).mock.calls[0][1]!
    auth.user.scope = 'CANTEENS'
    ;(authSessionVersion as { value: number }).value += 1
    await flushPromises()
    resolve(response(settings({ model: 'late-owner-model' })))
    await flushPromises()
    expect(signal.aborted).toBe(true)
    expect(wrapper.html()).not.toContain('late-owner-model')
    expect(wrapper.html()).not.toContain('test-only-private-draft')
    wrapper.unmount()
  })
})
