import { describe, expect, it } from 'vitest'
import config from '@/config'
import { normalizeApiBaseUrl } from '@/config/env'

describe('API configuration', () => {
  it('normalizes surrounding whitespace and trailing slashes', () => {
    expect(normalizeApiBaseUrl('  http://example.test/api/v1///  ')).toBe(
      'http://example.test/api/v1',
    )
  })

  it('fails fast instead of silently targeting localhost', () => {
    expect(() => normalizeApiBaseUrl('')).toThrow('VITE_API_BASE_URL')
  })

  it('loads the endpoint for the current Vite mode', () => {
    expect(config.baseURL).toBe('http://localhost:3001')
  })
})
