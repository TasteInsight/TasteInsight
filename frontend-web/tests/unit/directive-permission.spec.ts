import { describe, expect, it, vi, beforeEach } from 'vitest'
import { permission } from '@/directives/permission'

const hasPermissionMock = vi.fn()
const hasAnyPermissionMock = vi.fn()

vi.mock('@/store/modules/use-auth-store', () => {
  return {
    useAuthStore: () => ({
      hasPermission: hasPermissionMock,
      hasAnyPermission: hasAnyPermissionMock,
    }),
  }
})

describe('directives/permission', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset()
    hasAnyPermissionMock.mockReset()
  })

  it('removes element when array permissions are not satisfied', () => {
    hasAnyPermissionMock.mockReturnValue(false)

    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    permission.mounted!(el as any, { value: ['a', 'b'] } as any)

    expect(parent.contains(el)).toBe(false)
  })

  it('keeps element when array permissions are satisfied', () => {
    hasAnyPermissionMock.mockReturnValue(true)

    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    permission.mounted!(el as any, { value: ['a', 'b'] } as any)

    expect(parent.contains(el)).toBe(true)
  })

  it('keeps element when string permission is satisfied', () => {
    hasPermissionMock.mockReturnValue(true)

    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    permission.mounted!(el as any, { value: 'dish:view' } as any)

    expect(parent.contains(el)).toBe(true)
  })

  it('removes element when string permission is not satisfied', () => {
    hasPermissionMock.mockReturnValue(false)

    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    permission.mounted!(el as any, { value: 'dish:edit' } as any)

    expect(parent.contains(el)).toBe(false)
  })

  it('throws when binding value is invalid', () => {
    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    expect(() => permission.mounted!(el as any, { value: null } as any)).toThrow('need roles!')
  })
})
