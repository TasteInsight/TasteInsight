import { t } from '@/i18n';
import { requireLogin } from '@/utils/login-navigation';
import { useUserStore } from '@/store/modules/use-user-store';

export function requireStudent(): boolean {
  if (!requireLogin()) return false;
  const user = useUserStore();
  if (user.userInfo?.capabilities?.canContribute) return true;
  uni.showModal({
    title: t('account.common.verifyYourCampusIdentity'),
    content: t('account.common.verifyToPostReviewsAnd'),
    confirmText: t('common.modal.verify'),
    cancelText: t('common.modal.browse'),
    success: result => {
      if (result.confirm) uni.navigateTo({ url: '/pages/profile/identity' });
    },
  });
  return false;
}
