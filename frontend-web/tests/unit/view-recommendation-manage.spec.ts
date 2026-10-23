import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import RecommendationManage from '@/views/RecommendationManage.vue'
import { baselineConfig, recommendationApi } from '@/api/modules/recommendation'
vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => ({ hasPermission: () => true }),
}))
vi.mock('@/composables/useModal', () => ({ showConfirmDanger: vi.fn().mockResolvedValue(true) }))
vi.mock('@/api/modules/recommendation', async (original) => {
  const actual = await original<typeof import('@/api/modules/recommendation')>()
  return {
    ...actual,
    recommendationApi: Object.fromEntries(
      Object.keys(actual.recommendationApi).map((key) => [key, vi.fn()]),
    ),
  }
})
const notifySuccess = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ success: notifySuccess }),
}))
const api = vi.mocked(recommendationApi)
let wrapper: ReturnType<typeof mount>
const published = {
  id: 'published',
  name: '基线',
  scene: 'home' as const,
  status: 'published',
  config: baselineConfig(),
}
const draft = { ...published, id: 'draft', name: '新策略', status: 'draft' }
const catalog = () => ({
  models: [
    {
      id: 'ranker-ready',
      name: '排序模型',
      kind: 'ranking' as const,
      provider: 'http' as const,
      serviceVersion: 'v1',
      artifactDigest: 'digest',
      featureSchemaVersion: 'ranking-numeric-v1',
      status: 'ready',
    },
  ],
  indexes: [],
  strategies: [published, draft],
  defaults: [{ scene: 'home' as const, strategyRevisionId: 'published' }],
  deployments: ['model-prod'],
  storeConfigured: true,
})
const button = (text: string) => wrapper.findAll('button').find((item) => item.text() === text)!
beforeEach(async () => {
  vi.clearAllMocks()
  api.catalog.mockResolvedValue({ code: 200, message: 'ok', data: catalog() })
  wrapper = mount(RecommendationManage)
  await flushPromises()
})
afterEach(() => wrapper.unmount())
describe('recommendation management', () => {
  it('shows named dishes in final recommendation order with rounded scores and expandable explanations', async () => {
    api.preview.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: {
        mode: 'preview',
        strategyRevisionId: 'published',
        items: [
          {
            id: 'dish-a',
            score: 0.76466993,
            scoreBreakdown: { preferenceScore: 0.9 },
            dish: {
              id: 'dish-a',
              name: '番茄炒蛋',
              canteenName: '清风食堂',
              windowName: '家常菜',
              price: 12.5,
              priceUnit: '份',
            },
          },
          {
            id: 'dish-b',
            score: 0.82,
            dish: {
              id: 'dish-b',
              name: '清蒸鲈鱼',
              canteenName: '荷园食堂',
              windowName: '蒸菜',
              price: 18,
              priceUnit: null,
            },
          },
        ],
      },
    })
    await button('用户预览').trigger('click')
    await wrapper.get('#recommendation-preview-user').setValue('user-1')
    await wrapper.get('#recommendation-preview-strategy').setValue('published')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(api.preview).toHaveBeenCalledWith({
      userId: 'user-1',
      strategyRevisionId: 'published',
      pageSize: 10,
    })
    const rows = wrapper.findAll('[data-testid="preview-dish"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('番茄炒蛋')
    expect(rows[0].text()).toContain('清风食堂 · 家常菜')
    expect(rows[0].text()).toContain('¥12.50 / 份')
    expect(rows[1].text()).toContain('清蒸鲈鱼')
    expect(rows.map((row) => row.get('[data-testid="preview-score"]').text())).toEqual([
      '0.765',
      '0.820',
    ])
    expect(rows[0].get('details').attributes('open')).toBeUndefined()
    expect(rows[0].get('details').text()).toContain('偏好匹配')
    expect(rows[0].get('details').text()).toContain('0.900')
    expect(wrapper.find('pre').exists()).toBe(false)
    expect(notifySuccess).toHaveBeenCalledWith('预览已生成')
  })
  it('keeps unavailable dish records and missing scores readable without inventing values', async () => {
    api.preview.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: { mode: 'preview', items: [{ id: 'deleted-dish' }] },
    })
    await button('用户预览').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const row = wrapper.get('[data-testid="preview-dish"]')
    expect(row.text()).toContain('菜品信息暂不可用')
    expect(row.get('[data-testid="preview-score"]').text()).toBe('—')
    expect(row.get('details').text()).toContain('deleted-dish')
    expect(row.text()).toContain('此排序方式未提供分项评分')
  })
  it('saves one shared configuration from JSON and visual inputs', async () => {
    await button('编辑').trigger('click')
    const config = baselineConfig()
    config.recall.candidateLimit = 120
    await wrapper.find('textarea').setValue(JSON.stringify(config))
    const candidate = wrapper.findAll('input').find((input) => input.element.value === '120')!
    await candidate.setValue('160')
    api.updateStrategy.mockResolvedValue({ code: 200, message: 'ok', data: draft })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(api.updateStrategy).toHaveBeenCalledWith('draft', {
      name: '新策略',
      config: expect.objectContaining({ recall: expect.objectContaining({ candidateLimit: 160 }) }),
    })
  })
  it('blocks malformed JSON and preserves the valid form state', async () => {
    await button('编辑').trigger('click')
    await wrapper.find('textarea').setValue('{')
    expect(button('保存草稿').attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(api.updateStrategy).not.toHaveBeenCalled()
  })
  it('locks published revisions and creates a new draft when copied', async () => {
    await button('查看 / 复制').trigger('click')
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
    await button('复制为新草稿').trigger('click')
    api.createStrategy.mockResolvedValue({ code: 201, message: 'ok', data: draft })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(api.createStrategy).toHaveBeenCalledWith({
      name: '基线 副本',
      scene: 'home',
      config: baselineConfig(),
    })
  })
  it('switches ranking variants using only fields consumed by the selected algorithm', async () => {
    await button('编辑').trigger('click')
    const labelControl = (name: string, tag: string) =>
      wrapper
        .findAll('label')
        .find((label) => label.text().startsWith(name))!
        .find(tag)
    expect(wrapper.findAll('label').some((label) => label.text().startsWith('超时预算'))).toBe(
      false,
    )
    await labelControl('排序方式', 'select').setValue('model_endpoint')
    expect(wrapper.findAll('label').some((label) => label.text().startsWith('偏好匹配'))).toBe(
      false,
    )
    await labelControl('排序模型', 'select').setValue('ranker-ready')
    await labelControl('超时预算', 'input').setValue('850')
    const config = JSON.parse(wrapper.find('textarea').element.value)
    expect(config.ranking).toEqual({
      type: 'model_endpoint',
      modelVersionId: 'ranker-ready',
      timeoutMs: 850,
    })
    api.updateStrategy.mockResolvedValue({ code: 200, message: 'ok', data: { ...draft, config } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(api.updateStrategy).toHaveBeenLastCalledWith('draft', { name: '新策略', config })
    await labelControl('排序方式', 'select').setValue('weighted_rules')
    expect(JSON.parse(wrapper.find('textarea').element.value).ranking).toEqual(
      baselineConfig().ranking,
    )
    expect(wrapper.findAll('label').some((label) => label.text().startsWith('超时预算'))).toBe(
      false,
    )
    expect(wrapper.findAll('label').some((label) => label.text().startsWith('排序模型'))).toBe(
      false,
    )
  })
  it('accepts model JSON without weights and rejects fields from the other ranking variant', async () => {
    await button('编辑').trigger('click')
    const config = baselineConfig()
    config.ranking = { type: 'model_endpoint', modelVersionId: 'ranker-ready', timeoutMs: 900 }
    await wrapper.find('textarea').setValue(JSON.stringify(config))
    expect(button('保存草稿').attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('label').some((label) => label.text().startsWith('偏好匹配'))).toBe(
      false,
    )
    await wrapper
      .find('textarea')
      .setValue(JSON.stringify({ ...config, ranking: { ...config.ranking, weights: {} } }))
    expect(wrapper.find('[role="alert"]').text()).toContain('模型排序配置仅包含')
    expect(button('保存草稿').attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(api.updateStrategy).not.toHaveBeenCalled()
    const rules = baselineConfig()
    await wrapper
      .find('textarea')
      .setValue(JSON.stringify({ ...rules, ranking: { ...rules.ranking, timeoutMs: 900 } }))
    expect(wrapper.find('[role="alert"]').text()).toContain('规则排序配置仅包含')
    await wrapper.find('textarea').setValue(JSON.stringify(rules))
    expect(button('保存草稿').attributes('disabled')).toBeUndefined()
  })
  it('compares concrete changed fields against a selected published version from the same scene', async () => {
    const alternative = {
      ...published,
      id: 'alternative',
      name: '候选数基线',
      config: baselineConfig(),
    }
    alternative.config.recall.candidateLimit = 120
    api.catalog.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: {
        ...catalog(),
        strategies: [
          published,
          draft,
          alternative,
          { ...published, id: 'search-only', name: '搜索基线', scene: 'search' },
        ],
      },
    })
    await button('刷新状态').trigger('click')
    await flushPromises()
    await button('编辑').trigger('click')
    const comparison = wrapper
      .findAll('label')
      .find((label) => label.text().startsWith('对比基线版本'))!
      .find('select')
    expect(comparison.findAll('option').map((option) => option.attributes('value'))).toEqual([
      '',
      'published',
      'alternative',
    ])
    expect(wrapper.text()).toContain('两个版本的策略配置一致')
    const candidate = wrapper
      .findAll('label')
      .find((label) => label.text().startsWith('候选上限'))!
      .find('input')
    await candidate.setValue('140')
    const diffTable = () => wrapper.find('table[aria-label="策略字段差异"]')
    expect(diffTable().findAll('tbody tr')).toHaveLength(1)
    expect(
      diffTable()
        .findAll('td')
        .map((cell) => cell.text()),
    ).toEqual(['200', '140'])
    await comparison.setValue('alternative')
    expect(
      diffTable()
        .findAll('td')
        .map((cell) => cell.text()),
    ).toEqual(['120', '140'])
    expect(diffTable().text()).toContain('recall.candidateLimit')
  })
  it('displays server validation errors instead of claiming a publish succeeded', async () => {
    api.publishStrategy.mockRejectedValue(new Error('索引尚未就绪'))
    await button('发布').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('索引尚未就绪')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
