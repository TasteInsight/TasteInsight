import { describe, expect, it } from 'vitest'

describe('store/index', () => {
  it('exports a pinia instance and store helpers', async () => {
    const storeIndex = await import('@/store')

    expect(storeIndex.default).toBeTruthy()
    expect(typeof storeIndex.useAuthStore).toBe('function')
    expect(typeof storeIndex.useDishStore).toBe('function')
  })
})
