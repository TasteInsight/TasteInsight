import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'
import MainLayout from '@/components/Layout/MainLayout.vue'
import SingleAdd from '../views/SingleAdd.vue'
import BatchAdd from '../views/BatchAdd.vue'
import ModifyDish from '../views/ModifyDish.vue'
import EditDish from '../views/EditDish.vue'
import AddSubDish from '../views/AddSubDish.vue'
import AddCanteen from '../views/AddCanteen.vue'
import ReviewDish from '../views/ReviewDish.vue'
import ReviewDishDetail from '../views/ReviewDishDetail.vue'
import ViewDishDetail from '../views/ViewDishDetail.vue'
import UserManage from '../views/UserManage.vue'
import NewsManage from '../views/NewsManage.vue'
import LogView from '../views/LogView.vue'
import ReportManage from '../views/ReportManage.vue'
import CommentManage from '../views/CommentManage.vue'
import ConfigManage from '../views/ConfigManage.vue'
import Login from '../views/Login.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false },
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
        meta: { requiresAuth: true, requiredPermission: 'dish:view' },
      },
      {
        path: 'batch-add',
        name: 'BatchAdd',
        component: BatchAdd,
        meta: { requiresAuth: true, requiredPermission: 'dish:view' },
      },
      {
        path: 'modify-dish',
        name: 'ModifyDish',
        component: ModifyDish,
        meta: { requiresAuth: true, requiredPermission: 'dish:view' },
      },
      {
        path: 'edit-dish/:id',
        name: 'EditDish',
        component: EditDish,
        meta: { requiresAuth: true, requiredPermission: 'dish:view' },
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
        meta: { requiresAuth: true, requiredPermission: 'dish:view' },
      },
      {
        path: 'add-canteen',
        name: 'AddCanteen',
        component: AddCanteen,
        meta: { requiresAuth: true, requiredPermission: 'canteen:view' },
      },
      {
        path: 'review-dish',
        name: 'ReviewDish',
        component: ReviewDish,
        meta: { requiresAuth: true, requiredPermission: 'upload:approve' },
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
        meta: { requiresAuth: true, requiredPermission: 'admin:view' },
      },
      {
        path: 'news-manage',
        name: 'NewsManage',
        component: NewsManage,
        meta: { requiresAuth: true, requiredPermission: 'news:view' },
      },
      {
        path: 'log-view',
        name: 'LogView',
        component: LogView,
        meta: { requiresAuth: true, requiredPermission: 'admin:view' },
      },
      {
        path: 'report-manage',
        name: 'ReportManage',
        component: ReportManage,
        meta: { requiresAuth: true, requiredPermission: 'report:handle' },
      },
      {
        path: 'comment-manage',
        name: 'CommentManage',
        component: CommentManage,
        meta: { requiresAuth: true, requiredPermission: 'review:delete' },
      },
      {
        path: 'config-manage',
        name: 'ConfigManage',
        component: ConfigManage,
        meta: { requiresAuth: true, requiredPermission: 'config:view' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 根据权限获取第一个可访问的页面
function getFirstAccessibleRoute(authStore: ReturnType<typeof useAuthStore>): string {
  const routePriority = [
    { path: '/single-add', permission: 'dish:view' },
    { path: '/modify-dish', permission: 'dish:view' },
    { path: '/review-dish', permission: 'upload:approve' },
    { path: '/add-canteen', permission: 'canteen:view' },
    { path: '/user-manage', permission: 'admin:view' },
    { path: '/news-manage', permission: 'news:view' },
    { path: '/report-manage', permission: 'report:handle' },
    { path: '/comment-manage', permission: 'review:delete' },
    { path: '/config-manage', permission: 'config:view' },
  ]
  
  // 找到第一个有权限的页面
  for (const route of routePriority) {
    if (authStore.hasPermission(route.permission)) {
      return route.path
    }
  }
  
  // 如果没有任何权限，返回第一个页面（虽然不应该发生）
  return '/single-add'
}

// 路由守卫
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  // 检查路由是否需要认证
  if (to.meta.requiresAuth) {
    if (authStore.isLoggedIn) {
      // 检查是否有访问该路由的权限
      const requiredPermission = to.meta.requiredPermission as string | undefined
      if (requiredPermission && !authStore.hasPermission(requiredPermission)) {
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
