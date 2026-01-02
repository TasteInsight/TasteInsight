import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// ---- axios mock (captures interceptors) ----
let requestOnFulfilled: any
let requestOnRejected: any
let responseOnFulfilled: any
let responseOnRejected: any

const serviceFn: any = vi.fn(async (cfg: any) => ({ retried: true, config: cfg }))
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

  it('prefers auth store token over storage when store is ready', async () => {
    localStorage.setItem('admin_token', 'storageToken')
    authState.token = 'storeToken'

    await loadOnce()
    // let getAuthStore dynamic import settle so store becomes available
    await vi.dynamicImportSettled()

    const cfg = { headers: {} as Record<string, any> }
    const out = requestOnFulfilled(cfg)

    expect(out.headers.Authorization).toBe('Bearer storeToken')
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

    // refresh call returns an object with data.token.accessToken
    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') {
        return { data: { token: { accessToken: 'newToken' } } }
      }
      return { ok: true }
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

  it('queues requests while refresh is in progress', async () => {
    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh')

    const d = deferred<any>()
    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') return d.promise
      return { ok: true }
    })

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
    d.resolve({ data: { token: { accessToken: 'newToken2' } } })

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

    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') {
        return { data: { token: {} } }
      }
      return { ok: true }
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

    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') {
        return { data: { token: { accessToken: 'newTokenLS' } } }
      }
      return { ok: true }
    })

    await loadOnce()
    await vi.dynamicImportSettled()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await responseOnRejected(err)

    expect(authState.token).toBe('newTokenLS')
    expect(localStorage.getItem('admin_token')).toBe('newTokenLS')
  })

  it('refresh success persists token to sessionStorage when local token is absent', async () => {
    sessionStorage.setItem('admin_token', 'oldToken')
    sessionStorage.setItem('admin_refresh_token', 'refresh')
    authState.token = 'oldToken'
    authState.refreshToken = 'refresh'

    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') {
        return { data: { token: { accessToken: 'newTokenSS' } } }
      }
      return { ok: true }
    })

    await loadOnce()
    await vi.dynamicImportSettled()

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await responseOnRejected(err)

    expect(authState.token).toBe('newTokenSS')
    expect(sessionStorage.getItem('admin_token')).toBe('newTokenSS')
  })

  it('queued requests reject with refresh error when refresh fails', async () => {
    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh')

    const d = deferred<any>()
    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') return d.promise
      return { ok: true }
    })

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

    await expect(p2).rejects.toThrow('refresh fail')
    await expect(p1).rejects.toThrow('认证已过期，请重新登录')
  })

  it('refresh failure clears storage when store is not ready', async () => {
    localStorage.setItem('admin_token', 't1')
    localStorage.setItem('admin_refresh_token', 'refresh')
    // force store to stay unavailable
    authStoreShouldBeNull = true

    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') {
        throw new Error('refresh down')
      }
      return { ok: true }
    })

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

    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') {
        throw new Error('refresh down')
      }
      return { ok: true }
    })

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

  it('refresh success retries request even when store is unavailable (no persistence)', async () => {
    authStoreShouldBeNull = true
    await loadFresh()

    localStorage.setItem('admin_token', 'old')
    localStorage.setItem('admin_refresh_token', 'refresh')

    serviceFn.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh') {
        return { data: { token: { accessToken: 'newTokenNoStore' } } }
      }
      return { ok: true }
    })

    const err: any = {
      config: { url: '/admin/dishes', headers: {} },
      response: { status: 401, data: {} },
    }

    await responseOnRejected(err)

    expect(err.config.headers.Authorization).toBe('Bearer newTokenNoStore')
    expect(localStorage.getItem('admin_token')).toBe('old')
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
