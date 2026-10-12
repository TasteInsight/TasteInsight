import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { authState, pushSpy } = vi.hoisted(() => ({
  authState: { token: '', refreshToken: '', logout: vi.fn() },
  pushSpy: vi.fn(),
}))

vi.mock('@/store/modules/use-auth-store', () => ({ useAuthStore: () => authState }))
vi.mock('@/router', () => ({ default: { push: pushSpy } }))

type OwnedConfig = InternalAxiosRequestConfig & { _authSessionVersion?: number }
type Dispatch = { url?: string; token: unknown; version?: number; data: unknown }

const sent: Dispatch[] = []
let request: typeof import('@/utils/request')['default']
let dishApi: typeof import('@/api/modules/dish')['dishApi']
let session: typeof import('@/utils/auth-session')
let respond: AxiosAdapter
let originalAdapter: typeof axios.defaults.adapter

const response = (config: InternalAxiosRequestConfig, data: unknown = { code: 200, data: { deletedCount: 1 } }): AxiosResponse => ({
  config,
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
})

const unauthorized = (config: InternalAxiosRequestConfig) => new AxiosError(
  'Unauthorized',
  AxiosError.ERR_BAD_REQUEST,
  config,
  undefined,
  { ...response(config, {}), status: 401, statusText: 'Unauthorized' },
)

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const switchAccount = (account: string) => {
  session.invalidateAuthSession()
  authState.token = `${account}-access`
  authState.refreshToken = `${account}-refresh`
  localStorage.clear()
  sessionStorage.setItem('admin_token', authState.token)
  sessionStorage.setItem('admin_refresh_token', authState.refreshToken)
}

beforeEach(async () => {
  vi.resetModules()
  authState.token = 'A-access'
  authState.refreshToken = 'A-refresh'
  authState.logout.mockClear()
  pushSpy.mockClear()
  sessionStorage.setItem('admin_token', authState.token)
  sessionStorage.setItem('admin_refresh_token', authState.refreshToken)
  sent.length = 0
  respond = async config => response(config)
  originalAdapter = axios.defaults.adapter
  axios.defaults.adapter = config => {
    sent.push({
      url: config.url,
      token: config.headers.get('Authorization'),
      version: (config as OwnedConfig)._authSessionVersion,
      data: config.data === undefined ? undefined : JSON.parse(config.data),
    })
    return respond(config)
  }
  request = (await import('@/utils/request')).default
  dishApi = (await import('@/api/modules/dish')).dishApi
  session = await import('@/utils/auth-session')
})

afterEach(async () => {
  await vi.dynamicImportSettled()
  axios.defaults.adapter = originalAdapter
})

describe.each([false, true])('request ownership with an initialized store: %s', (storeReady) => {
  it.each([
    { name: 'read', send: () => request.get('/admin/dishes') },
    { name: 'ordinary mutation', send: () => request.put('/admin/news/news-A', { title: 'A draft' }) },
    { name: 'batch mutation', send: () => dishApi.batchDeleteDishes(['selected-by-A']) },
  ])('does not dispatch a $name under an account switch already queued in a microtask', async ({ send }) => {
    if (storeReady) {
      await request.get('/warm-up')
      await vi.dynamicImportSettled()
      sent.length = 0
    }
    const ownerVersion = session.getAuthSessionVersion()
    queueMicrotask(() => switchAccount('B'))
    expect(session.getAuthSessionVersion()).toBe(ownerVersion)

    const outcome = send().catch((error: Error) => error)
    const result = await outcome

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ token: 'Bearer A-access', version: ownerVersion })
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toContain('登录会话已变更')
    expect(authState.token).toBe('B-access')
    expect(authState.logout).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
  })
})

