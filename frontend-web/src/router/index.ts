import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { getFirstAccessibleRoute } from './access'
import MainLayout from '@/components/Layout/MainLayout.vue'

const Login = () => import('@/views/Login.vue')
const Forbidden = () => import('@/views/Forbidden.vue')
const SingleAdd = () => import('@/views/SingleAdd.vue')
const BatchAdd = () => import('@/views/BatchAdd.vue')
const ModifyDish = () => import('@/views/ModifyDish.vue')
const EditDish = () => import('@/views/EditDish.vue')
const AddSubDish = () => import('@/views/AddSubDish.vue')
const AddCanteen = () => import('@/views/AddCanteen.vue')
const ReviewDish = () => import('@/views/ReviewDish.vue')
const ReviewDishDetail = () => import('@/views/ReviewDishDetail.vue')
const ViewDishDetail = () => import('@/views/ViewDishDetail.vue')
const UserManage = () => import('@/views/UserManage.vue')
const NewsManage = () => import('@/views/NewsManage.vue')
const LogView = () => import('@/views/LogView.vue')
const ReportManage = () => import('@/views/ReportManage.vue')
const CommentManage = () => import('@/views/CommentManage.vue')
const ReviewManage = () => import('@/views/ReviewManage.vue')
const ConfigManage = () => import('@/views/ConfigManage.vue')
const ExperimentManage = () => import('@/views/ExperimentManage.vue')

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false },
  },
  {
    path: '/forbidden',
    name: 'Forbidden',
    component: Forbidden,
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    component: MainLayout,
    redirect: () => {
      // 根据权限跳转到第一个有权限的页面
      const authStore = useAuthStore()
      if (!authStore.isLoggedIn) {
        return '/login'
      }
      
      // 使用 getFirstAccessibleRoute 获取第一个有权限的页面
      const firstRoute = getFirstAccessibleRoute(authStore)
      return firstRoute
    },
    children: [
      {
        path: 'single-add',
        name: 'SingleAdd',
        component: SingleAdd,
        meta: { requiresAuth: true, requiredPermission: 'dish:create' },
      },
      {
        path: 'batch-add',
        name: 'BatchAdd',
        component: BatchAdd,
        meta: { requiresAuth: true, requiredPermission: 'dish:create' },
      },
      {
        path: 'modify-dish',
        name: 'ModifyDish',
        component: ModifyDish,
        meta: { requiresAuth: true, requiredPermission: 'dish:view', keepAlive: true },
      },
      {
        path: 'edit-dish/:id',
        name: 'EditDish',
        component: EditDish,
        meta: { requiresAuth: true, requiredPermission: 'dish:edit' },
      },
      {
        path: 'view-dish/:id',
        name: 'ViewDishDetail',
        component: ViewDishDetail,
        meta: { requiresAuth: true, requiredPermission: 'dish:view' },
      },
      {
        path: 'add-sub-dish',
        name: 'AddSubDish',
        component: AddSubDish,
        meta: { requiresAuth: true, requiredPermission: 'dish:create' },
      },
      {
        path: 'add-canteen',
        name: 'AddCanteen',
        component: AddCanteen,
        meta: { requiresAuth: true, requiredPermission: 'canteen:view', keepAlive: true },
      },
      {
        path: 'review-dish',
        name: 'ReviewDish',
        component: ReviewDish,
        meta: { requiresAuth: true, requiredPermission: 'upload:approve', keepAlive: true },
      },
      {
        path: 'review-dish/:id',
        name: 'ReviewDishDetail',
        component: ReviewDishDetail,
        meta: { requiresAuth: true, requiredPermission: 'upload:approve' },
      },
      {
        path: 'user-manage',
        name: 'UserManage',
        component: UserManage,
        meta: { requiresAuth: true, requiredPermission: 'admin:view', keepAlive: true },
      },
      {
        path: 'news-manage',
        name: 'NewsManage',
        component: NewsManage,
        meta: { requiresAuth: true, requiredPermission: 'news:view', keepAlive: true },
      },
      {
        path: 'log-view',
        name: 'LogView',
        component: LogView,
        meta: { requiresAuth: true, requiredPermission: 'admin:view', keepAlive: true },
      },
      {
        path: 'report-manage',
        name: 'ReportManage',
        component: ReportManage,
        meta: { requiresAuth: true, requiredPermission: 'report:handle', keepAlive: true },
      },
      {
        path: 'comment-manage',
        name: 'CommentManage',
        component: CommentManage,
        meta: {
          requiresAuth: true,
          requiredPermission: 'dish:view',
          requiredPermissions: ['review:delete', 'comment:delete'],
          keepAlive: true,
        },
      },
      {
        path: 'review-manage',
        name: 'ReviewManage',
        component: ReviewManage,
        meta: {
          requiresAuth: true,
          requiredPermissions: ['review:approve', 'comment:approve'],
          keepAlive: true,
        },
      },
      {
        path: 'config-manage',
        name: 'ConfigManage',
        component: ConfigManage,
        meta: { requiresAuth: true, requiredPermission: 'config:view', keepAlive: true },
      },
      {
        path: 'experiment-manage',
        name: 'ExperimentManage',
        component: ExperimentManage,
        meta: { requiresAuth: true, requiredPermission: 'experiment:view', keepAlive: true },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export { getFirstAccessibleRoute }

// 路由守卫
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  // 检查路由是否需要认证
  if (to.meta.requiresAuth) {
    if (authStore.isLoggedIn) {
      // 检查是否有访问该路由的权限
      const requiredPermission = to.meta.requiredPermission as string | undefined
      const requiredPermissions = to.meta.requiredPermissions as string[] | undefined
      const lacksRequiredPermission =
        Boolean(requiredPermission) && !authStore.hasPermission(requiredPermission as string)
      const lacksAnyRequiredPermission =
        Array.isArray(requiredPermissions) &&
        requiredPermissions.length > 0 &&
        !requiredPermissions.some((permission) => authStore.hasPermission(permission))
      if (lacksRequiredPermission || lacksAnyRequiredPermission) {
        // 没有权限，跳转到第一个有权限的页面
        const firstRoute = getFirstAccessibleRoute(authStore)
        next(firstRoute)
      } else {
        // 已登录且有权限，允许访问
        next()
      }
    } else {
      // 未登录，保存重定向地址并跳转
      sessionStorage.setItem('login_redirect', to.fullPath)
      next('/login')
    }
  } else {
    // 不需要认证的路由
    if (to.path === '/login' && authStore.isLoggedIn) {
      // 已登录用户访问登录页，重定向到第一个有权限的页面
      const firstRoute = getFirstAccessibleRoute(authStore)
      next(firstRoute)
    } else {
      next()
    }
  }
})

export default router
