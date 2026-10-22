import { createSSRApp } from 'vue';
import App from './App.vue';
import pinia from './store';
import './styles/tailwind.generated.css';
import '@/assets/iconfont/iconfont.css';
import config from '@/config';
export function createApp() {
  const app = createSSRApp(App);
  console.log('Base URL:', config.baseUrl);
  app.use(pinia);
  return {
    app,
  };
}
