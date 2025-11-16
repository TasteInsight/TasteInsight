<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-tsinghua-purple to-tsinghua-dark px-4">
    <div class="w-full max-w-md">
      <!-- 登录卡片 -->
      <div class="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <!-- Logo/标题区域 -->
        <div class="text-center space-y-2">
          <div class="flex justify-center mb-4">
            <div class="w-16 h-16 bg-tsinghua-purple rounded-full flex items-center justify-center">
              <span class="iconify text-white text-3xl" data-icon="carbon:user-admin"></span>
            </div>
          </div>
          <h1 class="text-3xl font-bold text-gray-800">管理员登录</h1>
          <p class="text-gray-500">请输入您的账号和密码</p>
        </div>

        <!-- 登录表单 -->
        <form @submit.prevent="handleLogin" class="space-y-5">
          <!-- 用户名输入 -->
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-2">
              用户名
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <span class="iconify" data-icon="carbon:user"></span>
              </span>
              <input
                id="username"
                v-model="loginForm.username"
                type="text"
                required
                placeholder="请输入用户名"
                class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple focus:border-transparent outline-none transition"
                :class="{ 'border-red-500': errors.username }"
              />
            </div>
            <p v-if="errors.username" class="mt-1 text-sm text-red-500">{{ errors.username }}</p>
          </div>

          <!-- 密码输入 -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <span class="iconify" data-icon="carbon:password"></span>
              </span>
              <input
                id="password"
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                required
                placeholder="请输入密码"
                class="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple focus:border-transparent outline-none transition"
                :class="{ 'border-red-500': errors.password }"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <span class="iconify" :data-icon="showPassword ? 'carbon:view-off' : 'carbon:view'"></span>
              </button>
            </div>
            <p v-if="errors.password" class="mt-1 text-sm text-red-500">{{ errors.password }}</p>
          </div>

          <!-- 记住我 -->
          <div class="flex items-center justify-between">
            <label class="flex items-center">
              <input
                v-model="loginForm.remember"
                type="checkbox"
                class="w-4 h-4 text-tsinghua-purple border-gray-300 rounded focus:ring-tsinghua-purple"
              />
              <span class="ml-2 text-sm text-gray-600">记住我</span>
            </label>
            <a href="#" class="text-sm text-tsinghua-purple hover:text-tsinghua-dark">
              忘记密码？
            </a>
          </div>

          <!-- 登录按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 bg-tsinghua-purple text-white rounded-lg font-medium hover:bg-tsinghua-dark transition duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="iconify animate-spin" data-icon="carbon:circle-dash"></span>
            <span v-else class="iconify" data-icon="carbon:login"></span>
            <span>{{ loading ? '登录中...' : '登录' }}</span>
          </button>
        </form>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center space-x-2 text-red-700">
            <span class="iconify" data-icon="carbon:warning"></span>
            <span class="text-sm">{{ errorMessage }}</span>
          </div>
        </div>
      </div>

      <!-- 底部信息 -->
      <div class="mt-6 text-center text-white text-sm">
        <p>© 2024 清华大学食堂菜品管理系统</p>
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
      remember: false
    })
    
    const errors = reactive({
      username: '',
      password: ''
    })
    
    const showPassword = ref(false)
    const loading = ref(false)
    const errorMessage = ref('')
    
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
      
      // 表单验证
      if (!validateForm()) {
        return
      }
      
      loading.value = true
      
      try {
        await authStore.login({
          username: loginForm.username,
          password: loginForm.password,
          remember: loginForm.remember
        })
        
        // 登录成功，跳转到之前访问的页面或首页
        const redirect = router.currentRoute.value.query.redirect || '/'
        router.push(redirect)
      } catch (error) {
        // 登录失败，显示错误信息
        errorMessage.value = error.message || '登录失败，请检查用户名和密码'
      } finally {
        loading.value = false
      }
    }
    
    return {
      loginForm,
      errors,
      showPassword,
      loading,
      errorMessage,
      handleLogin
    }
  }
}
</script>

