import { useUserStore } from '@/store/modules/use-user-store';

const loginPath = '/pages/login/index';
let opening = false;
const pages = () => (typeof getCurrentPages === 'function' ? getCurrentPages() : []);

/** 登录保留来源页面及其筛选、滚动和草稿。 */
export function openLogin(): void {
  if (opening || pages().some(page => page.route === loginPath.slice(1))) return;
  opening = true;
  uni.navigateTo({
    url: loginPath,
    complete: () => {
      opening = false;
    },
  });
}

export function requireLogin(): boolean {
  if (useUserStore().isLoggedIn) return true;
  openLogin();
  return false;
}

export function returnFromLogin(): void {
  const stack = pages();
  if (stack.length && stack[stack.length - 1].route !== loginPath.slice(1)) return;
  const home = () => uni.switchTab({ url: '/pages/index/index' });
  if (stack.length > 1) uni.navigateBack({ delta: 1, fail: home });
  else home();
}
