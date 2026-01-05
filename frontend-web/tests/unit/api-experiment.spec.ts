import { describe, expect, it, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const postMock = vi.fn()
const putMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/utils/request', () => {
  return {
    default: {
      get: getMock,
      post: postMock,
      put: putMock,
      delete: deleteMock,
    },
  }
})

describe('api/experimentApi', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    deleteMock.mockReset()
  })

  it('getExperiments calls GET /admin/experiments', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: [] })

    const { experimentApi } = await import('@/api/modules/experiment')
    const res = await experimentApi.getExperiments()

    expect(getMock).toHaveBeenCalledWith('/admin/experiments')
    expect(res.code).toBe(200)
  })

  it('createExperiment calls POST /admin/experiments with params', async () => {
    const createData = { name: 'Test Experiment', description: 'Test' }
    postMock.mockResolvedValueOnce({ code: 200, data: { id: 'exp1', ...createData } })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.createExperiment(createData as any)

    expect(postMock).toHaveBeenCalledWith('/admin/experiments', createData)
  })

  it('getExperimentById calls GET /admin/experiments/:id', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: { id: 'exp1' } })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.getExperimentById('exp1')

    expect(getMock).toHaveBeenCalledWith('/admin/experiments/exp1')
  })

  it('updateExperiment calls PUT /admin/experiments/:id', async () => {
    const updateData = { name: 'Updated Experiment' }
    putMock.mockResolvedValueOnce({ code: 200, data: { id: 'exp1', ...updateData } })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.updateExperiment('exp1', updateData as any)

    expect(putMock).toHaveBeenCalledWith('/admin/experiments/exp1', updateData)
  })

  it('deleteExperiment calls DELETE /admin/experiments/:id', async () => {
    deleteMock.mockResolvedValueOnce({ code: 200 })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.deleteExperiment('exp1')

    expect(deleteMock).toHaveBeenCalledWith('/admin/experiments/exp1')
  })

  it('enableExperiment calls POST /admin/experiments/:id/enable', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.enableExperiment('exp1')

    expect(postMock).toHaveBeenCalledWith('/admin/experiments/exp1/enable')
  })

  it('disableExperiment calls POST /admin/experiments/:id/disable', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.disableExperiment('exp1')

    expect(postMock).toHaveBeenCalledWith('/admin/experiments/exp1/disable')
  })

  it('completeExperiment calls POST /admin/experiments/:id/complete', async () => {
    postMock.mockResolvedValueOnce({ code: 200 })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.completeExperiment('exp1')

    expect(postMock).toHaveBeenCalledWith('/admin/experiments/exp1/complete')
  })

  it('evaluateRecallQuality calls GET /admin/recall-quality/evaluate with params', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: {} })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.evaluateRecallQuality({ k: 10, days: 7 } as any)

    expect(getMock).toHaveBeenCalledWith('/admin/recall-quality/evaluate', {
      params: { k: 10, days: 7 },
    })
  })

  it('evaluateRecallQuality works without params', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: {} })

    const { experimentApi } = await import('@/api/modules/experiment')
    await experimentApi.evaluateRecallQuality()

    expect(getMock).toHaveBeenCalledWith('/admin/recall-quality/evaluate', {
      params: undefined,
    })
  })
})

