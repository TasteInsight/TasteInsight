import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  experimentApi: {
    getExperiments: vi.fn(),
    getExperimentById: vi.fn(),
    createExperiment: vi.fn(),
    updateExperiment: vi.fn(),
    deleteExperiment: vi.fn(),
    enableExperiment: vi.fn(),
    disableExperiment: vi.fn(),
    completeExperiment: vi.fn(),
  },
  authStoreMock: {
    hasPermission: vi.fn(() => true),
  },
  showAlertMock: vi.fn(() => Promise.resolve()),
  showConfirmDangerMock: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('@/api/modules/experiment', () => ({
  experimentApi: mocks.experimentApi,
}))

vi.mock('@/store/modules/use-auth-store', () => ({
  useAuthStore: () => mocks.authStoreMock,
}))

vi.mock('@/composables/useModal', () => ({
  showAlert: mocks.showAlertMock,
  showConfirm: vi.fn(() => Promise.resolve(true)),
  showConfirmDanger: mocks.showConfirmDangerMock,
}))

import ExperimentManage from '../../src/views/ExperimentManage.vue'

const flushAll = async () => {
  await flushPromises()
  await nextTick()
}

const baseMountOptions = {
  global: {
    stubs: {
      Header: defineComponent({ name: 'HeaderStub', template: '<div />' }),
      Teleport: true,
      Transition: false,
    },
  },
}

const mockExperiment = {
  id: 'exp1',
  name: '测试实验',
  description: '测试描述',
  status: 'draft',
  trafficRatio: 0.1,
  startTime: '2025-01-01T00:00:00.000Z',
  endTime: '2025-12-31T23:59:59.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
  groups: [
    {
      name: '对照组',
      ratio: 0.5,
      config: {
        weights: { preferenceMatch: 0.3, dishQuality: 0.7 },
        recallQuota: { vectorQuota: 0.5, ruleQuota: 0.3, collaborativeQuota: 0.2 },
      },
    },
    {
      name: '实验组',
      ratio: 0.5,
      config: {},
    },
  ],
}