describe('real Axios refresh and rejection ownership', () => {
  it('rejects an obsolete request before reaching the adapter', async () => {
    const ownerVersion = session.getAuthSessionVersion()
    switchAccount('B')

    await expect(request.post('/admin/dishes/batch-delete', { ids: ['selected-by-A'] }, {
      _authSessionVersion: ownerVersion,
      headers: { Authorization: 'Bearer A-access' },
    })).rejects.toThrow('登录会话已变更')

    expect(sent).toEqual([])
    expect(authState.token).toBe('B-access')
    expect(authState.logout).not.toHaveBeenCalled()
  })

  it('shares a refresh and retries both original requests within the same session', async () => {
    const ownerVersion = session.getAuthSessionVersion()
    const refreshStarted = deferred<InternalAxiosRequestConfig>()
    const refreshResult = deferred<AxiosResponse>()
    respond = async config => {
      if (config.url === '/auth/refresh') {
        refreshStarted.resolve(config)
        return refreshResult.promise
      }
      if (config.headers.get('Authorization') === 'Bearer A-access') throw unauthorized(config)
      return response(config)
    }

    const pendingBatch = dishApi.batchDeleteDishes(['selected-by-A'])
    const pendingRead = request.get('/admin/news')
    const refreshConfig = await refreshStarted.promise
    refreshResult.resolve(response(refreshConfig, {
      code: 200, data: { token: { accessToken: 'A-new', refreshToken: 'A-new-refresh' } },
    }))

    await expect(Promise.all([pendingBatch, pendingRead])).resolves.toEqual([
      { code: 200, data: { deletedCount: 1 } },
      { code: 200, data: { deletedCount: 1 } },
    ])
    expect(sent.filter(item => item.url === '/auth/refresh')).toEqual([
      { url: '/auth/refresh', token: 'Bearer A-refresh', version: undefined, data: undefined },
    ])
    expect(sent.filter(item => item.url === '/admin/dishes/batch-delete')).toEqual([
      { url: '/admin/dishes/batch-delete', token: 'Bearer A-access', version: ownerVersion, data: { ids: ['selected-by-A'] } },
      { url: '/admin/dishes/batch-delete', token: 'Bearer A-new', version: ownerVersion, data: { ids: ['selected-by-A'] } },
    ])
    expect(sent.filter(item => item.url === '/admin/news').map(item => [item.token, item.version])).toEqual([
      ['Bearer A-access', ownerVersion], ['Bearer A-new', ownerVersion],
    ])
    expect(authState.token).toBe('A-new')
    expect(authState.refreshToken).toBe('A-new-refresh')
    expect(session.getAuthSessionVersion()).toBe(ownerVersion)
    expect(sessionStorage.getItem('admin_token')).toBe('A-new')
    expect(authState.logout).not.toHaveBeenCalled()
  })

  it.each(['success', 'failure'])('does not retry or expire the new session after a late refresh %s', async result => {
    const refreshStarted = deferred<InternalAxiosRequestConfig>()
    const refreshResult = deferred<AxiosResponse>()
    respond = async config => {
      if (config.url === '/auth/refresh') {
        refreshStarted.resolve(config)
        return refreshResult.promise
      }
      throw unauthorized(config)
    }

    const outcome = dishApi.batchDeleteDishes(['selected-by-A']).catch((error: Error) => error)
    const refreshConfig = await refreshStarted.promise
    switchAccount('B')
    if (result === 'success') {
      refreshResult.resolve(response(refreshConfig, {
        code: 200, data: { token: { accessToken: 'A-new', refreshToken: 'A-new-refresh' } },
      }))
    } else {
      refreshResult.reject(new Error('refresh failed'))
    }

    expect((await outcome).message).toContain('登录会话已变更')
    expect(sent.map(item => item.token)).toEqual(['Bearer A-access', 'Bearer A-refresh'])
    expect(authState.token).toBe('B-access')
    expect(authState.refreshToken).toBe('B-refresh')
    expect(sessionStorage.getItem('admin_token')).toBe('B-access')
    expect(authState.logout).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
  })
})
