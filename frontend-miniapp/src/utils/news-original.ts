import { t } from '@/i18n';
import config from '@/config';

export function originalArticleUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // The backend stores normalized URLs; keep this allowlist compatible with miniapp runtimes.
  return /^https:\/\/mp\.weixin\.qq\.com\/s(?:\/|[?#]|$)/.test(value) &&
    !/[\u0000-\u0020\u007f\\]/.test(value)
    ? value
    : null;
}

export function openNewsOriginal(value: unknown): void {
  const url = originalArticleUrl(value);
  if (!url) return;
  const copyLink = () =>
    uni.showModal({
      title: t('common.news.original'),
      content: t('common.news.copyHint'),
      confirmText: t('common.news.copy'),
      success: result => {
        if (result.confirm)
          uni.setClipboardData({
            data: url,
            fail: () => uni.showToast({ title: t('common.news.copyFailed'), icon: 'none' }),
          });
      },
    });
  if (config.platform === 'h5') {
    const page = window.open(url, '_blank', 'noopener,noreferrer');
    // Browsers may return null with noopener even when the new tab opened.
    void page;
  } else if (config.platform === 'app') {
    plus.runtime.openURL(url, copyLink);
  } else if (config.platform === 'mp-weixin') {
    const wechat = (
      globalThis as typeof globalThis & {
        wx?: { openOfficialAccountArticle?: (options: { url: string; fail: () => void }) => void };
      }
    ).wx;
    if (wechat?.openOfficialAccountArticle)
      wechat.openOfficialAccountArticle({ url, fail: copyLink });
    else copyLink();
  } else copyLink();
}
