import { describe, expect, it, vi } from 'vitest'

describe('config/index', () => {
  it('uses env baseURL when set', async () => {
    vi.resetModules()

    const envModule = await import('@/config/env')
    envModule.env.VITE_API_BASE_URL = 'http://example.test/'

    const configModule = await import('@/config')
    expect(configModule.default.baseURL).toBe('http://example.test/')
  })

  it('falls back to empty string when env baseURL is empty', async () => {
    vi.resetModules()

    const envModule = await import('@/config/env')
    envModule.env.VITE_API_BASE_URL = ''

    const configModule = await import('@/config')
    expect(configModule.default.baseURL).toBe('')
  })
})
