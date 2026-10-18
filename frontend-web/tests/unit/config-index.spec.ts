import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeApiBaseUrl, resolveApiBaseUrl } from '@/config/env'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('API configuration', () => {
  it('normalizes surrounding whitespace and trailing slashes', () => {
    expect(normalizeApiBaseUrl('  http://example.test/api/v1///  ')).toBe(
      'http://example.test/api/v1',
    )
  })

  it('fails fast instead of silently targeting localhost', () => {
    expect(() => normalizeApiBaseUrl('')).toThrow('VITE_API_BASE_URL')
  })

  it('loads the explicit endpoint into the application config', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ' https://admin.example.invalid/api/v1/ ')
    vi.resetModules()
    const { default: config } = await import('@/config')
    expect(config.baseURL).toBe('https://admin.example.invalid/api/v1')
  })
})

it('keeps runtime target independent of build mode', () => {
  expect(resolveApiBaseUrl(undefined, false)).toBe('http://localhost:3001')
  expect(resolveApiBaseUrl(undefined, true)).toBe('/api/v1')
  for (const production of [false, true]) {
    expect(resolveApiBaseUrl('https://admin.example.invalid/api/v1/', production)).toBe(
      'https://admin.example.invalid/api/v1',
    )
    expect(() => resolveApiBaseUrl('', production)).toThrow('VITE_API_BASE_URL')
  }
})
