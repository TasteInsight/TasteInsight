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
      title: '查看微信原文',
      content: '当前环境暂时无法直接打开。复制原文链接后，可在微信中打开。',
      confirmText: '复制链接',
      success: result => {
        if (result.confirm)
          uni.setClipboardData({
            data: url,
            fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' }),
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
