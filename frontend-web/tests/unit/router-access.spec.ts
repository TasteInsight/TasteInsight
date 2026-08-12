import { describe, expect, it } from 'vitest'

import { getFirstAccessibleRoute } from '@/router/access'

describe('router/getFirstAccessibleRoute', () => {
  it('returns first permitted route by priority', () => {
    const authStore = {
      hasPermission: (p: string) => p === 'news:view',
    } as any

    expect(getFirstAccessibleRoute(authStore)).toBe('/news-manage')
  })

  it('returns a stable no-permission route when none permitted', () => {
    const authStore = {
      hasPermission: () => false,
    } as any

    expect(getFirstAccessibleRoute(authStore)).toBe('/forbidden')
  })

  it('allows either moderation permission to reach the combined review page', () => {
    const authStore = {
      hasPermission: (permission: string) => permission === 'comment:approve',
    } as any

    expect(getFirstAccessibleRoute(authStore)).toBe('/review-manage')
  })

  it('only exposes deletion management when dish browsing is also allowed', () => {
    const deleteOnlyStore = {
      hasPermission: (permission: string) => permission === 'comment:delete',
    } as any
    const completeStore = {
      hasPermission: (permission: string) =>
        ['dish:view', 'comment:delete'].includes(permission),
    } as any

    expect(getFirstAccessibleRoute(deleteOnlyStore)).toBe('/forbidden')
    expect(getFirstAccessibleRoute(completeStore)).toBe('/modify-dish')
  })
})
