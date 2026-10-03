import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// ---- axios mock (captures interceptors) ----
let requestOnFulfilled: any
let requestOnRejected: any
let responseOnFulfilled: any
let responseOnRejected: any

const serviceFn: any = vi.fn(async (cfg: any) => ({ retried: true, config: cfg }))
const rawAxiosPostMock = vi.fn()
serviceFn.get = vi.fn(async () => ({ ok: true }))
serviceFn.post = vi.fn(async () => ({ ok: true }))
serviceFn.put = vi.fn(async () => ({ ok: true }))
serviceFn.delete = vi.fn(async () => ({ ok: true }))
serviceFn.patch = vi.fn(async () => ({ ok: true }))
serviceFn.interceptors = {
  request: {
    use: vi.fn((onFulfilled: any, onRejected: any) => {
      requestOnFulfilled = onFulfilled
      requestOnRejected = onRejected
      return 0
    }),
  },
  response: {
    use: vi.fn((onFulfilled: any, onRejected: any) => {
      responseOnFulfilled = onFulfilled
      responseOnRejected = onRejected
      return 0
    }),
  },
}

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => serviceFn),
      post: rawAxiosPostMock,
    },
    // request.ts imports these as named symbols (even though used as types)
    AxiosInstance: {},
    AxiosResponse: {},
    InternalAxiosRequestConfig: {},
  }
})

const pushSpy = vi.fn(async () => undefined)

vi.mock('@/router', () => {
  return {
    default: {
      push: pushSpy,
    },
  }
})

const authState: any = {
  token: null as string | null,
  refreshToken: null as string | null,
  logout: vi.fn(() => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_refresh_token')
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_refresh_token')
  }),
}

let authStoreShouldBeNull = false

vi.mock('@/store/modules/use-auth-store', () => {
  return {
    useAuthStore: () => (authStoreShouldBeNull ? null : authState),
  }
})

