import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import RecommendationManage from '@/views/RecommendationManage.vue'
import {
  baselineConfig,
  recommendationApi,
  type ModelParameterSchema,
  type RecommendationCatalog,
} from '@/api/modules/recommendation'
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
const catalog = (): RecommendationCatalog => ({
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
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
)
beforeEach(async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
  vi.clearAllMocks()
  api.catalog.mockResolvedValue({ code: 200, message: 'ok', data: catalog() })
  wrapper = mount(RecommendationManage, { global: { stubs: { Teleport: true } } })
  await flushPromises()
})
afterEach(() => {
  wrapper.unmount()
  if (originalScrollIntoView)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})
describe('recommendation management', () => {
  it('moves focus and scrolls to the editor after opening an existing or new draft', async () => {
    wrapper.unmount()
    wrapper = mount(RecommendationManage, { attachTo: document.body })
    await flushPromises()
    for (const action of ['编辑', '新建草稿']) {
      await button(action).trigger('click')
      await flushPromises()
      const heading = wrapper.get('.editor-heading').element
      expect(document.activeElement).toBe(heading)
      expect(heading.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      await button('关闭编辑').trigger('click')
    }
  })
  it('describes actual model ranking instead of claiming weighted rule explanations', async () => {
    api.preview.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: {
        mode: 'preview',
        rankerVersionId: 'ranker-ready',
        items: [{ id: 'dish', score: 0.7 }],
      },
    })
    await button('用户预览').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('按模型评分与重排后的最终顺序展示')
    expect(wrapper.text()).not.toContain('加权前评分')
    expect(wrapper.text()).toContain('此排序方式未提供分项评分')
    api.preview.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: {
        mode: 'preview',
        items: [{ id: 'dish', score: 0.5, scoreBreakdown: { preferenceScore: 0.6 } }],
      },
    })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('加权前评分')
    expect(wrapper.text()).not.toContain('按模型评分与重排后的最终顺序展示')
  })
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
      parameters: {},
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

const parameterSchema: ModelParameterSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    temperature: {
      type: 'number',
      title: '温度',
      description: '缩放排序得分',
      default: 1,
      minimum: 0.25,
      maximum: 4,
    },
    count: { type: 'integer', title: '数量', default: 0, minimum: 0, maximum: 10 },
    enabled: { type: 'boolean', title: '开关', default: false },
    mode: { type: 'string', title: '模式', default: 'a', enum: ['a', 'b'] },
  },
}
const labelControl = (name: string, tag: string) =>
  wrapper
    .findAll('label')
    .find((label) => label.text().startsWith(name))!
    .find(tag)
