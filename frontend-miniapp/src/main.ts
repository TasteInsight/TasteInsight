import { createSSRApp } from "vue";
import App from "./App.vue";
import pinia from "./store";
import './static/tailwind.css'
import config from '@/config';
export function createApp() {
  const app = createSSRApp(App);
  console.log('Base URL:', config.baseUrl);
  app.use(pinia);
  return {
    app,
  };  
}
