import { beforeEach, describe, expect, it, vi } from 'vitest'
const request = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/utils/request', () => ({ default: request }))
import { contentModerationApi } from '@/api/modules/content-moderation'
beforeEach(() => vi.resetAllMocks())
describe('contentModerationApi', () => {
  it('reads and updates the unified settings atomically', async () => {
    await contentModerationApi.getPolicy()
    expect(request.get).toHaveBeenCalledWith('/admin/content-moderation/policy')
    await contentModerationApi.getSettings()
    expect(request.get).toHaveBeenCalledWith('/admin/content-moderation/settings')
    const policy = { enabled: true, provider: 'aliyun', mode: 'machine_and_manual' } as const
    await contentModerationApi.updateSettings(policy)
    expect(request.put).toHaveBeenCalledWith('/admin/content-moderation/settings', policy)
  })
  it('sends the selected task status and page, and encodes task IDs for decisions', async () => {
    const query = { status: 'failed', page: 2, pageSize: 20 } as const
    await contentModerationApi.getTasks(query)
    expect(request.get).toHaveBeenCalledWith('/admin/content-moderation/tasks', { params: query })
    await contentModerationApi.decide('task/a', { approved: false, reason: '请修改' })
    expect(request.post).toHaveBeenCalledWith('/admin/content-moderation/tasks/task%2Fa/decision', { approved: false, reason: '请修改' })
  })
})
