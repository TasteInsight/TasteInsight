import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dishApi } from '@/api/modules/dish'
import { newsApi } from '@/api/modules/news'
import { reviewApi } from '@/api/modules/review'

const { post, remove } = vi.hoisted(() => ({ post: vi.fn(), remove: vi.fn() }))
vi.mock('@/utils/request', () => ({ default: { post, delete: remove } }))

describe('content batch-delete API', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['dishes', () => dishApi.batchDeleteDishes(['a', 'b'])],
    ['news', () => newsApi.batchDeleteNews(['a', 'b'])],
    ['reviews', () => reviewApi.batchDeleteReviews(['a', 'b'])],
    ['comments', () => reviewApi.batchDeleteComments(['a', 'b'])],
  ] as const)('posts one batch to %s and preserves its result', async (resource, submit) => {
    const result = { code: 200, message: '删除成功', data: { deletedCount: 2 } }
    post.mockResolvedValue(result)
    await expect(submit()).resolves.toBe(result)
    expect(post).toHaveBeenCalledExactlyOnceWith(`/admin/${resource}/batch-delete`, { ids: ['a', 'b'] })
    expect(remove).not.toHaveBeenCalled()
  })
})