async function loadParameterModels() {
  const data = catalog()
  const base = data.models[0]
  data.models.push(
    { ...base, id: 'ranker-parameters', name: '参数模型', parameterSchema },
    {
      ...base,
      id: 'ranker-other',
      name: '另一个模型',
      parameterSchema: {
        ...parameterSchema,
        properties: {
          strength: { type: 'number', title: '强度', default: 2, minimum: 0, maximum: 5 },
        },
      },
    },
    { ...base, id: 'embed-a', name: '向量 A', kind: 'embedding', parameterSchema },
    {
      ...base,
      id: 'embed-b',
      name: '向量 B',
      kind: 'embedding',
      parameterSchema: {
        ...parameterSchema,
        properties: {
          numericWeight: { type: 'number', title: '数值权重', default: 1, minimum: 0, maximum: 5 },
        },
      },
    },
  )
  api.catalog.mockResolvedValue({ code: 200, message: 'ok', data })
  await button('刷新状态').trigger('click')
  await flushPromises()
}
async function selectParameterRanker() {
  await loadParameterModels()
  await button('编辑').trigger('click')
  await labelControl('排序方式', 'select').setValue('model_endpoint')
  await labelControl('排序模型', 'select').setValue('ranker-parameters')
}
describe('model-declared recommendation parameters', () => {
  it('resets values and errors when selecting a different model, preserving zero and false defaults', async () => {
    await selectParameterRanker()
    expect(JSON.parse(wrapper.get('textarea').element.value).ranking.parameters).toEqual({
      temperature: 1,
      count: 0,
      enabled: false,
      mode: 'a',
    })
    expect(wrapper.text()).toContain('缩放排序得分 默认：1')
    expect(wrapper.get('#ranking-parameter-temperature').attributes()).toMatchObject({
      min: '0.25',
      max: '4',
      step: 'any',
    })
    expect(wrapper.get('#ranking-parameter-count').attributes()).toMatchObject({
      min: '0',
      max: '10',
      step: '1',
    })
    expect(
      wrapper
        .get('#ranking-parameter-mode')
        .findAll('option')
        .map((item) => item.attributes('value')),
    ).toEqual(['a', 'b'])
    await wrapper.get('#ranking-parameter-temperature').setValue('8')
    expect(button('保存草稿').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('温度须为 0.25 至 4')
    await wrapper.get('textarea').setValue('{')
    await labelControl('排序模型', 'select').setValue('ranker-other')
    expect(button('保存草稿').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('#ranking-parameter-temperature').exists()).toBe(false)
    expect(JSON.parse(wrapper.get('textarea').element.value).ranking.parameters).toEqual({
      strength: 2,
    })
    await labelControl('排序模型', 'select').setValue('ranker-ready')
    expect(JSON.parse(wrapper.get('textarea').element.value).ranking.parameters).toEqual({})
    expect(wrapper.text()).toContain('此模型使用固定配置，暂无可调整参数')
  })
  it('synchronizes JSON and controls and sends explicit zero and false values', async () => {
    await selectParameterRanker()
    const config = JSON.parse(wrapper.get('textarea').element.value)
    config.ranking.parameters = { temperature: 2, count: 4, enabled: true, mode: 'b' }
    await wrapper.get('textarea').setValue(JSON.stringify(config))
    expect((wrapper.get('#ranking-parameter-temperature').element as HTMLInputElement).value).toBe(
      '2',
    )
    expect((wrapper.get('#ranking-parameter-enabled').element as HTMLInputElement).checked).toBe(
      true,
    )
    expect((wrapper.get('#ranking-parameter-mode').element as HTMLSelectElement).value).toBe('b')
    await wrapper.get('#ranking-parameter-count').setValue('0')
    await wrapper.get('#ranking-parameter-enabled').setValue(false)
    const expected = { temperature: 2, count: 0, enabled: false, mode: 'b' }
    expect(JSON.parse(wrapper.get('textarea').element.value).ranking.parameters).toEqual(expected)
    api.updateStrategy.mockResolvedValue({ code: 200, message: 'ok', data: { ...draft, config } })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateStrategy).toHaveBeenCalledWith(
      'draft',
      expect.objectContaining({
        config: expect.objectContaining({
          ranking: expect.objectContaining({ parameters: expected }),
        }),
      }),
    )
  })
  it('inherits defaults when cleared while keeping the numeric input editable and JSON synchronized', async () => {
    await selectParameterRanker()
    const temperature = wrapper.get('#ranking-parameter-temperature')
    await temperature.setValue('2')
    await temperature.setValue('')
    expect((temperature.element as HTMLInputElement).value).toBe('')
    expect(temperature.attributes('required')).toBeUndefined()
    expect(wrapper.text()).toContain('留空使用默认值')
    expect(JSON.parse(wrapper.get('textarea').element.value).ranking.parameters.temperature).toBe(1)
    expect(button('保存草稿').attributes('disabled')).toBeUndefined()
    await temperature.setValue('3')
    expect(JSON.parse(wrapper.get('textarea').element.value).ranking.parameters.temperature).toBe(3)
    await temperature.setValue('')
    await temperature.trigger('blur')
    expect((temperature.element as HTMLInputElement).value).toBe('1')
    await wrapper.get('#ranking-parameter-count').setValue('4')
    await wrapper.get('#ranking-parameter-count').setValue('')
    const config = JSON.parse(wrapper.get('textarea').element.value)
    expect(config.ranking.parameters).toEqual({
      temperature: 1,
      count: 0,
      enabled: false,
      mode: 'a',
    })
    api.updateStrategy.mockResolvedValue({ code: 200, message: 'ok', data: { ...draft, config } })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateStrategy).toHaveBeenCalledWith('draft', { name: '新策略', config })
    config.ranking.parameters.temperature = 2
    await wrapper.get('textarea').setValue(JSON.stringify(config))
    expect((wrapper.get('#ranking-parameter-temperature').element as HTMLInputElement).value).toBe(
      '2',
    )
  })
  it('fills defaults in the editor and JSON when opening a partially configured model draft', async () => {
    await loadParameterModels()
    const config = baselineConfig()
    config.ranking = {
      type: 'model_endpoint',
      modelVersionId: 'ranker-parameters',
      timeoutMs: 1000,
      parameters: { temperature: 2 },
    }
    const nextCatalog = (await api.catalog()).data
    api.catalog.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: { ...nextCatalog, strategies: [published, { ...draft, config }] },
    })
    await button('刷新状态').trigger('click')
    await flushPromises()
    await button('编辑').trigger('click')
    expect(JSON.parse(wrapper.get('textarea').element.value).ranking.parameters).toEqual({
      temperature: 2,
      count: 0,
      enabled: false,
      mode: 'a',
    })
    expect(config.ranking.parameters).toEqual({ temperature: 2 })
  })
  it.each([
    [{ temperature: 5 }, '温度须为'],
    [{ temperature: 0 }, '温度须为'],
    [{ temperature: '1' }, '温度须为'],
    [JSON.parse('{"__proto__": 1}'), '模型未声明参数 __proto__'],
    [{ count: 1.2 }, '数量须为'],
    [{ enabled: 'false' }, '开关须为布尔值'],
    [{ mode: 'unknown' }, '模式须选择'],
    [{ extra: 1 }, '模型未声明参数 extra'],
    [[], '模型参数须为 JSON 对象'],
  ])(
    'keeps valid form values when JSON parameters are invalid: %j',
    async (parameters, errorText) => {
      await selectParameterRanker()
      const config = JSON.parse(wrapper.get('textarea').element.value)
      config.ranking.parameters = parameters
      await wrapper.get('textarea').setValue(JSON.stringify(config))
      expect(wrapper.text()).toContain(errorText)
      expect(button('保存草稿').attributes('disabled')).toBeDefined()
      expect(
        (wrapper.get('#ranking-parameter-temperature').element as HTMLInputElement).value,
      ).toBe('1')
      await wrapper.get('form').trigger('submit')
      expect(api.updateStrategy).not.toHaveBeenCalled()
    },
  )
  it('fills declared defaults when valid JSON omits parameters', async () => {
    await selectParameterRanker()
    const config = JSON.parse(wrapper.get('textarea').element.value)
    delete config.ranking.parameters
    await wrapper.get('textarea').setValue(JSON.stringify(config))
    expect(JSON.parse(wrapper.get('textarea').element.value).ranking.parameters).toEqual({
      temperature: 1,
      count: 0,
      enabled: false,
      mode: 'a',
    })
  })
  it('creates embedding indexes with the selected model parameters and clears the previous model values', async () => {
    await loadParameterModels()
    await button('索引构建').trigger('click')
    await labelControl('索引名称', 'input').setValue('参数索引')
    await labelControl('已验证向量模型', 'select').setValue('embed-a')
    await wrapper.get('#index-parameter-temperature').setValue('2')
    api.createIndex.mockResolvedValue({
      code: 201,
      message: 'ok',
      data: {
        id: 'index',
        name: '参数索引',
        modelVersionId: 'embed-a',
        parameters: {},
        status: 'building',
        total: 0,
        applied: 0,
        pending: 0,
        failed: 0,
      },
    })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.createIndex).toHaveBeenLastCalledWith({
      name: '参数索引',
      modelVersionId: 'embed-a',
      parameters: { temperature: 2, count: 0, enabled: false, mode: 'a' },
    })
    await wrapper.get('#index-parameter-temperature').setValue('7')
    expect(button('创建并构建索引').attributes('disabled')).toBeDefined()
    await labelControl('已验证向量模型', 'select').setValue('embed-b')
    expect(button('创建并构建索引').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('#index-parameter-temperature').exists()).toBe(false)
    await wrapper.get('#index-parameter-numericWeight').setValue('0')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.createIndex).toHaveBeenLastCalledWith({
      name: '参数索引',
      modelVersionId: 'embed-b',
      parameters: { numericWeight: 0 },
    })
    await wrapper.get('#index-parameter-numericWeight').setValue('')
    expect(button('创建并构建索引').attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.createIndex).toHaveBeenLastCalledWith({
      name: '参数索引',
      modelVersionId: 'embed-b',
      parameters: { numericWeight: 1 },
    })
  })
  it('reads model declarations after verification and displays fixed index parameters', async () => {
    await loadParameterModels()
    await button('模型登记').trigger('click')
    expect(wrapper.text()).toContain('从模型服务读取参数声明')
    const rows = wrapper.findAll('.model-catalog-table tbody tr').length
    const toggle = wrapper.get('[aria-label="查看 参数模型 的参数详情"]')
    await toggle.trigger('click')
    await flushPromises()
    const details = wrapper.get('dialog')
    expect(details.classes()).toContain('admin-dialog-right')
    expect(details.attributes('open')).toBeDefined()
    expect(wrapper.findAll('.model-catalog-table tbody tr')).toHaveLength(rows)
    expect(details.findAll('input, select')).toHaveLength(0)
    expect(details.get('table').text()).toContain('数值')
    expect(details.get('table').text()).toContain('0.25–4')
    expect(details.text()).not.toContain('留空')
    expect(details.get('details').attributes('open')).toBeUndefined()
    expect(details.get('details').text()).toContain('制品摘要')
    await details.get('[aria-label="关闭模型详情"]').trigger('click')
    await flushPromises()
    expect(details.attributes('open')).toBeUndefined()
    await toggle.trigger('click')
    await flushPromises()
    await details.trigger('cancel')
    await flushPromises()
    expect(details.attributes('open')).toBeUndefined()
    const data = catalog()
    data.indexes.push({
      id: 'index',
      name: '零权重索引',
      modelVersionId: 'ranker-ready',
      parameters: { weight: 0, enabled: false },
      status: 'ready',
      total: 0,
      applied: 0,
      pending: 0,
      failed: 0,
    })
    api.catalog.mockResolvedValue({ code: 200, message: 'ok', data })
    api.verifyModel.mockResolvedValue({ code: 200, message: 'ok', data: data.models[0] })
    await button('验证契约').trigger('click')
    await flushPromises()
    expect(api.verifyModel).toHaveBeenCalledWith('ranker-ready')
    await button('索引构建').trigger('click')
    await wrapper.get('[aria-label="查看 零权重索引 的固定参数"]').trigger('click')
    await flushPromises()
    const indexDrawer = wrapper.get('dialog')
    expect(indexDrawer.get('h2').text()).toBe('零权重索引')
    expect(indexDrawer.get('table').text()).toContain('固定值')
    expect(indexDrawer.get('table').text()).not.toContain('默认值')
    expect(
      indexDrawer.findAll('.parameter-values').map((row) => row.findAll('td')[1].text()),
    ).toEqual(['0', 'false'])
    expect(indexDrawer.text()).toContain('构建与查询共同使用以下参数')
    await indexDrawer.get('[aria-label="关闭索引详情"]').trigger('click')
    await flushPromises()
    expect(indexDrawer.attributes('open')).toBeUndefined()
  })
})
