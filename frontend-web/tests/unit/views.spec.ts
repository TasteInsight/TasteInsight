import { describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { defineComponent } from 'vue'

const flushPromises = () => new Promise((resolve) => queueMicrotask(resolve))

// ---- Global mocks for common dependencies in views ----
vi.mock('vue-router', () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }

  const route = {
    path: '/',
    meta: {},
    params: { id: '1' },
    query: {},
  }

  return {
    useRouter: () => router,
    useRoute: () => route,
  }
})

vi.mock('@/store/modules/use-auth-store', () => {
  const store = {
    user: { username: 'admin', name: 'admin' },
    token: 'token',
    permissions: [
      'dish:view',
      'dish:edit',
      'upload:approve',
      'news:view',
      'review:approve',
      'report:handle',
      'config:view',
      'admin:view',
    ],
    hasPermission: vi.fn(() => true),
    login: vi.fn(async () => ({ success: true })),
    logout: vi.fn(),
  }
  return { useAuthStore: () => store }
})

vi.mock('@/store/modules/use-dish-store', () => {
  const store = {
    dishes: [],
    setSelectedDish: vi.fn(),
  }
  return { useDishStore: () => store }
})

vi.mock('@/api/modules/dish', () => ({
  dishApi: {
    getDishes: vi.fn(async () => ({ code: 200, data: { items: [], total: 0, totalPages: 0 } })),
    getDishById: vi.fn(async () => ({ code: 200, data: { id: 1 } })),
    getDishReviews: vi.fn(async () => ({ code: 200, data: { items: [], total: 0 } })),
    createDish: vi.fn(async () => ({ code: 200, data: {} })),
    updateDish: vi.fn(async () => ({ code: 200, data: {} })),
    deleteDish: vi.fn(async () => ({ code: 200 })),
  },
}))

vi.mock('@/api/modules/canteen', () => ({
  canteenApi: {
    getCanteens: vi.fn(async () => ({ code: 200, data: { items: [] } })),
    getWindows: vi.fn(async () => ({ code: 200, data: { items: [] } })),
    createCanteen: vi.fn(async () => ({ code: 200, data: {} })),
    updateCanteen: vi.fn(async () => ({ code: 200, data: {} })),
    deleteCanteen: vi.fn(async () => ({ code: 200 })),
  },
}))

vi.mock('@/api/modules/review', () => ({
  reviewApi: {
    getReviews: vi.fn(async () => ({ code: 200, data: { items: [], total: 0 } })),
    getPendingReviews: vi.fn(async () => ({ code: 200, data: { items: [], total: 0 } })),
    getReports: vi.fn(async () => ({ code: 200, data: { items: [], total: 0 } })),
    getPendingUploads: vi.fn(async () => ({ code: 200, data: { items: [], total: 0 } })),
    getPendingUploadById: vi.fn(async () => ({ code: 200, data: { id: 1 } })),
    approveReview: vi.fn(async () => ({ code: 200 })),
    rejectReview: vi.fn(async () => ({ code: 200 })),
    deleteReview: vi.fn(async () => ({ code: 200 })),
  },
}))

vi.mock('@/api/modules/config', () => ({
  configApi: {
    getConfig: vi.fn(async () => ({ code: 200, data: {} })),
    getGlobalConfig: vi.fn(async () => ({ code: 200, data: {} })),
    updateConfig: vi.fn(async () => ({ code: 200 })),
  },
}))

vi.mock('@/api/modules/log', () => ({
  logApi: {
    getLogs: vi.fn(async () => ({ code: 200, data: { items: [], total: 0 } })),
  },
}))

vi.mock('@/api/modules/news', () => ({
  newsApi: {
    getNews: vi.fn(async () => ({ code: 200, data: { items: [], total: 0, totalPages: 0 } })),
    createNews: vi.fn(async () => ({ code: 200, data: {} })),
    updateNews: vi.fn(async () => ({ code: 200, data: {} })),
    deleteNews: vi.fn(async () => ({ code: 200 })),
    publishNews: vi.fn(async () => ({ code: 200 })),
    revokeNews: vi.fn(async () => ({ code: 200 })),
  },
}))

vi.mock('@/api/modules/permission', () => ({
  permissionApi: {
    getAdmins: vi.fn(async () => ({ code: 200, data: { items: [], total: 0 } })),
    getPermissions: vi.fn(async () => ({ code: 200, data: [] })),
    updateAdminPermissions: vi.fn(async () => ({ code: 200 })),
    createAdmin: vi.fn(async () => ({ code: 200 })),
    updateAdmin: vi.fn(async () => ({ code: 200 })),
    deleteAdmin: vi.fn(async () => ({ code: 200 })),
  },
}))

// wangEditor (NewsManage.vue)
vi.mock('@wangeditor/editor-for-vue', () => ({
  Editor: defineComponent({ name: 'WangEditor', template: '<div />' }),
  Toolbar: defineComponent({ name: 'WangToolbar', template: '<div />' }),
}))
vi.mock('@wangeditor/editor/dist/css/style.css', () => ({}))

const baseMountOptions = {
  global: {
    stubs: {
      'router-link': defineComponent({ name: 'RouterLink', template: '<a><slot /></a>' }),
      'router-view': defineComponent({ name: 'RouterView', template: '<div><slot /></div>' }),
      Transition: false,
      'transition-group': false,
    },
    directives: {
      permission: () => undefined,
    },
    mocks: {
      $route: { path: '/', meta: {}, params: { id: '1' }, query: {} },
    },
  },
}

const viewImports: Array<[string, () => Promise<any>]> = [
  ['AddCanteen', () => import('@/views/AddCanteen.vue')],
  ['AddSubDish', () => import('@/views/AddSubDish.vue')],
  ['BatchAdd', () => import('@/views/BatchAdd.vue')],
  ['CommentManage', () => import('@/views/CommentManage.vue')],
  ['ConfigManage', () => import('@/views/ConfigManage.vue')],
  ['EditDish', () => import('@/views/EditDish.vue')],
  ['Login', () => import('@/views/Login.vue')],
  ['LogView', () => import('@/views/LogView.vue')],
  ['ModifyDish', () => import('@/views/ModifyDish.vue')],
  ['NewsManage', () => import('@/views/NewsManage.vue')],
  ['ReportManage', () => import('@/views/ReportManage.vue')],
  ['ReviewDish', () => import('@/views/ReviewDish.vue')],
  ['ReviewDishDetail', () => import('@/views/ReviewDishDetail.vue')],
  ['ReviewManage', () => import('@/views/ReviewManage.vue')],
  ['SingleAdd', () => import('@/views/SingleAdd.vue')],
  ['UserManage', () => import('@/views/UserManage.vue')],
  ['ViewDishDetail', () => import('@/views/ViewDishDetail.vue')],
]

describe('views smoke', () => {
  it.each(viewImports)('%s mounts without crashing', async (_name, importer) => {
    const mod = await importer()
    const Comp = mod.default

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const wrapper = shallowMount(Comp, baseMountOptions)
    await flushPromises()

    expect(wrapper.exists()).toBe(true)

    wrapper.unmount()
    alertSpy.mockRestore()
    confirmSpy.mockRestore()
  })
})
