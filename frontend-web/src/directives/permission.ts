import { watchEffect, type ObjectDirective } from 'vue'
import { useAuthStore } from '@/store/modules/use-auth-store'

const bindings = new WeakMap<HTMLElement, { stop: () => void; display: string }>()

export const permission: ObjectDirective = {
  mounted(el, binding) {
    const authStore = useAuthStore()
    const value = binding.value
    if (!(typeof value === 'string' && value.length) && !(Array.isArray(value) && value.length)) {
      throw new Error('需要有效的权限名称或权限列表')
    }
    const display = el.style.display
    const stop = watchEffect(() => {
      const visible = Array.isArray(value)
        ? authStore.hasAnyPermission(value)
        : authStore.hasPermission(value)
      el.style.display = visible ? display : 'none'
    })
    bindings.set(el, { stop, display })
  },
  beforeUnmount(el) {
    bindings.get(el)?.stop()
    bindings.delete(el)
  },
}
