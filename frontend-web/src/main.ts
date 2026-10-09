import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index'
import pinia from './store'
import { permission } from './directives/permission'
import AppIcon from './components/Common/AppIcon.vue'
import './assets/tailwind.css'

const app = createApp(App)

app.use(pinia)
app.use(router)
app.directive('permission', permission)
app.component('AppIcon', AppIcon)
app.mount('#app')
