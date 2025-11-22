import { createPinia } from 'pinia';


export { useAuthStore } from './modules/use-auth-store';
export { useDishStore } from './modules/use-dish-store';
const pinia = createPinia();

export default pinia;