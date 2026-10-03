import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/modules/auth'
import type { LoginCredentials, Admin } from '@/types/api'
import { getAuthSessionVersion, invalidateAuthSession } from '@/utils/auth-session'

const parseStoredValue = <T>(
  storage: Storage,
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T => {
  const stored = storage.getItem(key)
  if (!stored) return fallback

  try {
    const parsed: unknown = JSON.parse(stored)
    if (isValid(parsed)) return parsed
  } catch {
    // 损坏的持久化值按未登录/无权限处理
  }
  storage.removeItem(key)

  return fallback
}

const AUTH_STORAGE_KEYS = [
  'admin_token',
  'admin_refresh_token',
  'admin_user',
  'admin_permissions',
] as const

const clearStoredAuth = () => {
  for (const storage of [localStorage, sessionStorage]) {
    AUTH_STORAGE_KEYS.forEach((key) => storage.removeItem(key))
  }
}

export const useAuthStore = defineStore('auth', () => {
  // A session login is newer than remembered credentials left by an older app version.
  // Read the whole auth bundle from one storage to avoid mixing two identities.
  const authStorage = sessionStorage.getItem('admin_token') ? sessionStorage : localStorage
  if (authStorage === sessionStorage) {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
  }
  const token = ref<string | null>(authStorage.getItem('admin_token'))
  const refreshToken = ref<string | null>(authStorage.getItem('admin_refresh_token'))

  // 初始化用户信息
  const getStoredUser = (): Admin | null =>
    parseStoredValue<Admin | null>(
      authStorage,
      'admin_user',
      null,
      (value): value is Admin =>
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof (value as Partial<Admin>).username === 'string' &&
        typeof (value as Partial<Admin>).role === 'string',
    )

  const user = ref<Admin | null>(getStoredUser())
  const isAuthenticated = ref<boolean>(!!token.value)

  const isLoggedIn = computed(() => !!token.value && isAuthenticated.value)

  // 获取权限列表
  const getPermissions = (): string[] =>
    parseStoredValue<string[]>(
      authStorage,
      'admin_permissions',
      [],
      (value): value is string[] =>
        Array.isArray(value) && value.every((permission) => typeof permission === 'string'),
    )

  const permissions = ref<string[]>(getPermissions())

  // 检查是否拥有特定权限
  const hasPermission = (permission: string): boolean => {
    if (!user.value) return false
    
    // 只检查后端返回的权限列表
    const perms = permissions.value
    return perms.includes(permission)
  }

  // 检查是否拥有任一权限
  const hasAnyPermission = (permissionList: string[]): boolean => {
    if (!user.value) return false
    
    // 只检查后端返回的权限列表
    const perms = permissions.value
    return permissionList.some(p => perms.includes(p))
  }

  const login = async (credentials: LoginCredentials & { remember?: boolean }) => {
    invalidateAuthSession()
    const loginSession = getAuthSessionVersion()
    try {
      // 调用登录 API
      const response = await authApi.adminLogin({
        username: credentials.username,
        password: credentials.password,
      })

      if (loginSession !== getAuthSessionVersion()) {
        throw new Error('登录请求已失效')
      }

      if (response.code === 200 && response.data) {
        const { token: tokenInfo, admin, permissions: userPermissions } = response.data

        // 保存 token 和用户信息
        token.value = tokenInfo.accessToken
        refreshToken.value = tokenInfo.refreshToken
        user.value = admin
        permissions.value = userPermissions
        isAuthenticated.value = true

        // 根据 remember 选项决定存储位置
        clearStoredAuth()
        if (credentials.remember) {
          localStorage.setItem('admin_token', tokenInfo.accessToken)
          localStorage.setItem('admin_refresh_token', tokenInfo.refreshToken)
          localStorage.setItem('admin_user', JSON.stringify(admin))
          localStorage.setItem('admin_permissions', JSON.stringify(userPermissions))
        } else {
          sessionStorage.setItem('admin_token', tokenInfo.accessToken)
          sessionStorage.setItem('admin_refresh_token', tokenInfo.refreshToken)
          sessionStorage.setItem('admin_user', JSON.stringify(admin))
          sessionStorage.setItem('admin_permissions', JSON.stringify(userPermissions))
        }

        return {
          token: tokenInfo.accessToken,
          data: {
            user: admin,
            permissions: userPermissions,
          },
        }
      } else {
        throw new Error(response.message || '登录失败')
      }
    } catch (error) {
      if (loginSession !== getAuthSessionVersion()) throw error
      // 清除可能已保存的 token
      token.value = null
      refreshToken.value = null
      user.value = null
      permissions.value = []
      isAuthenticated.value = false
      clearStoredAuth()

      throw error
    }
  }

  const logout = () => {
    invalidateAuthSession()
    token.value = null
    refreshToken.value = null
    user.value = null
    permissions.value = []
    isAuthenticated.value = false

    clearStoredAuth()
  }

  return {
    token,
    refreshToken,
    user,
    isAuthenticated,
    isLoggedIn,
    permissions,
    login,
    logout,
    hasPermission,
    hasAnyPermission
  }
})
