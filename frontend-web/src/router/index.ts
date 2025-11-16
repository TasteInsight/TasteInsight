import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'
import SingleAdd from '../views/SingleAdd.vue'
import BatchAdd from '../views/BatchAdd.vue'
import ModifyDish from '../views/ModifyDish.vue'
import EditDish from '../views/EditDish.vue'
import ReviewDish from '../views/ReviewDish.vue'
import ReviewDishDetail from '../views/ReviewDishDetail.vue'
import UserManage from '../views/UserManage.vue'
import Login from '../views/Login.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/single-add'
  },
  {
    path: '/single-add',
    name: 'SingleAdd',
    component: SingleAdd,
    meta: { requiresAuth: true }
  },
  {
    path: '/batch-add',
    name: 'BatchAdd',
    component: BatchAdd,
    meta: { requiresAuth: true }
  },
  {
    path: '/modify-dish',
    name: 'ModifyDish',
    component: ModifyDish,
    meta: { requiresAuth: true }
  },
  {
    path: '/edit-dish/:id',
    name: 'EditDish',
    component: EditDish,
    meta: { requiresAuth: true }
  },
  {
    path: '/review-dish',
    name: 'ReviewDish',
    component: ReviewDish,
    meta: { requiresAuth: true }
  },
  {
    path: '/review-dish/:id',
    name: 'ReviewDishDetail',
    component: ReviewDishDetail,
    meta: { requiresAuth: true }
  },
  {
    path: '/user-manage',
    name: 'UserManage',
    component: UserManage,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  
  
  // 检查路由是否需要认证
  if (to.meta.requiresAuth) {
    if (authStore.isLoggedIn) {
      // 已登录，允许访问
      next()
    } else {
      // 未登录，重定向到登录页
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
    }
  } else {
    // 不需要认证的路由
    if (to.path === '/login' && authStore.isLoggedIn) {
      // 已登录用户访问登录页，重定向到首页
      next('/')
    } else {
      next()
    }
  }
})

export default router