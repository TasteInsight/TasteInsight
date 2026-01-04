import { describe, expect, it, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/utils/request', () => {
  return {
    default: {
      get: getMock,
      post: postMock,
    },
  }
})

describe('api/recommendApi', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
  })

  it('getRecommend calls POST /recommend with params', async () => {
    const params = { userId: 'u1', limit: 10 }
    postMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.getRecommend(params as any)

    expect(postMock).toHaveBeenCalledWith('/recommend', params)
  })

  it('getSimilarRecommend calls POST /recommend/similar/:dishId', async () => {
    const params = { limit: 5 }
    postMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.getSimilarRecommend('dish1', params as any)

    expect(postMock).toHaveBeenCalledWith('/recommend/similar/dish1', params)
  })

  it('getPersonalRecommend calls POST /recommend/personal', async () => {
    const params = { userId: 'u1', limit: 10 }
    postMock.mockResolvedValueOnce({ code: 200, data: { items: [] } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.getPersonalRecommend(params as any)

    expect(postMock).toHaveBeenCalledWith('/recommend/personal', params)
  })

  it('recordClickEvent calls POST /recommend/events/click', async () => {
    const params = { userId: 'u1', dishId: 'd1', requestId: 'r1' }
    postMock.mockResolvedValueOnce({ code: 200, data: { eventId: 'e1' } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.recordClickEvent(params as any)

    expect(postMock).toHaveBeenCalledWith('/recommend/events/click', params)
  })

  it('recordFavoriteEvent calls POST /recommend/events/favorite', async () => {
    const params = { userId: 'u1', dishId: 'd1', action: 'add' }
    postMock.mockResolvedValueOnce({ code: 200, data: { eventId: 'e2' } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.recordFavoriteEvent(params as any)

    expect(postMock).toHaveBeenCalledWith('/recommend/events/favorite', params)
  })

  it('recordReviewEvent calls POST /recommend/events/review', async () => {
    const params = { userId: 'u1', dishId: 'd1', rating: 5 }
    postMock.mockResolvedValueOnce({ code: 200, data: { eventId: 'e3' } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.recordReviewEvent(params as any)

    expect(postMock).toHaveBeenCalledWith('/recommend/events/review', params)
  })

  it('recordDislikeEvent calls POST /recommend/events/dislike', async () => {
    const params = { userId: 'u1', dishId: 'd1', reason: 'not_interested' }
    postMock.mockResolvedValueOnce({ code: 200, data: { eventId: 'e4' } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.recordDislikeEvent(params as any)

    expect(postMock).toHaveBeenCalledWith('/recommend/events/dislike', params)
  })

  it('getEventChain calls GET /recommend/events/chain/:requestId', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: { events: [] } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.getEventChain('req1')

    expect(getMock).toHaveBeenCalledWith('/recommend/events/chain/req1')
  })

  it('getFunnelAnalytics calls GET /recommend/analytics/funnel with params', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: {} })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.getFunnelAnalytics({ days: 7 } as any)

    expect(getMock).toHaveBeenCalledWith('/recommend/analytics/funnel', {
      params: { days: 7 },
    })
  })

  it('getFunnelAnalytics works without params', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: {} })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.getFunnelAnalytics()

    expect(getMock).toHaveBeenCalledWith('/recommend/analytics/funnel', {
      params: undefined,
    })
  })

  it('getExperimentGroup calls GET /recommend/experiment/:experimentId/group', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: { group: 'control' } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.getExperimentGroup('exp1')

    expect(getMock).toHaveBeenCalledWith('/recommend/experiment/exp1/group')
  })

  it('getHealth calls GET /recommend/health', async () => {
    getMock.mockResolvedValueOnce({ code: 200, data: { status: 'healthy' } })

    const { recommendApi } = await import('@/api/modules/recommend')
    await recommendApi.getHealth()

    expect(getMock).toHaveBeenCalledWith('/recommend/health')
  })
})

