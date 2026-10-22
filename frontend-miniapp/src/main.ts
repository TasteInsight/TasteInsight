import { createSSRApp } from 'vue';
import App from './App.vue';
import pinia from './store';
import './styles/tailwind.generated.css';
import '@/assets/iconfont/iconfont.css';
import config from '@/config';
import { i18n, initializeI18n } from '@/i18n';
import { syncNativeNavigation } from '@/i18n/navigation';
export function createApp() {
  initializeI18n();
  const app = createSSRApp(App);
  console.log('Base URL:', config.baseUrl);
  app.use(pinia);
  app.use(i18n);
  app.mixin({ onShow: syncNativeNavigation, onReady: syncNativeNavigation });
  return {
    app,
  };
}
