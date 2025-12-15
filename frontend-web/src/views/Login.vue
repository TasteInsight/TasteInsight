<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none"></div>

    <div class="w-full max-w-md relative z-10">
      <!-- 登录卡片 -->
      <div class="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 space-y-8">
        <!-- Logo/标题区域 -->
        <div class="text-center space-y-3">
          <div class="flex justify-center mb-6">
            <div
              class="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200 overflow-hidden border-2 border-gray-200"
            >
              <img
                src="@/assets/images/TasteInsight.png"
                alt="TasteInsight"
                class="w-full h-full object-contain"
              />
            </div>
          </div>
          <h1 class="text-3xl font-bold text-gray-900">食鉴管理员登录</h1>
          <p class="text-gray-500 text-sm">请输入您的账号和密码以继续</p>
        </div>

        <!-- 登录表单 -->
        <form @submit.prevent="handleLogin" class="space-y-6">
          <!-- 用户名输入 -->
          <div>
            <label for="username" class="block text-sm font-semibold text-gray-700 mb-2">
              用户名
            </label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                <span class="iconify text-lg" data-icon="carbon:user"></span>
              </span>
              <input
                id="username"
                v-model="loginForm.username"
                type="text"
                required
                placeholder="请输入用户名"
                @input="clearLoginError"
                class="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-tsinghua-purple focus:border-tsinghua-purple outline-none transition-all duration-200 placeholder:text-gray-400"
                :class="{
                  'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400':
                    errors.username,
                }"
              />
            </div>
            <p v-if="errors.username" class="mt-2 text-sm text-red-500 flex items-center">
              <span class="iconify mr-1 text-xs" data-icon="carbon:warning"></span>
              {{ errors.username }}
            </p>
          </div>

          <!-- 密码输入 -->
          <div>
            <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">
              密码
            </label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                <span class="iconify text-lg" data-icon="carbon:password"></span>
              </span>
              <input
                id="password"
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                required
                placeholder="请输入密码"
                @input="clearLoginError"
                class="w-full pl-12 pr-12 py-3.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-tsinghua-purple focus:border-tsinghua-purple outline-none transition-all duration-200 placeholder:text-gray-400"
                :class="{
                  'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400':
                    errors.password,
                }"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <span
                  class="iconify text-lg"
                  :data-icon="showPassword ? 'carbon:view-off' : 'carbon:view'"
                ></span>
              </button>
            </div>
            <p v-if="errors.password" class="mt-2 text-sm text-red-500 flex items-center">
              <span class="iconify mr-1 text-xs" data-icon="carbon:warning"></span>
              {{ errors.password }}
            </p>
          </div>

          <!-- 记住我 -->
          <div class="flex items-center justify-between pt-2">
            <label class="flex items-center cursor-pointer group">
              <input
                v-model="loginForm.remember"
                type="checkbox"
                class="w-4 h-4 text-tsinghua-purple border-gray-300 rounded focus:ring-2 focus:ring-tsinghua-purple focus:ring-offset-0 cursor-pointer transition-colors"
              />
              <span class="ml-2 text-sm text-gray-600 group-hover:text-gray-900 transition-colors"
                >记住我</span
              >
            </label>
            <a
              href="#"
              @click.prevent="handleForgotPassword"
              class="text-sm text-tsinghua-purple hover:text-tsinghua-dark transition-colors duration-200 font-medium"
            >
              忘记密码？
            </a>
          </div>

          <!-- 登录按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3.5 bg-tsinghua-purple text-white rounded-xl font-semibold hover:bg-tsinghua-dark hover:shadow-lg hover:shadow-tsinghua-purple/30 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span
              v-if="loading"
              class="iconify animate-spin text-lg"
              data-icon="carbon:circle-dash"
            ></span>
            <span v-else class="iconify text-lg" data-icon="carbon:login"></span>
            <span>{{ loading ? '登录中...' : '登录' }}</span>
          </button>
        </form>
      </div>

      <!-- 底部信息 -->
      <div class="mt-8 text-center">
        <p class="text-gray-500 text-sm">© 2025 食鉴TasteInsight开发团队</p>
      </div>
    </div>

    <!-- 错误弹窗 -->
    <div
      v-if="showErrorModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      @click.self="closeErrorModal"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all">
        <div class="p-6">
          <div class="flex items-center justify-center mb-4">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <span class="iconify text-red-500 text-3xl" data-icon="carbon:warning"></span>
            </div>
          </div>
          <h3 class="text-xl font-semibold text-gray-800 text-center mb-2">登录失败</h3>
          <p class="text-gray-600 text-center mb-6">{{ errorMessage || '用户名或密码错误' }}</p>
          <button
            @click="closeErrorModal"
            class="w-full py-3 bg-tsinghua-purple text-white rounded-xl font-semibold hover:bg-tsinghua-dark hover:shadow-lg hover:shadow-tsinghua-purple/30 transition-all duration-200"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()

    const loginForm = reactive({
      username: '',
      password: '',
      remember: false,
    })

    const errors = reactive({
      username: '',
      password: '',
    })

    const showPassword = ref(false)
    const loading = ref(false)
    const errorMessage = ref('')
    const showErrorModal = ref(false)
    const loginError = ref('')

    const validateForm = () => {
      errors.username = ''
      errors.password = ''
      let isValid = true

      if (!loginForm.username.trim()) {
        errors.username = '请输入用户名'
        isValid = false
      }

      if (!loginForm.password) {
        errors.password = '请输入密码'
        isValid = false
      } else if (loginForm.password.length < 6) {
        errors.password = '密码长度至少为6位'
        isValid = false
      }

      return isValid
    }

    const handleLogin = async () => {
      // 清除之前的错误信息
      errorMessage.value = ''
      loginError.value = ''
      errors.username = ''
      errors.password = ''

      // 表单验证
      if (!validateForm()) {
        return
      }

      loading.value = true

      try {
        await authStore.login({
          username: loginForm.username,
          password: loginForm.password,
          remember: loginForm.remember,
        })

        // 登录成功，跳转到之前访问的页面或第一个有权限的页面
        const queryRedirect = router.currentRoute.value.query.redirect
        const storageRedirect = sessionStorage.getItem('login_redirect')
        const savedRedirect = (typeof queryRedirect === 'string' ? queryRedirect : null) || storageRedirect
        sessionStorage.removeItem('login_redirect')
        
        if (savedRedirect) {
          // 如果有保存的重定向地址，尝试跳转
          router.push(savedRedirect)
        } else {
          // 否则根据权限跳转到第一个有权限的页面
          const routePriority = [
            { path: '/single-add', permission: 'dish:view' },
            { path: '/modify-dish', permission: 'dish:view' },
            { path: '/review-dish', permission: 'upload:approve' },
            { path: '/add-canteen', permission: 'canteen:view' },
            { path: '/user-manage', permission: 'admin:view' },
            { path: '/news-manage', permission: 'news:view' },
            { path: '/report-manage', permission: 'report:handle' },
          ]
          
          // 找到第一个有权限的页面
          let targetRoute = '/single-add'
          for (const route of routePriority) {
            if (authStore.hasPermission(route.permission)) {
              targetRoute = route.path
              break
            }
          }
          
          router.push(targetRoute)
        }
      } catch (error) {
        // 登录失败，显示错误信息
        const errorMsg = '用户名或密码错误'
        loginError.value = errorMsg
        // 设置用户名和密码框的错误状态，使边框变红
        errors.username = errorMsg
        errors.password = errorMsg
        
        // 保留原有的错误弹窗逻辑（可选，如果需要可以移除）
        if (error instanceof Error) {
          errorMessage.value = error.message || errorMsg
        } else {
          errorMessage.value = errorMsg
        }
        // 显示错误弹窗
        showErrorModal.value = true
      } finally {
        loading.value = false
      }
    }

    const closeErrorModal = () => {
      showErrorModal.value = false
      errorMessage.value = ''
    }

    const handleForgotPassword = () => {
      alert('如果您忘记了密码，请联系上级管理员重置密码。')
    }

    const clearLoginError = () => {
      // 当用户开始输入时，清除登录错误状态
      if (loginError.value) {
        loginError.value = ''
        errors.username = ''
        errors.password = ''
      }
    }

    return {
      loginForm,
      errors,
      showPassword,
      loading,
      errorMessage,
      showErrorModal,
      loginError,
      handleLogin,
      handleForgotPassword,
      closeErrorModal,
      clearLoginError,
    }
  },
}
</script>
