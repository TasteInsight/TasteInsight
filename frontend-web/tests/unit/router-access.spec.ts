import { describe, expect, it } from 'vitest'

import { getFirstAccessibleRoute } from '@/router/access'

describe('router/getFirstAccessibleRoute', () => {
  it('returns first permitted route by priority', () => {
    const authStore = {
      hasPermission: (p: string) => p === 'news:view',
    } as any

    expect(getFirstAccessibleRoute(authStore)).toBe('/news-manage')
  })

  it('returns /single-add when none permitted', () => {
    const authStore = {
      hasPermission: () => false,
    } as any

    expect(getFirstAccessibleRoute(authStore)).toBe('/single-add')
  })
})
