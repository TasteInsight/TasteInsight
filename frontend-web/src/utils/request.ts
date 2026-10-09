import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import config from '@/config'
import { getAuthSessionVersion, invalidateAuthSession } from './auth-session'

// 懒加载 auth store 避免循环依赖
let authStore: any = null
let authStoreLoading: Promise<any> | null = null
const getAuthStore = () => {
  if (!authStoreLoading) {
    // 动态导入避免循环依赖
    authStoreLoading = import('@/store/modules/use-auth-store').then((module) => {
      authStore = module.useAuthStore()
      return authStore
    })
  }
  return authStore
}

const getStoredAuthStorage = (): Storage =>
  sessionStorage.getItem('admin_token') ? sessionStorage : localStorage

// 导航到登录页
const navigateToLogin = () => {
  const currentPath = window.location.pathname + window.location.search
  // 动态导入 router 避免循环依赖
  import('@/router')
    .then((module) => {
      const router = module.default
      router.push({
        path: '/login',
        query: { redirect: currentPath },
      })
    })
    .catch(() => {
      // 降级处理
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
    })
}

/**
 * 创建 axios 实例
 */
const service: AxiosInstance = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  headers: config.headers,
})

/**
 * 请求拦截器 - 添加 token
 */
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authenticatedConfig = config as InternalAxiosRequestConfig & { _authSessionVersion?: number }
    if (
      authenticatedConfig._authSessionVersion !== undefined &&
      authenticatedConfig._authSessionVersion !== getAuthSessionVersion()
    ) {
      throw new Error('登录会话已变更，请重试')
    }
    // 添加认证 token
    // 优先从 auth store 获取 token，如果 store 未初始化则从 storage 获取
    const store = getAuthStore()
    const token = store?.token || getStoredAuthStorage().getItem('admin_token')
    authenticatedConfig._authSessionVersion = getAuthSessionVersion()

    const hasAuthorization =
      config.headers &&
      (typeof config.headers.has === 'function'
        ? config.headers.has('Authorization')
        : Boolean(config.headers.Authorization || config.headers.authorization))

    if (token && config.headers && !hasAuthorization) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

interface RefreshSession {
  version: number
  storage: Storage
  store: any
  token: string | null
  refreshToken: string | null
}

let activeRefresh: { session: RefreshSession; promise: Promise<string> } | null = null

const currentToken = (session: RefreshSession): string | null =>
  session.store?.token || session.storage.getItem('admin_token')

const ownsSession = (session: RefreshSession): boolean =>
  session.version === getAuthSessionVersion() &&
  currentToken(session) === session.token &&
  (session.store?.refreshToken || session.storage.getItem('admin_refresh_token')) ===
    session.refreshToken

const expireSession = (store: any) => {
  if (store) {
    store.logout()
  } else {
    invalidateAuthSession()
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of ['admin_token', 'admin_refresh_token', 'admin_user', 'admin_permissions']) {
        storage.removeItem(key)
      }
    }
  }
  navigateToLogin()
}

const refreshSession = async (session: RefreshSession): Promise<string> => {
  try {
    if (!session.refreshToken) throw new Error('认证已过期，请重新登录')

    const response = await axios.post('/auth/refresh', undefined, {
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: { Authorization: `Bearer ${session.refreshToken}` },
    })
    if (!ownsSession(session)) throw new Error('登录会话已变更，请重试')

    const tokenInfo = response.data?.data?.token
    if (!tokenInfo?.accessToken || !tokenInfo?.refreshToken) throw new Error('刷新 token 失败')

    if (session.store) {
      session.store.token = tokenInfo.accessToken
      session.store.refreshToken = tokenInfo.refreshToken
    }
    session.storage.setItem('admin_token', tokenInfo.accessToken)
    session.storage.setItem('admin_refresh_token', tokenInfo.refreshToken)
    return tokenInfo.accessToken
  } catch (error) {
    if (!ownsSession(session)) throw new Error('登录会话已变更，请重试')
    expireSession(session.store)
    throw new Error('认证已过期，请重新登录')
  }
}

