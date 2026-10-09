<template>
  <main class="min-h-screen flex items-center justify-center bg-gray-50 px-6">
    <section class="max-w-lg rounded-xl bg-white p-10 text-center shadow-sm">
      <div class="text-5xl font-semibold text-tsinghua-purple">403</div>
      <h1 class="mt-4 text-xl font-semibold text-gray-900">暂无可访问的管理功能</h1>
      <p class="mt-3 text-sm leading-6 text-gray-500">
        当前账号尚未分配管理权限，请联系超级管理员授权后重试。
      </p>
      <button
        type="button"
        class="mt-6 rounded-lg bg-tsinghua-purple px-5 py-2 text-white hover:bg-tsinghua-dark"
        @click="logout"
      >
        退出登录
      </button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'

const router = useRouter()
const authStore = useAuthStore()

const logout = () => {
  authStore.logout()
  router.replace('/login')
}
</script>
