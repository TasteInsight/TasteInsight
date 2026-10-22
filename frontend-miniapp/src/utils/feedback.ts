let registered = false;

export function registerFeedbackDefaults(): void {
  if (registered) return;

  uni.addInterceptor('showModal', {
    invoke(options: UniNamespace.ShowModalOptions) {
      options.confirmText ??= t('common.confirm');
      options.cancelText ??= t('common.cancel');
      options.confirmColor ??= '#660874';
      options.cancelColor ??= '#667085';
    },
  });
  uni.addInterceptor('showActionSheet', {
    invoke(options: UniNamespace.ShowActionSheetOptions) {
      options.itemColor ??= '#1f2937';
    },
  });

  registered = true;
}
import { t } from '@/i18n';
