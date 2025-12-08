import { ObjectDirective } from 'vue'
import { useAuthStore } from '@/store/modules/use-auth-store'

export const permission: ObjectDirective = {
  mounted(el, binding) {
    const { value } = binding
    const authStore = useAuthStore()
    
    if (value && value instanceof Array && value.length > 0) {
      const permissionRoles = value
      const hasPermission = authStore.hasAnyPermission(permissionRoles)

      if (!hasPermission) {
        el.parentNode && el.parentNode.removeChild(el)
      }
    } else if (value && typeof value === 'string') {
      const hasPermission = authStore.hasPermission(value)
      
      if (!hasPermission) {
        el.parentNode && el.parentNode.removeChild(el)
      }
    } else {
      throw new Error(`need roles! Like v-permission="['admin','editor']" or v-permission="'admin'"`)
    }
  }
}

