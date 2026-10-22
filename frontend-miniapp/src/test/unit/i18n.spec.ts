import { nextTick } from 'vue';
import {
  initializeI18n,
  languagePreference,
  locale,
  normalizeLocale,
  setLanguagePreference,
  syncSystemLocale,
  t,
} from '@/i18n';
import { syncNativeNavigation } from '@/i18n/navigation';
import config from '@/config';

describe('application language', () => {
  const storage = new Map<string, unknown>();
  let systemLanguage = 'zh-CN';
  let nativeLocale = 'zh-Hans';
  const setLocale = jest.fn((value: string) => {
    nativeLocale = value;
  });

  beforeEach(() => {
    storage.clear();
    systemLanguage = 'zh-CN';
    nativeLocale = 'zh-Hans';
    (globalThis as any).uni = {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
      getSystemInfoSync: () => ({ language: systemLanguage }),
      getLocale: () => nativeLocale,
      setLocale,
      setTabBarItem: jest.fn(),
      setNavigationBarTitle: jest.fn(),
    };
    (globalThis as any).getCurrentPages = () => [];
    setLocale.mockClear();
    initializeI18n();
  });

  it.each([
    ['zh-CN', 'zh-Hans'],
    ['zh_Hans', 'zh-Hans'],
    ['zh-Hant', 'zh-Hans'],
    ['en-US', 'en'],
    ['ja-JP', 'en'],
    ['', 'en'],
  ])('maps system language %s to %s', (value, expected) => {
    expect(normalizeLocale(value)).toBe(expected);
  });

  it('follows the system by default and updates when the app becomes active', () => {
    expect(languagePreference.value).toBe('system');
    expect(locale.value).toBe('zh-Hans');
    systemLanguage = 'en-US';
    syncSystemLocale();
    expect(locale.value).toBe('en');
    expect(t('common.cancel')).toBe('Cancel');
  });

  it('persists an explicit choice across launches and restores system following', async () => {
    setLanguagePreference('en');
    expect(locale.value).toBe('en');
    initializeI18n();
    expect(languagePreference.value).toBe('en');
    expect(locale.value).toBe('en');
    systemLanguage = 'zh-CN';
    syncSystemLocale();
    expect(locale.value).toBe('en');
    setLanguagePreference('system');
    await nextTick();
    expect(locale.value).toBe('zh-Hans');
    expect(t('common.cancel')).toBe('取消');
    expect(document.documentElement.lang).toBe('zh-Hans');
  });

  it('formats named parameters without changing their values', () => {
    setLanguagePreference('en');
    expect(t('common.selectedCount', { count: 3 })).toBe('3 selected');
  });

  it('switches Android app text without invoking the native restart API', () => {
    const original = config.platform;
    config.platform = 'app';
    const info = uni.getSystemInfoSync;
    uni.getSystemInfoSync = jest.fn(() => ({ ...info(), language: 'zh-CN', platform: 'android' }));
    try {
      setLanguagePreference('en');
      expect(locale.value).toBe('en');
      expect(languagePreference.value).toBe('en');
      expect(setLocale).not.toHaveBeenCalled();
      expect(t('common.cancel')).toBe('Cancel');
    } finally {
      config.platform = original;
      uni.getSystemInfoSync = info;
    }
  });

  it('updates page titles immediately and tab labels when a tab page is shown', async () => {
    (globalThis as any).getCurrentPages = () => [{ route: 'pages/settings/index' }];
    syncNativeNavigation();
    expect(uni.setNavigationBarTitle).toHaveBeenLastCalledWith({ title: '设置' });
    setLanguagePreference('en');
    await nextTick();
    expect(uni.setNavigationBarTitle).toHaveBeenLastCalledWith({ title: 'Settings' });
    expect(uni.setTabBarItem).not.toHaveBeenCalled();
    (globalThis as any).getCurrentPages = () => [{ route: 'pages/profile/index' }];
    syncNativeNavigation();
    expect(uni.setNavigationBarTitle).toHaveBeenLastCalledWith({ title: 'Me' });
    expect(uni.setTabBarItem).toHaveBeenCalledWith({ index: 0, text: 'Home' });
  });

  it.each([
    ['mp-weixin', ['首页', '新闻', '规划', '问AI', '我的']],
    ['h5', ['首页', '校园', '规划', '问AI', '我的']],
    ['app', ['首页', '校园', '规划', '问AI', '我的']],
  ])('uses the compiled tab order on %s', (platform, expected) => {
    const original = config.platform;
    config.platform = platform as string;
    try {
      (uni.setTabBarItem as jest.Mock).mockClear();
      (globalThis as any).getCurrentPages = () => [{ route: 'pages/index/index' }];
      syncNativeNavigation();
      expect((uni.setTabBarItem as jest.Mock).mock.calls.map(([item]) => item.text)).toEqual(
        expected
      );
    } finally {
      config.platform = original;
    }
  });
});
