import { beforeEach, describe, expect, it, vi } from 'vitest'
import { studentVerificationApi } from '@/api/modules/student-verification'
import { communityApi } from '@/api/modules/community'

const request = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/utils/request', () => ({ default: request }))

describe('campus and community admin API contracts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends student status, pagination and cancellation to the admin-only list', async () => {
    const params = { page: 2, pageSize: 20, status: 'REVOKED' as const }
    const signal = new AbortController().signal
    await studentVerificationApi.list(params, signal)
    expect(request.get).toHaveBeenCalledWith('/admin/student-verifications', { params, signal })
  })

  it('submits only the decision, evidence, expiry and reviewed version', async () => {
    const data = {
      decision: 'APPROVE' as const,
      reason: '已核验',
      expiresAt: '2027-01-01T00:00:00.000Z',
      expectedUpdatedAt: '2026-10-09T00:00:00.000Z',
    }
    await studentVerificationApi.decide('user/1', data)
    expect(request.post).toHaveBeenCalledWith(
      '/admin/student-verifications/user%2F1/decision',
      data,
    )
  })

  it.each(['posts', 'post-comments'] as const)(
    'uses the state-filtered %s list and CAS moderation endpoints',
    async (type) => {
      const params = { page: 1, pageSize: 20, status: 'approved' as const }
      const signal = new AbortController().signal
      await communityApi.list(type, params, signal)
      expect(request.get).toHaveBeenCalledWith(`/admin/${type}`, { params, signal })
      const version = { expectedUpdatedAt: '2026-10-09T00:00:00.000Z' }
      await communityApi.approve(type, 'id/1', version)
      expect(request.post).toHaveBeenCalledWith(`/admin/${type}/id%2F1/approve`, version)
      await communityApi.reject(type, 'id/1', { ...version, reason: '违规' })
      expect(request.post).toHaveBeenCalledWith(`/admin/${type}/id%2F1/reject`, {
        ...version,
        reason: '违规',
      })
      await communityApi.delete(type, 'id/1')
      expect(request.delete).toHaveBeenCalledWith(`/admin/${type}/id%2F1`)
    },
  )
})
