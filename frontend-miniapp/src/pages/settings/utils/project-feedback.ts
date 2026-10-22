import { t } from '@/i18n';
export function copyProjectFeedbackLink() {
  uni.setClipboardData({
    data: 'https://github.com/TasteInsight/TasteInsight/issues',
    fail: () => uni.showToast({ title: t('account.settings.unableToCopyTryAgain'), icon: 'none' }),
  });
}
