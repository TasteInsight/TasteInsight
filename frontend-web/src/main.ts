import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index'
import pinia from './store'
import { permission } from './directives/permission'
import './assets/tailwind.css'

const app = createApp(App)

app.use(pinia)
app.use(router)
app.directive('permission', permission)
app.mount('#app')
