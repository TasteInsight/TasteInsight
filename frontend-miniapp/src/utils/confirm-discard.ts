import { t } from '@/i18n';
export function confirmDiscardChanges(dirty: boolean, content: string): Promise<boolean> {
  if (!dirty) return Promise.resolve(true);
  return new Promise(resolve => {
    uni.showModal({
      title: t('account.common.discardChanges'),
      content,
      confirmText: t('common.modal.discard'),
      cancelText: t('common.modal.edit'),
      success: result => resolve(result.confirm),
      fail: () => resolve(false),
    });
  });
}
