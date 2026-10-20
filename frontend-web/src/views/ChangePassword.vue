<template>
  <main class="admin-login min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <form class="w-full max-w-md bg-white rounded-xl p-6 space-y-5" @submit.prevent="submit">
      <h1 class="text-xl font-semibold text-gray-900">设置管理员密码</h1>
      <p class="text-sm leading-6 text-gray-600">
        请为 {{ authStore.user?.username }} 设置个人密码，完成后重新登录。
      </p>
      <label class="block admin-label"
        >当前密码<input
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          required
          class="mt-2 w-full admin-input"
      /></label>
      <label class="block admin-label"
        >新密码<input
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
          class="mt-2 w-full admin-input"
      /></label>
      <p class="text-sm text-gray-600">至少 8 位，包含大小写字母、数字和特殊符号。</p>
      <label class="block admin-label"
        >确认新密码<input
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          class="mt-2 w-full admin-input"
      /></label>
      <p v-if="error" class="admin-feedback admin-feedback-error admin-field-error" role="alert">
        {{ error }}
      </p>
      <div class="flex flex-wrap gap-3">
        <button :disabled="saving" type="submit" class="admin-button admin-button-primary">
          {{ saving ? '保存中…' : '保存并重新登录' }}
        </button>
        <button
          :disabled="saving"
          type="button"
          class="admin-button admin-button-secondary"
          @click="leave"
        >
          退出登录
        </button>
      </div>
    </form>
  </main>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { permissionApi } from '@/api/modules/permission'
import { notify } from '@/composables/useNotification'
const authStore = useAuthStore()
const router = useRouter()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const error = ref('')
function leave() {
  authStore.logout()
  void router.replace('/login')
}
async function submit() {
  if (saving.value) return
  error.value = ''
  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次输入的新密码不一致'
    return
  }
  saving.value = true
  try {
    const response = await permissionApi.changeOwnPassword(currentPassword.value, newPassword.value)
    if (response.code !== 200) throw new Error(response.message || '密码保存失败')
    leave()
    notify.success('密码已更新，请重新登录')
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : '密码保存失败，请重试'
  } finally {
    saving.value = false
  }
}
</script>