describe('utils/request', () => {
  let loaded = false
  const loadOnce = async () => {
    if (!loaded) {
      await import('@/utils/request')
      loaded = true
    }
  }

  const loadFresh = async () => {
    loaded = false
    vi.resetModules()
    await loadOnce()
  }

  const deferred = <T = any>() => {
    let resolve!: (v: T) => void
    let reject!: (e: any) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  beforeEach(async () => {
    serviceFn.mockClear()
    serviceFn.get.mockClear()
    serviceFn.post.mockClear()
    serviceFn.put.mockClear()
    serviceFn.delete.mockClear()
    serviceFn.patch.mockClear()
    rawAxiosPostMock.mockReset()
    rawAxiosPostMock.mockImplementation(async (url: string, data?: any, config?: any) => ({
      data: await serviceFn.post(url, data, config),
    }))

    localStorage.clear()
    sessionStorage.clear()

    authState.token = null
    authState.refreshToken = null
    authState.logout.mockClear()
    authStoreShouldBeNull = false

    pushSpy.mockClear()
  })

  afterEach(async () => {
    // Avoid "fetch pending" warnings from unresolved dynamic imports
    await vi.dynamicImportSettled()
  })

  it('adds Authorization header from storage token', async () => {
    localStorage.setItem('admin_token', 't1')

    await loadOnce()

    const cfg = { headers: {} as Record<string, any> }
    const out = requestOnFulfilled(cfg)

    expect(out.headers.Authorization).toBe('Bearer t1')
  })

  it('does not add Authorization when headers missing', async () => {
    localStorage.setItem('admin_token', 't1')
    await loadOnce()

    const cfg = {} as any
    const out = requestOnFulfilled(cfg)
    expect(out.headers).toBeUndefined()
  })

  it('adds Authorization header from sessionStorage token when localStorage is empty', async () => {
    sessionStorage.setItem('admin_token', 's1')
    await loadFresh()

    const cfg = { headers: {} as Record<string, any> }
    const out = requestOnFulfilled(cfg)

    expect(out.headers.Authorization).toBe('Bearer s1')
  })

  it('prefers the current session token over stale remembered credentials while the store loads', async () => {
    localStorage.setItem('admin_token', 'stale-local-token')
    sessionStorage.setItem('admin_token', 'current-session-token')
    authStoreShouldBeNull = true
    await loadFresh()

    const cfg = { headers: {} as Record<string, any> }
    const out = requestOnFulfilled(cfg)

    expect(out.headers.Authorization).toBe('Bearer current-session-token')
  })

  it('prefers auth store token over storage when store is ready', async () => {
    localStorage.setItem('admin_token', 'storageToken')
    authState.token = 'storeToken'

    await loadFresh()
    // First request starts the lazy store import; later requests use the store.
    requestOnFulfilled({ headers: {} })
    await vi.dynamicImportSettled()

    const cfg = { headers: {} as Record<string, any> }
    const out = requestOnFulfilled(cfg)

    expect(out.headers.Authorization).toBe('Bearer storeToken')
  })

  it('preserves an explicit Authorization header for refresh-token requests', async () => {
    authState.token = 'access-token'
    await loadOnce()
    await vi.dynamicImportSettled()

    const cfg = {
      headers: { Authorization: 'Bearer refresh-token' } as Record<string, any>,
    }
    const out = requestOnFulfilled(cfg)

    expect(out.headers.Authorization).toBe('Bearer refresh-token')
  })

  it('request interceptor error handler rejects', async () => {
    await loadOnce()

    const err = new Error('bad')
    await expect(requestOnRejected(err)).rejects.toThrow('bad')
  })

  it('response success returns response.data', async () => {
    await loadOnce()

    const data = { code: 200, data: { a: 1 } }
    const out = responseOnFulfilled({ data })
    expect(out).toEqual(data)
  })

  it('login 401 returns friendly message', async () => {
    await loadOnce()

    const err = {
      config: { url: '/auth/admin/login', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('用户名或密码错误')
  })

  it('403 returns permission error', async () => {
    await loadOnce()

    const err = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 403, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('无权限访问该资源')
  })

  it('network error returns network message', async () => {
    await loadOnce()

    const err = {
      config: { url: '/admin/dishes', headers: {} },
      request: {},
    }

    await expect(responseOnRejected(err)).rejects.toThrow('网络连接失败，请检查网络')
  })

  it('401 without refresh token clears storage and redirects', async () => {
    localStorage.setItem('admin_token', 't1')
    // note: no refresh token

    await loadOnce()

    const err = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    expect(localStorage.getItem('admin_token')).toBeNull()
  })

  it('401 without refresh token logs out store when store exists', async () => {
    authState.token = 't1'
    // store exists, but no refresh token anywhere
    await loadOnce()
    await vi.dynamicImportSettled()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    // navigateToLogin uses dynamic import and does not await router.push
    await vi.dynamicImportSettled()
    await Promise.resolve()

    expect(authState.logout).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalled()
  })

  it('401 triggers refresh and retries original request', async () => {
    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh')

    rawAxiosPostMock.mockResolvedValueOnce({
      data: {
        data: { token: { accessToken: 'newToken', refreshToken: 'newRefresh' } },
      },
    })

    await loadOnce()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    const out = await responseOnRejected(err)

    expect(out).toEqual(
      expect.objectContaining({
        retried: true,
      }),
    )
    expect(err.config.headers.Authorization).toBe('Bearer newToken')
  })

  it('does not recursively refresh a rejected refresh request', async () => {
    localStorage.setItem('admin_refresh_token', 'refresh')
    await loadOnce()

    const err: any = {
      config: { url: '/auth/refresh', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')
    expect(rawAxiosPostMock).not.toHaveBeenCalled()
  })

  it('refreshes outside the intercepted service and rotates both stored tokens', async () => {
    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh-old')
    rawAxiosPostMock.mockResolvedValueOnce({
      data: {
        code: 200,
        data: { token: { accessToken: 'access-new', refreshToken: 'refresh-new' } },
      },
    })

    await loadOnce()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await responseOnRejected(err)

    expect(rawAxiosPostMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/refresh$/),
      undefined,
      expect.objectContaining({
        headers: { Authorization: 'Bearer refresh-old' },
      }),
    )
    expect(serviceFn.post).not.toHaveBeenCalled()
    expect(localStorage.getItem('admin_token')).toBe('access-new')
    expect(localStorage.getItem('admin_refresh_token')).toBe('refresh-new')
  })

  it('queues requests while refresh is in progress', async () => {
    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh')

    const d = deferred<any>()
    rawAxiosPostMock.mockReturnValueOnce(d.promise)

    await loadOnce()

    const err1: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }
    const err2: any = {
      config: { url: '/admin/dishes?page=2', headers: {} },
      response: { status: 401, data: {} },
    }

    const p1 = responseOnRejected(err1)
    const p2 = responseOnRejected(err2)

    // complete refresh
    d.resolve({
      data: {
        data: { token: { accessToken: 'newToken2', refreshToken: 'newRefresh2' } },
      },
    })

    const out1 = await p1
    const out2 = await p2

    expect(out1).toEqual(expect.objectContaining({ retried: true }))
    expect(out2).toEqual(expect.objectContaining({ retried: true }))
    expect(err2.config.headers.Authorization).toBe('Bearer newToken2')
  })

  it('refresh response without accessToken forces logout + redirect', async () => {
    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh')
    authState.token = 't1'
    authState.refreshToken = 'refresh'

    rawAxiosPostMock.mockResolvedValueOnce({
      data: {
        data: { token: {} },
      },
    })

    await loadOnce()
    await vi.dynamicImportSettled()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    await vi.dynamicImportSettled()
    await Promise.resolve()

    expect(authState.logout).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalled()
  })

  it('forced logout on 401 when retry is not applicable', async () => {
    localStorage.setItem('admin_token', 't1')
    localStorage.setItem('admin_refresh_token', 'r1')

    await loadOnce()

    const err: any = {
      config: { url: '/admin/dishes', headers: {}, _retry: true },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    await vi.dynamicImportSettled()
    await Promise.resolve()

    expect(localStorage.getItem('admin_token')).toBeNull()
    expect(pushSpy).toHaveBeenCalled()
  })

  it('navigateToLogin falls back to window.location.href when router import fails', async () => {
    // Trigger the navigateToLogin() .catch() branch by making router.push throw,
    // which rejects the promise chain from the preceding dynamic import().
    pushSpy.mockImplementationOnce(() => {
      throw new Error('push failed')
    })

    // jsdom's Location has non-configurable accessors; stub global to capture href writes
    vi.stubGlobal('location', {
      pathname: '/x',
      search: '?a=1',
      href: 'http://localhost/',
    } as any)

    await loadOnce()

    const err: any = {
      config: { url: '/admin/dishes', headers: {}, _retry: true },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    await vi.dynamicImportSettled()
    await Promise.resolve()

    expect(pushSpy).toHaveBeenCalled()
    expect((window.location as any).href).toBe('/login?redirect=%2Fx%3Fa%3D1')

    vi.unstubAllGlobals()
  })

  it('refresh success updates store token and persists to localStorage when local token exists', async () => {
    localStorage.setItem('admin_token', 'oldToken')
    localStorage.setItem('admin_refresh_token', 'refresh')
    authState.token = 'oldToken'
    authState.refreshToken = 'refresh'

    rawAxiosPostMock.mockResolvedValueOnce({
      data: {
        data: { token: { accessToken: 'newTokenLS', refreshToken: 'newRefreshLS' } },
      },
    })

    await loadOnce()
    await vi.dynamicImportSettled()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await responseOnRejected(err)

    expect(authState.token).toBe('newTokenLS')
    expect(authState.refreshToken).toBe('newRefreshLS')
    expect(localStorage.getItem('admin_token')).toBe('newTokenLS')
    expect(localStorage.getItem('admin_refresh_token')).toBe('newRefreshLS')
  })

  it('refresh success persists token to sessionStorage when local token is absent', async () => {
    sessionStorage.setItem('admin_token', 'oldToken')
    sessionStorage.setItem('admin_refresh_token', 'refresh')
    authState.token = 'oldToken'
    authState.refreshToken = 'refresh'

    rawAxiosPostMock.mockResolvedValueOnce({
      data: {
        data: { token: { accessToken: 'newTokenSS', refreshToken: 'newRefreshSS' } },
      },
    })

    await loadOnce()
    await vi.dynamicImportSettled()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await responseOnRejected(err)

    expect(authState.token).toBe('newTokenSS')
    expect(authState.refreshToken).toBe('newRefreshSS')
    expect(sessionStorage.getItem('admin_token')).toBe('newTokenSS')
    expect(sessionStorage.getItem('admin_refresh_token')).toBe('newRefreshSS')
  })

  it('queued requests reject with refresh error when refresh fails', async () => {
    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh')

    const d = deferred<any>()
    rawAxiosPostMock.mockReturnValueOnce(d.promise)

    await loadOnce()

    const err1: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }
    const err2: any = {
      config: { url: '/admin/dishes?page=2', headers: {} },
      response: { status: 401, data: {} },
    }

    const p1 = responseOnRejected(err1)
    const p2 = responseOnRejected(err2)

    d.reject(new Error('refresh fail'))

    await expect(p2).rejects.toThrow('认证已过期，请重新登录')
    await expect(p1).rejects.toThrow('认证已过期，请重新登录')
  })

  it('refresh failure clears storage when store is not ready', async () => {
    localStorage.setItem('admin_token', 't1')
    localStorage.setItem('admin_refresh_token', 'refresh')
    // force store to stay unavailable
    authStoreShouldBeNull = true

    rawAxiosPostMock.mockRejectedValueOnce(new Error('refresh down'))

    await loadOnce()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    expect(localStorage.getItem('admin_token')).toBeNull()
    expect(localStorage.getItem('admin_refresh_token')).toBeNull()
  })

  it('401 without refresh token clears both local & session when store is unavailable', async () => {
    authStoreShouldBeNull = true
    await loadFresh()

    localStorage.setItem('admin_token', 't1')
    localStorage.setItem('admin_refresh_token', 'r1')
    sessionStorage.setItem('admin_token', 't2')
    sessionStorage.setItem('admin_refresh_token', 'r2')
    // remove refresh token so the code takes the "!refreshToken" branch
    localStorage.removeItem('admin_refresh_token')
    sessionStorage.removeItem('admin_refresh_token')

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    expect(localStorage.getItem('admin_token')).toBeNull()
    expect(localStorage.getItem('admin_refresh_token')).toBeNull()
    expect(sessionStorage.getItem('admin_token')).toBeNull()
    expect(sessionStorage.getItem('admin_refresh_token')).toBeNull()
  })

  it('refresh failure clears both local & session when store is unavailable', async () => {
    authStoreShouldBeNull = true
    await loadFresh()

    localStorage.setItem('admin_token', 't1')
    localStorage.setItem('admin_refresh_token', 'refresh')
    sessionStorage.setItem('admin_token', 't2')
    sessionStorage.setItem('admin_refresh_token', 'refresh2')

    rawAxiosPostMock.mockRejectedValueOnce(new Error('refresh down'))

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    expect(localStorage.getItem('admin_token')).toBeNull()
    expect(localStorage.getItem('admin_refresh_token')).toBeNull()
    expect(sessionStorage.getItem('admin_token')).toBeNull()
    expect(sessionStorage.getItem('admin_refresh_token')).toBeNull()
  })

  it('forced logout branch clears storage when store is unavailable', async () => {
    authStoreShouldBeNull = true
    await loadFresh()

    localStorage.setItem('admin_token', 't1')
    localStorage.setItem('admin_refresh_token', 'r1')
    sessionStorage.setItem('admin_token', 't2')
    sessionStorage.setItem('admin_refresh_token', 'r2')

    const err: any = {
      config: { url: '/admin/dishes', headers: {}, _retry: true },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')

    expect(localStorage.getItem('admin_token')).toBeNull()
    expect(localStorage.getItem('admin_refresh_token')).toBeNull()
    expect(sessionStorage.getItem('admin_token')).toBeNull()
    expect(sessionStorage.getItem('admin_refresh_token')).toBeNull()
  })

  it('wechat login 401 returns friendly message', async () => {
    await loadOnce()

    const err: any = {
      config: { url: '/auth/wechat/login', headers: {} },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('用户名或密码错误')
  })

  it('non-401/403 returns message from response.data.message or error', async () => {
    await loadOnce()

    await expect(
      responseOnRejected({
        config: { url: '/x', headers: {} },
        response: { status: 500, data: { message: 'm1' } },
      }),
    ).rejects.toThrow('m1')

    await expect(
      responseOnRejected({
        config: { url: '/x', headers: {} },
        response: { status: 500, data: { error: 'm2' } },
      }),
    ).rejects.toThrow('m2')
  })

  it('non-401/403 returns default message when response has no message or error', async () => {
    await loadOnce()

    await expect(
      responseOnRejected({
        config: { url: '/x', headers: {} },
        response: { status: 500, data: {} },
      }),
    ).rejects.toThrow('请求失败，请稍后重试')
  })

  it('refresh success retries and persists both tokens when store is unavailable', async () => {
    authStoreShouldBeNull = true
    await loadFresh()

    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh')

    rawAxiosPostMock.mockResolvedValueOnce({
      data: {
        data: {
          token: { accessToken: 'newTokenNoStore', refreshToken: 'newRefreshNoStore' },
        },
      },
    })

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await responseOnRejected(err)

    expect(err.config.headers.Authorization).toBe('Bearer newTokenNoStore')
    expect(localStorage.getItem('admin_token')).toBe('newTokenNoStore')
    expect(localStorage.getItem('admin_refresh_token')).toBe('newRefreshNoStore')
  })

  it.each(['success', 'failure'])('does not apply a late refresh %s to a newer login session', async (result) => {
    authState.token = 'A-access'
    authState.refreshToken = 'A-refresh'
    localStorage.setItem('admin_token', 'A-access')
    localStorage.setItem('admin_refresh_token', 'A-refresh')
    const d = deferred<any>()
    rawAxiosPostMock.mockReturnValueOnce(d.promise)
    await loadFresh()
    requestOnFulfilled({ headers: {} })
    await vi.dynamicImportSettled()
    const config = requestOnFulfilled({ url: '/admin/news', headers: {} })
    const pending = responseOnRejected({ config, response: { status: 401, data: {} } })
    const outcome = pending.then(() => null, (error: Error) => error)
    await Promise.resolve()

    const { invalidateAuthSession } = await import('@/utils/auth-session')
    invalidateAuthSession()
    localStorage.clear()
    authState.token = 'B-access'
    authState.refreshToken = 'B-refresh'
    sessionStorage.setItem('admin_token', 'B-access')
    sessionStorage.setItem('admin_refresh_token', 'B-refresh')
    if (result === 'success') {
      d.resolve({ data: { data: { token: { accessToken: 'A-new', refreshToken: 'A-new-refresh' } } } })
    } else {
      d.reject(new Error('A refresh failed'))
    }

    expect((await outcome)?.message).toContain('登录会话已变更')
    expect(authState.token).toBe('B-access')
    expect(authState.refreshToken).toBe('B-refresh')
    expect(sessionStorage.getItem('admin_token')).toBe('B-access')
    expect(localStorage.getItem('admin_token')).toBeNull()
    expect(authState.logout).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
    expect(serviceFn).not.toHaveBeenCalled()
  })

  it('rejects a stale original request instead of refreshing or logging out the current session', async () => {
    await loadFresh()
    const config = requestOnFulfilled({ url: '/admin/news', headers: {} })
    const { invalidateAuthSession } = await import('@/utils/auth-session')
    invalidateAuthSession()
    expect(() => requestOnFulfilled(config)).toThrow('登录会话已变更')
    await expect(responseOnRejected({ config, response: { status: 401, data: {} } })).rejects.toThrow('登录会话已变更')
    expect(rawAxiosPostMock).not.toHaveBeenCalled()
    expect(authState.logout).not.toHaveBeenCalled()
  })

  it('keeps a new-session refresh independent of a still pending old-session refresh', async () => {
    authState.token = 'A'
    authState.refreshToken = 'Ar'
    sessionStorage.setItem('admin_token', 'A')
    sessionStorage.setItem('admin_refresh_token', 'Ar')
    const oldRefresh = deferred<any>()
    const newRefresh = deferred<any>()
    rawAxiosPostMock.mockReturnValueOnce(oldRefresh.promise).mockReturnValueOnce(newRefresh.promise)
    await loadFresh()
    requestOnFulfilled({ headers: {} })
    await vi.dynamicImportSettled()
    const oldConfig = requestOnFulfilled({ url: '/admin/news', headers: {} })
    const oldOutcome = responseOnRejected({ config: oldConfig, response: { status: 401, data: {} } }).catch((error: Error) => error)
    const { invalidateAuthSession } = await import('@/utils/auth-session')
    invalidateAuthSession()
    authState.token = 'B'
    authState.refreshToken = 'Br'
    sessionStorage.setItem('admin_token', 'B')
    sessionStorage.setItem('admin_refresh_token', 'Br')
    const newConfig = requestOnFulfilled({ url: '/admin/dishes', headers: {} })
    const newOutcome = responseOnRejected({ config: newConfig, response: { status: 401, data: {} } })
    oldRefresh.resolve({ data: { data: { token: { accessToken: 'A-new', refreshToken: 'Ar-new' } } } })
    expect((await oldOutcome).message).toContain('登录会话已变更')
    newRefresh.resolve({ data: { data: { token: { accessToken: 'B-new', refreshToken: 'Br-new' } } } })
    await newOutcome
    expect(authState.token).toBe('B-new')
    expect(rawAxiosPostMock).toHaveBeenCalledTimes(2)
    expect(serviceFn).toHaveBeenCalledTimes(1)
    expect(newConfig._retry).toBe(true)
    expect(authState.logout).not.toHaveBeenCalled()
  })

  it('refresh fallback keeps a current session bundle isolated from stale local credentials', async () => {
    authStoreShouldBeNull = true
    await loadFresh()

    localStorage.setItem('admin_token', 'stale-local-token')
    localStorage.setItem('admin_refresh_token', 'stale-local-refresh')
    sessionStorage.setItem('admin_token', 'current-session-token')
    sessionStorage.setItem('admin_refresh_token', 'current-session-refresh')

    rawAxiosPostMock.mockResolvedValueOnce({
      data: {
        data: { token: { accessToken: 'new-session-token', refreshToken: 'new-session-refresh' } },
      },
    })

    await responseOnRejected({
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    })

    expect(rawAxiosPostMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/refresh$/),
      undefined,
      expect.objectContaining({
        headers: { Authorization: 'Bearer current-session-refresh' },
      }),
    )
    expect(sessionStorage.getItem('admin_token')).toBe('new-session-token')
    expect(sessionStorage.getItem('admin_refresh_token')).toBe('new-session-refresh')
  })

  it('handles missing originalRequest.url by treating it as empty string', async () => {
    authStoreShouldBeNull = true
    await loadFresh()

    const err: any = {
      config: { headers: {}, _retry: true },
      response: { status: 401, data: {} },
    }

    await expect(responseOnRejected(err)).rejects.toThrow('认证已过期，请重新登录')
  })

  it('error without response/request is re-thrown', async () => {
    await loadOnce()
    const err = new Error('boom')
    await expect(responseOnRejected(err)).rejects.toThrow('boom')
  })

  it('request wrapper methods delegate to axios instance', async () => {
    const { default: request } = await import('@/utils/request')

    await request.get('/g', { a: 1 })
    expect(serviceFn.get).toHaveBeenCalledWith('/g', { a: 1 })

    await request.post('/p', { b: 2 }, { c: 3 })
    expect(serviceFn.post).toHaveBeenCalledWith('/p', { b: 2 }, { c: 3 })

    await request.put('/u', { d: 4 }, { e: 5 })
    expect(serviceFn.put).toHaveBeenCalledWith('/u', { d: 4 }, { e: 5 })

    await request.delete('/d', { f: 6 })
    expect(serviceFn.delete).toHaveBeenCalledWith('/d', { f: 6 })

    await request.patch('/pa', { g: 7 }, { h: 8 })
    expect(serviceFn.patch).toHaveBeenCalledWith('/pa', { g: 7 }, { h: 8 })
  })
})