/**
 * 响应拦截器 - 处理错误和认证
 */
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const version = (response.config as { _authSessionVersion?: number } | undefined)
      ?._authSessionVersion
    if (version !== undefined && version !== getAuthSessionVersion()) {
      return Promise.reject(new Error('登录会话已变更，请重试'))
    }
    // 返回 response.data，这样调用方直接获得数据
    return response.data as any
  },
  async (error) => {
    const originalRequest = error.config
    if (
      originalRequest?._authSessionVersion !== undefined &&
      originalRequest._authSessionVersion !== getAuthSessionVersion()
    ) {
      return Promise.reject(new Error('登录会话已变更，请重试'))
    }

    if (error.response) {
      const { status, data } = error.response

      // 401 未授权 - 尝试刷新 token
      // 排除登录接口，登录接口的 401 是账号密码错误，不需要刷新 token
      // 使用正则匹配包含 /auth/admin/login 或 /auth/wechat/login 的 URL
      const requestUrl = originalRequest.url || ''
      const isLoginRequest = /\/auth\/(admin|wechat)\/login/.test(requestUrl)
      const isRefreshRequest = /\/auth\/refresh(?:\?|$)/.test(requestUrl)

      if (status === 401 && !originalRequest._retry && !isLoginRequest && !isRefreshRequest) {
        originalRequest._retry = true
        const version = originalRequest._authSessionVersion ?? getAuthSessionVersion()
        const store = getAuthStore() || (await authStoreLoading)
        if (version !== getAuthSessionVersion()) throw new Error('登录会话已变更，请重试')

        const storage = getStoredAuthStorage()
        const session: RefreshSession = {
          version,
          storage,
          store,
          token: store?.token || storage.getItem('admin_token'),
          refreshToken: store?.refreshToken || storage.getItem('admin_refresh_token'),
        }

        if (!activeRefresh || activeRefresh.session.version !== version) {
          const attempt = { session, promise: Promise.resolve('') }
          activeRefresh = attempt
          attempt.promise = refreshSession(session).finally(() => {
            if (activeRefresh === attempt) activeRefresh = null
          })
        }
        const newToken = await activeRefresh.promise
        if (version !== getAuthSessionVersion() || currentToken(session) !== newToken) {
          throw new Error('登录会话已变更，请重试')
        }
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return service(originalRequest)
      }

      // 如果重试后依然是 401（或者非登录接口直接返回401），强制登出并跳转登录
      // 上面的 if 块如果执行成功会 return Promise，不会执行到这里
      // 所以这里捕获的是：重试后的 401，或者不满足刷新条件的 401
      if (status === 401 && !isLoginRequest) {
        expireSession(getAuthStore())
        return Promise.reject(new Error('认证已过期，请重新登录'))
      }

      // 403 无权限
      if (status === 403) {
        return Promise.reject(new Error('无权限访问该资源'))
      }

      // 登录接口的 401 错误，返回明确的错误提示
      if (status === 401 && isLoginRequest) {
        return Promise.reject(new Error('用户名或密码错误'))
      }

      // 返回错误信息
      const message = data?.message || data?.error || '请求失败，请稍后重试'
      return Promise.reject(new Error(message))
    } else if (error.request) {
      return Promise.reject(new Error('网络连接失败，请检查网络'))
    } else {
      return Promise.reject(error)
    }
  },
)

// 封装请求方法，确保返回正确的类型
const request = {
  async get<T = any>(url: string, config?: any): Promise<T> {
    return service.get(url, config)
  },
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return service.post(url, data, config)
  },
  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return service.put(url, data, config)
  },
  delete<T = any>(url: string, config?: any): Promise<T> {
    return service.delete(url, config)
  },
  patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return service.patch(url, data, config)
  },
}

export default request
