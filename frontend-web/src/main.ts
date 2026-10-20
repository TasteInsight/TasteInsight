import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index'
import pinia from './store'
import { permission } from './directives/permission'
import AppIcon from './components/Common/AppIcon.vue'
import './assets/tailwind.css'
import './assets/admin-layout.css'
import { setLoginRedirect } from './utils/request'
import { useAuthStore } from './store/modules/use-auth-store'
import { canAccessRoute, getFirstAccessibleRoute } from './router/access'
import { notify } from './composables/useNotification'

const app = createApp(App)

app.use(pinia)
app.use(router)
setLoginRedirect((redirect) => router.push({ path: '/login', query: { redirect } }))
app.directive('permission', permission)
app.component('AppIcon', AppIcon)
app.mount('#app')

window.addEventListener('focus', async () => {
  const auth = useAuthStore()
  if (!auth.isLoggedIn) return
  try {
    await auth.refreshSession()
    if (auth.user?.mustChangePassword) await router.replace('/change-password')
    else if (!canAccessRoute(router.currentRoute.value.meta, auth)) await router.replace(getFirstAccessibleRoute(auth))
  } catch (error) {
    if (auth.isLoggedIn) notify.error(error instanceof Error ? error.message : '读取当前权限失败，请重试')
  }
})
