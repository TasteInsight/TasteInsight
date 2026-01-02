import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  // Keep each test isolated
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})
