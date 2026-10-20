import { describe, expect, it, vi, beforeEach } from 'vitest'
import { h, type DirectiveBinding } from 'vue'
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

function mountPermission(el: HTMLElement, value: unknown) {
  const binding: DirectiveBinding = { value, oldValue: undefined, arg: undefined, modifiers: {}, instance: null, dir: permission }
  permission.mounted!(el, binding, h('button'), null)
}

describe('directives/permission', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset()
    hasAnyPermissionMock.mockReset()
  })

  it('hides element when array permissions are not satisfied', () => {
    hasAnyPermissionMock.mockReturnValue(false)

    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    mountPermission(el, ['a', 'b'])

    expect(el.style.display).toBe('none')
  })

  it('keeps element when array permissions are satisfied', () => {
    hasAnyPermissionMock.mockReturnValue(true)

    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    mountPermission(el, ['a', 'b'])

    expect(parent.contains(el)).toBe(true)
  })

  it('keeps element when string permission is satisfied', () => {
    hasPermissionMock.mockReturnValue(true)

    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    mountPermission(el, 'dish:view')

    expect(parent.contains(el)).toBe(true)
  })

  it('hides element when string permission is not satisfied', () => {
    hasPermissionMock.mockReturnValue(false)

    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    mountPermission(el, 'dish:edit')

    expect(el.style.display).toBe('none')
  })

  it('throws when binding value is invalid', () => {
    const parent = document.createElement('div')
    const el = document.createElement('button')
    parent.appendChild(el)

    expect(() => mountPermission(el, null)).toThrow('需要有效的权限名称或权限列表')
  })
})
