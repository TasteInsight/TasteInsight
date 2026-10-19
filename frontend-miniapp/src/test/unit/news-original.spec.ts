import config from '@/config';
import { openNewsOriginal, originalArticleUrl } from '@/utils/news-original';
jest.mock('@/config', () => ({ __esModule: true, default: { platform: 'h5' } }));
const url = 'https://mp.weixin.qq.com/s/article';
beforeEach(() => {
  (global as any).uni = { showModal: jest.fn(), setClipboardData: jest.fn(), showToast: jest.fn() };
});
afterEach(() => {
  jest.restoreAllMocks();
  delete (global as any).wx;
  delete (global as any).plus;
});
test('accepts only original article URLs on the exact HTTPS WeChat host', () => {
  expect(originalArticleUrl(url)).toBe(url);
  for (const value of [
    'javascript:bad()',
    'https://evil.test/s/a',
    'https://user@mp.weixin.qq.com/s/a',
    'https://mp.weixin.qq.com.evil.test/s/a',
    'https://mp.weixin.qq.com/mp/homepage',
  ])
    expect(originalArticleUrl(value)).toBeNull();
});
test('opens the source in a separate browser tab on H5', () => {
  config.platform = 'h5';
  const open = jest.spyOn(window, 'open').mockReturnValue(null);
  openNewsOriginal(url);
  expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
});
test('opens a native external URL in App and offers copying on failure', () => {
  config.platform = 'app';
  const openURL = jest.fn((_url, fail) => fail());
  (global as any).plus = { runtime: { openURL } };
  openNewsOriginal(url);
  expect(openURL).toHaveBeenCalled();
  expect(uni.showModal).toHaveBeenCalled();
});
test('uses the supported miniapp article API and provides a copy fallback', () => {
  config.platform = 'mp-weixin';
  const open = jest.fn(options => options.fail());
  (global as any).wx = { openOfficialAccountArticle: open };
  openNewsOriginal(url);
  expect(open).toHaveBeenCalledWith({ url, fail: expect.any(Function) });
  const options = (uni.showModal as jest.Mock).mock.calls[0][0];
  options.success({ confirm: true });
  expect(uni.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: url }));
});

test('validates original URLs in miniapp runtimes without a URL global', () => {
  const saved = global.URL;
  try {
    (global as any).URL = undefined;
    expect(originalArticleUrl(url)).toBe(url);
    expect(originalArticleUrl('https://mp.weixin.qq.com/s?__biz=x&mid=1')).toBe(
      'https://mp.weixin.qq.com/s?__biz=x&mid=1'
    );
    expect(originalArticleUrl('https://mp.weixin.qq.com/s/\\evil')).toBeNull();
  } finally {
    global.URL = saved;
  }
});
