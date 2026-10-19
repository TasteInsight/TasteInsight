import { openLogin } from '@/utils/login-navigation';
import { useUserStore } from '@/store/modules/use-user-store';

export function requireStudent(): boolean {
  const user = useUserStore();
  if (!user.isLoggedIn) {
    openLogin();
    return false;
  }
  if (user.userInfo?.capabilities?.canContribute) return true;
  uni.showModal({
    title: '完成校园身份认证',
    content: '认证后即可发布评价和参与互动。',
    confirmText: '去认证',
    cancelText: '继续浏览',
    success: result => {
      if (result.confirm) uni.navigateTo({ url: '/pages/profile/identity' });
    },
  });
  return false;
}