describe('views/ExperimentManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    mocks.experimentApi.getExperiments.mockResolvedValue({
      code: 200,
      data: { items: [mockExperiment], meta: { total: 1 } },
    })
  })

  describe('List View', () => {
    it('renders list view and loads experiments on mount', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(mocks.experimentApi.getExperiments).toHaveBeenCalled()
      expect(wrapper.vm.viewMode).toBe('list')
      expect(wrapper.vm.experimentList).toHaveLength(1)
    })

    it('handles getExperiments returning array directly', async () => {
      mocks.experimentApi.getExperiments.mockResolvedValueOnce({
        code: 200,
        data: [mockExperiment],
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.experimentList).toHaveLength(1)
    })

    it('handles getExperiments error', async () => {
      mocks.experimentApi.getExperiments.mockRejectedValueOnce(new Error('Network error'))

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(mocks.showAlertMock).toHaveBeenCalledWith('加载实验列表失败，请稍后重试', '错误')
    })

    it('handles getExperiments non-200 response', async () => {
      mocks.experimentApi.getExperiments.mockResolvedValueOnce({
        code: 500,
        message: '服务器错误',
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(mocks.showAlertMock).toHaveBeenCalledWith('服务器错误', '错误')
    })

    it('filters experiments by search query', async () => {
      mocks.experimentApi.getExperiments.mockResolvedValueOnce({
        code: 200,
        data: {
          items: [
            { id: 'exp1', name: '测试实验A', description: '描述A', status: 'draft', trafficRatio: 0.1, groups: [] },
            { id: 'exp2', name: '实验B', description: '测试', status: 'running', trafficRatio: 0.2, groups: [] },
          ],
        },
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.filteredExperiments).toHaveLength(2)

      wrapper.vm.searchQuery = '测试'
      await nextTick()
      expect(wrapper.vm.filteredExperiments).toHaveLength(2) // Both match '测试'

      wrapper.vm.searchQuery = '实验B'
      await nextTick()
      expect(wrapper.vm.filteredExperiments).toHaveLength(1)
    })

    it('filters out invalid experiments', async () => {
      mocks.experimentApi.getExperiments.mockResolvedValueOnce({
        code: 200,
        data: {
          items: [
            { id: 'exp1', name: '有效实验', status: 'draft', trafficRatio: 0.1, groups: [] },
            { id: '', name: '无效实验', status: 'draft', trafficRatio: 0.1, groups: [] },
            { id: 'exp2', name: '', status: 'draft', trafficRatio: 0.1, groups: [] },
            null,
          ],
        },
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.filteredExperiments).toHaveLength(1)
    })
  })

  describe('Detail View', () => {
    it('viewExperiment loads detail and switches to detail view', async () => {
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: mockExperiment,
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.viewExperiment(mockExperiment)
      await flushAll()

      expect(mocks.experimentApi.getExperimentById).toHaveBeenCalledWith('exp1')
      expect(wrapper.vm.viewMode).toBe('detail')
      expect(wrapper.vm.currentExperiment).toEqual(mockExperiment)
    })

    it('viewExperiment handles invalid experiment', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.viewExperiment({ id: '', name: 'test' } as any)

      expect(mocks.showAlertMock).toHaveBeenCalledWith('无效的实验数据', '错误')
    })

    it('viewExperiment handles API error', async () => {
      mocks.experimentApi.getExperimentById.mockRejectedValueOnce(new Error('error'))

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.viewExperiment(mockExperiment)
      await flushAll()

      expect(mocks.showAlertMock).toHaveBeenCalledWith('加载实验详情失败，请稍后重试', '错误')
    })

    it('viewGroupDetail switches to groupDetail view', async () => {
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: mockExperiment,
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.viewExperiment(mockExperiment)
      await flushAll()

      wrapper.vm.viewGroupDetail(mockExperiment.groups[0], 0)
      await nextTick()

      expect(wrapper.vm.viewMode).toBe('groupDetail')
      expect(wrapper.vm.currentGroup).toEqual(mockExperiment.groups[0])
    })

    it('backToDetail returns to detail view', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.viewMode = 'groupDetail'
      wrapper.vm.currentGroup = mockExperiment.groups[0]

      wrapper.vm.backToDetail()
      await nextTick()

      expect(wrapper.vm.viewMode).toBe('detail')
      expect(wrapper.vm.currentGroup).toBeNull()
    })

    it('backToList returns to list view and reloads', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.viewMode = 'detail'
      wrapper.vm.currentExperiment = mockExperiment

      await wrapper.vm.backToList()
      await flushAll()

      expect(wrapper.vm.viewMode).toBe('list')
      expect(wrapper.vm.currentExperiment).toBeNull()
      expect(mocks.experimentApi.getExperiments).toHaveBeenCalledTimes(2)
    })
  })

  describe('Create/Edit View', () => {
    it('createNewExperiment switches to edit view with empty form', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      await nextTick()

      expect(wrapper.vm.viewMode).toBe('edit')
      expect(wrapper.vm.editingExperiment).toBeNull()
      expect(wrapper.vm.formData.name).toBe('')
    })

    it('editExperiment loads experiment and populates form', async () => {
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: mockExperiment,
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.editExperiment(mockExperiment)
      await flushAll()

      expect(wrapper.vm.viewMode).toBe('edit')
      expect(wrapper.vm.editingExperiment).toEqual(mockExperiment)
      expect(wrapper.vm.formData.name).toBe('测试实验')
      expect(wrapper.vm.formData.trafficRatio).toBe(0.1)
    })

    it('editExperiment handles invalid experiment', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.editExperiment({ id: '' } as any)

      expect(mocks.showAlertMock).toHaveBeenCalledWith('无效的实验数据', '错误')
    })

    it('addGroup and removeGroup work correctly', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      await nextTick()

      expect(wrapper.vm.formData.groups).toHaveLength(0)

      wrapper.vm.addGroup()
      await nextTick()
      expect(wrapper.vm.formData.groups).toHaveLength(1)

      wrapper.vm.addGroup()
      await nextTick()
      expect(wrapper.vm.formData.groups).toHaveLength(2)

      wrapper.vm.removeGroup(0)
      await nextTick()
      expect(wrapper.vm.formData.groups).toHaveLength(1)
    })

    it('distributeGroupRatiosEvenly distributes ratios equally', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      wrapper.vm.addGroup()
      wrapper.vm.addGroup()
      wrapper.vm.addGroup()
      await nextTick()

      wrapper.vm.distributeGroupRatiosEvenly()
      await nextTick()

      const totalRatio = wrapper.vm.formData.groups.reduce((sum: number, g: any) => sum + g.ratio, 0)
      expect(Math.abs(totalRatio - 1)).toBeLessThan(0.01)
    })

    it('groupRatioStatus computed correctly', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      wrapper.vm.formData.groups = [
        { name: 'A', ratio: 0.5, config: {} },
        { name: 'B', ratio: 0.5, config: {} },
      ]
      await nextTick()

      expect(wrapper.vm.groupRatioStatus.total).toBeCloseTo(1, 2)
      expect(wrapper.vm.groupRatioStatus.isValid).toBe(true)

      wrapper.vm.formData.groups[1].ratio = 0.3
      await nextTick()

      expect(wrapper.vm.groupRatioStatus.total).toBeCloseTo(0.8, 2)
      expect(wrapper.vm.groupRatioStatus.isValid).toBe(false)
    })

    it('submitForm validates required fields', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      await nextTick()

      await wrapper.vm.submitForm()

      expect(mocks.showAlertMock).toHaveBeenCalled()
      const alertCall = mocks.showAlertMock.mock.calls.find(
        (call: any[]) => call[1] === '表单验证失败'
      )
      expect(alertCall).toBeTruthy()
    })

    it('submitForm creates experiment successfully', async () => {
      mocks.experimentApi.createExperiment.mockResolvedValueOnce({
        code: 201,
        data: mockExperiment,
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      wrapper.vm.formData.name = '新实验'
      wrapper.vm.formData.trafficRatio = 0.1
      wrapper.vm.formData.startTime = '2025-01-01T00:00'
      wrapper.vm.formData.groups = [
        { name: '对照组', ratio: 0.5, config: {} },
        { name: '实验组', ratio: 0.5, config: {} },
      ]
      await nextTick()

      await wrapper.vm.submitForm()
      await flushAll()

      expect(mocks.experimentApi.createExperiment).toHaveBeenCalled()
      expect(mocks.showAlertMock).toHaveBeenCalledWith('实验已创建', '成功')
      expect(wrapper.vm.viewMode).toBe('list')
    })

    it('submitForm updates experiment successfully', async () => {
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: mockExperiment,
      })
      mocks.experimentApi.updateExperiment.mockResolvedValueOnce({
        code: 200,
        data: mockExperiment,
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.editExperiment(mockExperiment)
      await flushAll()

      await wrapper.vm.submitForm()
      await flushAll()

      expect(mocks.experimentApi.updateExperiment).toHaveBeenCalledWith(
        'exp1',
        expect.any(Object)
      )
      expect(mocks.showAlertMock).toHaveBeenCalledWith('实验已更新', '成功')
    })

    it('submitForm handles API error', async () => {
      mocks.experimentApi.createExperiment.mockRejectedValueOnce(new Error('创建失败'))

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      wrapper.vm.formData.name = '新实验'
      wrapper.vm.formData.trafficRatio = 0.1
      wrapper.vm.formData.startTime = '2025-01-01T00:00'
      wrapper.vm.formData.groups = [{ name: '对照组', ratio: 1, config: {} }]
      await nextTick()

      await wrapper.vm.submitForm()
      await flushAll()

      expect(mocks.showAlertMock).toHaveBeenCalledWith('创建失败', '错误')
    })

    it('submitForm validates trafficRatio', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      wrapper.vm.formData.name = '新实验'
      wrapper.vm.formData.trafficRatio = 2 // Invalid
      wrapper.vm.formData.startTime = '2025-01-01T00:00'
      wrapper.vm.formData.groups = [{ name: '对照组', ratio: 1, config: {} }]
      await nextTick()

      await wrapper.vm.submitForm()

      expect(wrapper.vm.errors.trafficRatio).toBe('流量占比必须在0到1之间')
    })

    it('submitForm validates endTime after startTime', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      wrapper.vm.formData.name = '新实验'
      wrapper.vm.formData.trafficRatio = 0.1
      wrapper.vm.formData.startTime = '2025-12-01T00:00'
      wrapper.vm.formData.endTime = '2025-01-01T00:00' // Before start
      wrapper.vm.formData.groups = [{ name: '对照组', ratio: 1, config: {} }]
      await nextTick()

      await wrapper.vm.submitForm()

      expect(mocks.showAlertMock).toHaveBeenCalled()
    })
  })

  describe('Experiment Actions', () => {
    it('deleteExperiment deletes successfully', async () => {
      mocks.experimentApi.deleteExperiment.mockResolvedValueOnce({ code: 200 })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.deleteExperiment(mockExperiment)
      await flushAll()

      expect(mocks.showConfirmDangerMock).toHaveBeenCalled()
      expect(mocks.experimentApi.deleteExperiment).toHaveBeenCalledWith('exp1')
      expect(mocks.showAlertMock).toHaveBeenCalledWith('实验已删除', '成功')
    })

    it('deleteExperiment handles cancel', async () => {
      mocks.showConfirmDangerMock.mockResolvedValueOnce(false)

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.deleteExperiment(mockExperiment)

      expect(mocks.experimentApi.deleteExperiment).not.toHaveBeenCalled()
    })

    it('deleteExperiment handles invalid experiment', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.deleteExperiment({ id: '' } as any)

      expect(mocks.showAlertMock).toHaveBeenCalledWith('无效的实验数据，无法删除', '错误')
    })

    it('enableExperiment enables successfully', async () => {
      mocks.experimentApi.enableExperiment.mockResolvedValueOnce({ code: 200 })
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: { ...mockExperiment, status: 'running' },
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.enableExperiment(mockExperiment)
      await flushAll()

      expect(mocks.experimentApi.enableExperiment).toHaveBeenCalledWith('exp1')
      expect(mocks.showAlertMock).toHaveBeenCalledWith('实验已启用', '成功')
    })

    it('disableExperiment pauses successfully', async () => {
      mocks.experimentApi.disableExperiment.mockResolvedValueOnce({ code: 200 })
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: { ...mockExperiment, status: 'paused' },
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.disableExperiment(mockExperiment)
      await flushAll()

      expect(mocks.showConfirmDangerMock).toHaveBeenCalled()
      expect(mocks.experimentApi.disableExperiment).toHaveBeenCalledWith('exp1')
      expect(mocks.showAlertMock).toHaveBeenCalledWith('实验已暂停', '成功')
    })

    it('completeExperiment completes successfully', async () => {
      mocks.experimentApi.completeExperiment.mockResolvedValueOnce({ code: 200 })
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: { ...mockExperiment, status: 'completed' },
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.completeExperiment(mockExperiment)
      await flushAll()

      expect(mocks.showConfirmDangerMock).toHaveBeenCalled()
      expect(mocks.experimentApi.completeExperiment).toHaveBeenCalledWith('exp1')
      expect(mocks.showAlertMock).toHaveBeenCalledWith('实验已完成', '成功')
    })
  })

  describe('Group Config Modal', () => {
    it('editGroupConfig opens modal with config', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      const group = mockExperiment.groups[0]
      wrapper.vm.editGroupConfig(group, 0)
      await nextTick()

      expect(wrapper.vm.showGroupConfigModal).toBe(true)
      expect(wrapper.vm.groupConfigForm.weights.preferenceMatch).toBe(0.3)
    })

    it('closeGroupConfigModal closes modal and resets form', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.showGroupConfigModal = true
      wrapper.vm.groupConfigForm.weights.preferenceMatch = 0.5

      wrapper.vm.closeGroupConfigModal()
      await nextTick()

      expect(wrapper.vm.showGroupConfigModal).toBe(false)
      expect(wrapper.vm.groupConfigForm.weights.preferenceMatch).toBe(0)
    })

    it('saveGroupConfig saves config in edit mode', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      wrapper.vm.formData.groups = [{ name: '对照组', ratio: 0.5, config: {} }]
      wrapper.vm.editGroupConfig(wrapper.vm.formData.groups[0], 0)
      
      wrapper.vm.groupConfigForm.weights.preferenceMatch = 0.3
      wrapper.vm.groupConfigForm.recallQuota.vectorQuota = 0.5
      wrapper.vm.groupConfigForm.recallQuota.ruleQuota = 0.3
      wrapper.vm.groupConfigForm.recallQuota.collaborativeQuota = 0.2
      await nextTick()

      await wrapper.vm.saveGroupConfig()
      await flushAll()

      expect(wrapper.vm.formData.groups[0].config?.weights?.preferenceMatch).toBe(0.3)
      expect(wrapper.vm.showGroupConfigModal).toBe(false)
    })

    it('saveGroupConfig validates recallQuota total', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.createNewExperiment()
      wrapper.vm.formData.groups = [{ name: '对照组', ratio: 0.5, config: {} }]
      wrapper.vm.editGroupConfig(wrapper.vm.formData.groups[0], 0)
      
      wrapper.vm.groupConfigForm.recallQuota.vectorQuota = 0.5
      wrapper.vm.groupConfigForm.recallQuota.ruleQuota = 0.5
      wrapper.vm.groupConfigForm.recallQuota.collaborativeQuota = 0.5 // Total > 1
      await nextTick()

      await wrapper.vm.saveGroupConfig()

      expect(mocks.showAlertMock).toHaveBeenCalledWith(expect.stringContaining('召回配额总和应为1'), '错误')
    })

    it('recallQuotaTotal computed correctly', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      wrapper.vm.groupConfigForm.recallQuota.vectorQuota = 0.3
      wrapper.vm.groupConfigForm.recallQuota.ruleQuota = 0.4
      wrapper.vm.groupConfigForm.recallQuota.collaborativeQuota = 0.3
      await nextTick()

      expect(wrapper.vm.recallQuotaTotal).toBeCloseTo(1, 2)
    })

    it('deleteGroup in detail view updates experiment', async () => {
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: mockExperiment,
      })
      mocks.experimentApi.updateExperiment.mockResolvedValueOnce({ code: 200 })
      mocks.experimentApi.getExperimentById.mockResolvedValueOnce({
        code: 200,
        data: { ...mockExperiment, groups: [mockExperiment.groups[1]] },
      })

      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      await wrapper.vm.viewExperiment(mockExperiment)
      await flushAll()

      await wrapper.vm.deleteGroup(0)
      await flushAll()

      expect(mocks.showConfirmDangerMock).toHaveBeenCalled()
      expect(mocks.experimentApi.updateExperiment).toHaveBeenCalled()
    })
  })

  describe('Helper Functions', () => {
    it('formatDate formats date correctly', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.formatDate('')).toBe('-')
      expect(wrapper.vm.formatDate(undefined)).toBe('-')
      expect(wrapper.vm.formatDate('invalid')).toBe('-')
      expect(typeof wrapper.vm.formatDate('2025-01-01T00:00:00.000Z')).toBe('string')
    })

    it('getStatusLabel returns correct labels', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.getStatusLabel('draft')).toBe('草稿')
      expect(wrapper.vm.getStatusLabel('running')).toBe('运行中')
      expect(wrapper.vm.getStatusLabel('paused')).toBe('已暂停')
      expect(wrapper.vm.getStatusLabel('completed')).toBe('已完成')
      expect(wrapper.vm.getStatusLabel(undefined)).toBe('草稿')
    })

    it('getStatusClass returns correct classes', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.getStatusClass('draft')).toContain('bg-gray-100')
      expect(wrapper.vm.getStatusClass('running')).toContain('bg-green-100')
      expect(wrapper.vm.getStatusClass('paused')).toContain('bg-yellow-100')
      expect(wrapper.vm.getStatusClass('completed')).toContain('bg-blue-100')
    })

    it('getEffectiveStatus returns correct status', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      const draftExp = { ...mockExperiment, status: 'draft' }
      expect(wrapper.vm.getEffectiveStatus(draftExp)).toBeNull()

      const runningExp = {
        ...mockExperiment,
        status: 'running',
        startTime: new Date(Date.now() - 1000).toISOString(),
        endTime: new Date(Date.now() + 100000).toISOString(),
      }
      expect(wrapper.vm.getEffectiveStatus(runningExp)).toBe('active')

      const futureExp = {
        ...mockExperiment,
        status: 'running',
        startTime: new Date(Date.now() + 100000).toISOString(),
      }
      expect(wrapper.vm.getEffectiveStatus(futureExp)).toBe('inactive')
    })

    it('getWeightLabel returns correct labels', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.getWeightLabel('preferenceMatch')).toBe('偏好匹配')
      expect(wrapper.vm.getWeightLabel('dishQuality')).toBe('菜品质量')
      expect(wrapper.vm.getWeightLabel('unknown')).toBe('unknown')
    })

    it('getRecallQuotaLabel returns correct labels', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.getRecallQuotaLabel('vectorQuota')).toBe('向量召回配额')
      expect(wrapper.vm.getRecallQuotaLabel('ruleQuota')).toBe('规则召回配额')
      expect(wrapper.vm.getRecallQuotaLabel('unknown')).toBe('unknown')
    })

    it('formatPercentage formats values correctly', async () => {
      const wrapper = shallowMount(ExperimentManage, baseMountOptions)
      await flushAll()

      expect(wrapper.vm.formatPercentage(0.5)).toBe('50.0')
      expect(wrapper.vm.formatPercentage(null)).toBe('0.0')
      expect(wrapper.vm.formatPercentage(undefined)).toBe('0.0')
      expect(wrapper.vm.formatPercentage('invalid')).toBe('0.0')
    })
  })
})

