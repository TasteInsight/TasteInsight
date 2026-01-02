import { describe, expect, it, vi } from 'vitest'

const createApiMock = (keys: string[]) => {
  const obj: Record<string, any> = {}
  for (const k of keys) obj[k] = vi.fn(() => `called:${k}`)
  return obj
}

const authApiMock = createApiMock(['adminLogin', 'refreshToken'])
const dishApiMock = createApiMock([
  'getDishes',
  'getDishById',
  'createDish',
  'updateDish',
  'deleteDish',
  'batchUpload',
  'updateDishStatus',
  'uploadImage',
  'getDishReviews',
])
const reviewApiMock = createApiMock([
  'getPendingReviews',
  'approveReview',
  'rejectReview',
  'deleteReview',
  'getPendingComments',
  'approveComment',
  'rejectComment',
  'getReports',
  'handleReport',
  'getPendingUploads',
  'approveUpload',
  'rejectUpload',
  'getDishComments',
  'deleteComment',
  'getPendingComments',
])
const permissionApiMock = createApiMock(['getAdmins', 'createAdmin', 'deleteAdmin', 'updateAdminPermissions'])
const logApiMock = createApiMock(['getLogs'])
const newsApiMock = createApiMock(['getNews', 'createNews', 'updateNews', 'deleteNews'])
const canteenApiMock = createApiMock([
  'getCanteens',
  'createCanteen',
  'updateCanteen',
  'deleteCanteen',
  'getWindows',
  'createWindow',
  'updateWindow',
  'deleteWindow',
])
const configApiMock = createApiMock([
  'getTemplates',
  'getGlobalConfig',
  'updateGlobalConfig',
  'getCanteenConfig',
  'updateCanteenConfig',
  'getEffectiveConfig',
  'deleteCanteenConfigItem',
])

vi.mock('@/api/modules/auth', () => ({ authApi: authApiMock }))
vi.mock('@/api/modules/dish', () => ({ dishApi: dishApiMock }))
vi.mock('@/api/modules/review', () => ({ reviewApi: reviewApiMock }))
vi.mock('@/api/modules/permission', () => ({ permissionApi: permissionApiMock }))
vi.mock('@/api/modules/log', () => ({ logApi: logApiMock }))
vi.mock('@/api/modules/news', () => ({ newsApi: newsApiMock }))
vi.mock('@/api/modules/canteen', () => ({ canteenApi: canteenApiMock }))
vi.mock('@/api/modules/config', () => ({ configApi: configApiMock }))

describe('api/index', () => {
  it('api.adminLogin delegates to authApi.adminLogin', async () => {
    const { api } = await import('@/api')

    api.adminLogin({ username: 'u', password: 'p' } as any)

    expect(authApiMock.adminLogin).toHaveBeenCalledTimes(1)
  })

  it('api.getDishes delegates to dishApi.getDishes', async () => {
    const { api } = await import('@/api')

    api.getDishes({ page: 1 } as any)

    expect(dishApiMock.getDishes).toHaveBeenCalledTimes(1)
  })
})
