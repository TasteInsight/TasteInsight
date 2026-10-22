import { ref } from 'vue';
import { createI18n } from 'vue-i18n';
import config from '@/config';
import * as common from './messages/common';
import * as account from './messages/account';
import * as food from './messages/food';
import * as social from './messages/social';
import navigationZh from '@/locale/zh-Hans.json';
import navigationEn from '@/locale/en.json';

export type AppLocale = 'zh-Hans' | 'en';
export type LanguagePreference = AppLocale | 'system';
const preferenceKey = 'tasteinsight.language';

export const messages = {
  'zh-Hans': {
    ...navigationZh,
    common: common.zhHans,
    account: account.zhHans,
    food: food.zhHans,
    social: social.zhHans,
  },
  en: {
    ...navigationEn,
    common: common.en,
    account: account.en,
    food: food.en,
    social: social.en,
  },
};

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  flatJson: true,
  locale: 'zh-Hans',
  fallbackLocale: 'en',
  messages,
});

export const locale = i18n.global.locale;
export const languagePreference = ref<LanguagePreference>('system');
export function t(key: string, params: Record<string, string | number> = {}): string {
  return i18n.global.t(key, params);
}

export function normalizeLocale(value?: string): AppLocale {
  return /^zh(?:[-_]|$)/i.test(value || '') ? 'zh-Hans' : 'en';
}

function systemLocale(): AppLocale {
  return normalizeLocale(uni.getSystemInfoSync().language);
}

function applyLocale(value: AppLocale): void {
  locale.value = value;
  // #ifdef H5
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  // #endif
  // Android 的原生语言 API 会重启进程；应用文案和导航由当前语言状态同步。
  const androidApp = config.platform === 'app' && uni.getSystemInfoSync().platform === 'android';
  if (!androidApp && uni.getLocale() !== value) uni.setLocale(value);
}

export function initializeI18n(): void {
  const saved = uni.getStorageSync(preferenceKey);
  languagePreference.value = saved === 'en' || saved === 'zh-Hans' ? saved : 'system';
  applyLocale(languagePreference.value === 'system' ? systemLocale() : languagePreference.value);
}

export function setLanguagePreference(value: LanguagePreference): void {
  languagePreference.value = value;
  uni.setStorageSync(preferenceKey, value);
  applyLocale(value === 'system' ? systemLocale() : value);
}

export function syncSystemLocale(): void {
  if (languagePreference.value === 'system') applyLocale(systemLocale());
}
