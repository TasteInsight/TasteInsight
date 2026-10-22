import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { onHide, onLoad, onShow } from '@dcloudio/uni-app';
import SettingsHome from '../index.vue';
import LanguagePage from '../language.vue';
import AboutPage from '../about.vue';
import PrivacyPage from '../privacy.vue';
import EasterEgg from '@/pages/easter-egg/index.vue';
import UserHeader from '@/pages/profile/components/UserHeader.vue';
import { useDisplay } from '../composables/use-display';
import { usePreferences } from '../composables/use-preferences';
import { useUserStore } from '@/store/modules/use-user-store';
import { i18n, initializeI18n, languagePreference, locale, setLanguagePreference, t } from '@/i18n';
import { zhHans, en } from '@/i18n/messages/account';

jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onHide: jest.fn(),
  onUnload: jest.fn(),
}));
jest.mock('@/api/modules/canteen', () => ({
  getCanteenList: jest
    .fn()
    .mockResolvedValue({ code: 200, data: { items: [], meta: { totalPages: 1 } } }),
}));
jest.mock('@/pages/profile/composables/use-profile', () => ({
  useProfile: () => ({ isLoggedIn: false, handleLogout: jest.fn() }),
}));

const stored = new Map<string, unknown>();
let systemLanguage: string;
let nativeLanguage: string;
const wrappers: ReturnType<typeof mount>[] = [];
function render(component: any, options: any = {}) {
  const wrapper = mount(component, options);
  wrappers.push(wrapper);
  return wrapper;
}
function flatten(value: Record<string, any>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, message]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      return typeof message === 'string'
        ? [[fullKey, message]]
        : Object.entries(flatten(message, fullKey));
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  stored.clear();
  locale.value = 'zh-Hans';
  languagePreference.value = 'system';
  systemLanguage = 'en-US';
  nativeLanguage = 'zh-Hans';
  Object.assign(uni, {
    getStorageSync: jest.fn(key => stored.get(key)),
    setStorageSync: jest.fn((key, value) => stored.set(key, value)),
    getSystemInfoSync: jest.fn(() => ({ language: systemLanguage })),
    getLocale: jest.fn(() => nativeLanguage),
    setLocale: jest.fn(value => {
      nativeLanguage = value;
    }),
    setClipboardData: jest.fn(options => options.success?.()),
    vibrateShort: jest.fn(),
    setNavigationBarTitle: jest.fn(),
    showActionSheet: jest.fn(),
    navigateTo: jest.fn(),
    navigateBack: jest.fn(),
  });
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  locale.value = 'zh-Hans';
  languagePreference.value = 'system';
});

it('opens the dedicated language page for guests through touch and keyboard', async () => {
  const wrapper = render(SettingsHome);
  const languageButton = wrapper.get('button[aria-label="语言"]');
  expect(languageButton.text()).toContain('跟随系统');
  expect(wrapper.text()).toContain('登录');
  await languageButton.trigger('keydown', { key: 'Enter' });
  expect(uni.navigateTo).not.toHaveBeenCalled();
  await languageButton.trigger('keyup', { key: 'Enter' });
  expect(uni.navigateTo).toHaveBeenLastCalledWith(
    expect.objectContaining({ url: '/pages/settings/language' })
  );
  await languageButton.trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledTimes(2);
  expect(uni.showActionSheet).not.toHaveBeenCalled();
  expect(stored.has('tasteinsight.language')).toBe(false);
});

it('changes and saves language immediately on its own page while retaining the page and settings summary', async () => {
  const settings = render(SettingsHome);
  const wrapper = render(LanguagePage);
  const group = wrapper.get('radio-group');
  expect(group.attributes('role')).toBe('radiogroup');
  expect(group.attributes('aria-label')).toBe('语言');
  expect(wrapper.findAll('radio')).toHaveLength(3);
  expect(wrapper.get('radio[value="system"]').attributes('aria-checked')).toBe('true');
  await group.trigger('change', { detail: { value: 'en' } });
  await nextTick();
  expect(locale.value).toBe('en');
  expect(languagePreference.value).toBe('en');
  expect(stored.get('tasteinsight.language')).toBe('en');
  expect(wrapper.get('radio[value="en"]').attributes('aria-checked')).toBe('true');
  expect(group.attributes('aria-label')).toBe('Language');
  expect(settings.get('button[aria-label="Language"]').text()).toContain('English');
  expect(settings.text()).toContain('About TasteInsight');
  expect(uni.navigateBack).not.toHaveBeenCalled();
  expect(uni.showActionSheet).not.toHaveBeenCalled();

  await group.trigger('change', { detail: { value: 'zh-Hans' } });
  expect(locale.value).toBe('zh-Hans');
  expect(stored.get('tasteinsight.language')).toBe('zh-Hans');
  expect(wrapper.get('radio[value="zh-Hans"]').attributes('aria-checked')).toBe('true');
  await group.trigger('change', { detail: { value: 'system' } });
  expect(languagePreference.value).toBe('system');
  expect(locale.value).toBe('en');
  expect(stored.get('tasteinsight.language')).toBe('system');
  expect(wrapper.text()).toContain('Follow system');
});

it.each(['zh-Hans', 'en', 'system'] as const)(
  'restores the selected radio option for %s',
  async preference => {
    stored.set('tasteinsight.language', preference);
    initializeI18n();
    const wrapper = render(LanguagePage);
    expect(wrapper.get(`radio[value="${preference}"]`).attributes('aria-checked')).toBe('true');
    for (const radio of wrapper.findAll('radio')) {
      expect(radio.attributes('aria-checked')).toBe(
        String(radio.attributes('value') === preference)
      );
    }
  }
);

it.each(['Enter', ' '])(
  'selects a language once with the %j key and keeps user data intact',
  async key => {
    const user = useUserStore();
    user.userInfo = {
      id: 'one',
      nickname: '小明',
      preferences: { favoriteIngredients: ['豆腐'] },
    } as any;
    const snapshot = JSON.stringify(user.userInfo);
    const wrapper = render(LanguagePage);
    const english = wrapper.get('radio[value="en"]');
    expect(english.attributes('tabindex')).toBe('0');
    await english.trigger('keydown', { key });
    expect(stored.has('tasteinsight.language')).toBe(false);
    await english.trigger('keyup', { key });
    expect(stored.get('tasteinsight.language')).toBe('en');
    expect(english.attributes('aria-checked')).toBe('true');
    await english.trigger('keyup', { key });
    expect(uni.setStorageSync).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(user.userInfo)).toBe(snapshot);
    expect(uni.navigateBack).not.toHaveBeenCalled();
  }
);

it('restores a saved manual choice and resolves the system choice at initialization', () => {
  stored.set('tasteinsight.language', 'zh-Hans');
  initializeI18n();
  expect(locale.value).toBe('zh-Hans');
  expect(languagePreference.value).toBe('zh-Hans');
  stored.set('tasteinsight.language', 'system');
  initializeI18n();
  expect(locale.value).toBe('en');
  systemLanguage = 'zh_CN';
  initializeI18n();
  expect(locale.value).toBe('zh-Hans');
});

it('keeps both account dictionaries structurally identical and compiles every message', () => {
  const chinese = flatten(zhHans);
  const english = flatten(en);
  expect(Object.keys(english).sort()).toEqual(Object.keys(chinese).sort());
  const compileError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    for (const [key, message] of Object.entries(chinese)) {
      const placeholders = (value: string) =>
        [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort();
      expect(placeholders(english[key])).toEqual(placeholders(message));
      const params = Object.fromEntries(placeholders(message).map(name => [name, 'sample']));
      for (const language of ['zh-Hans', 'en'] as const) {
        locale.value = language;
        expect(t(`account.${key}`, params)).not.toBe(`account.${key}`);
      }
    }
    expect(compileError).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  } finally {
    compileError.mockRestore();
    warning.mockRestore();
  }
});

it('updates generated lab content and displays stored canonical titles in English', async () => {
  stored.set('TI_EASTER_EGG_STATE', {
    titles: ['食堂侦探'],
    equippedTitle: '食堂侦探',
    coins: 20,
  });
  const wrapper = render(EasterEgg);
  const vm = wrapper.vm as any;
  expect(wrapper.text()).toContain('食堂侦探');
  vm.startChallenge();
  vm.cancelChallenge();
  const originalDishParts = [...vm.dishParts];
  const originalFortuneParts = [...vm.fortuneParts];
  setLanguagePreference('en');
  await nextTick();
  expect(wrapper.text()).toContain('Canteen Detective');
  expect(wrapper.text()).toContain('Hidden Lab');
  expect(wrapper.text()).not.toMatch(/\p{Script=Han}/u);
  expect(vm.dishParts).toEqual(originalDishParts);
  expect(vm.fortuneParts).toEqual(originalFortuneParts);
  vm.equipRandomTitle();
  expect((stored.get('TI_EASTER_EGG_STATE') as any).equippedTitle).toBe('食堂侦探');
  expect((stored.get('TI_EASTER_EGG_STATE') as any).titles).toEqual(['食堂侦探']);
});

it('translates profile controls while preserving real nicknames and biographies', async () => {
  const wrapper = render(UserHeader, {
    props: {
      isLoggedIn: true,
      loading: false,
      userInfo: { id: 'one', nickname: '小明', bio: '我喜欢川菜' },
    },
  });
  setLanguagePreference('en');
  await nextTick();
  expect(wrapper.text()).toContain('小明');
  expect(wrapper.text()).toContain('我喜欢川菜');
  expect(wrapper.get('button').attributes('aria-label')).toBe('Manage profile: 小明 · 我喜欢川菜');
});

it('renders complete English privacy and about information, including a literal contact email', async () => {
  setLanguagePreference('en');
  const about = render(AboutPage);
  const privacy = render(PrivacyPage);
  await flushPromises();
  expect(about.text()).toContain('Terms and support');
  expect(about.text()).toContain('Disclaimer');
  expect(privacy.text()).toContain('Your rights and how to make a request');
  expect(privacy.text()).toContain('2366769492@qq.com');
  expect(privacy.text()).not.toMatch(/\p{Script=Han}/u);
  expect(i18n.global.locale.value).toBe('en');
});

it('updates a visible agreement title when language changes and leaves a hidden page inactive', async () => {
  render(PrivacyPage);
  (onLoad as jest.Mock).mock.calls[0][0]({ type: 'user' });
  await nextTick();
  expect(uni.setNavigationBarTitle).toHaveBeenLastCalledWith({ title: '用户协议' });
  setLanguagePreference('en');
  await nextTick();
  expect(uni.setNavigationBarTitle).toHaveBeenLastCalledWith({ title: 'Terms of Service' });
  (onHide as jest.Mock).mock.calls[0][0]();
  await nextTick();
  (uni.setNavigationBarTitle as jest.Mock).mockClear();
  setLanguagePreference('zh-Hans');
  await nextTick();
  expect(uni.setNavigationBarTitle).not.toHaveBeenCalled();
  (onShow as jest.Mock).mock.calls[0][0]();
  await nextTick();
  expect(uni.setNavigationBarTitle).toHaveBeenLastCalledWith({ title: '用户协议' });
});

it('updates display and preference labels while saving stable API values and ingredient data', async () => {
  const user = useUserStore();
  user.token = 'token';
  user.userInfo = {
    id: 'one',
    nickname: '小明',
    preferences: { portionSize: 'medium', favoriteIngredients: ['豆腐'] },
    settings: { displaySettings: { sortBy: 'rating', showCalories: true, showNutrition: false } },
  } as any;
  user.fetchProfileAction = jest.fn().mockResolvedValue(undefined);
  user.updateProfileAction = jest.fn().mockResolvedValue(undefined);
  let display!: ReturnType<typeof useDisplay>;
  let preferences!: ReturnType<typeof usePreferences>;
  render({
    setup() {
      display = useDisplay();
      preferences = usePreferences();
      return () => null;
    },
  });
  await flushPromises();
  expect(display.sortOptions.value[0]).toBe('评分优先');
  expect(preferences.portionLabels.value.small).toBe('小份');
  setLanguagePreference('en');
  await nextTick();
  expect(display.sortOptions.value[0]).toBe('Highest rated');
  expect(preferences.portionLabels.value.small).toBe('Small');
  expect(preferences.tasteLabels.value[0]).toBe('Unset');
  display.form.sortByIndex = 3;
  expect(await display.handleSave()).toBe(true);
  expect(user.updateProfileAction).toHaveBeenLastCalledWith({
    settings: {
      displaySettings: { showCalories: true, showNutrition: false, sortBy: 'price_low' },
    },
  });
  preferences.form.portionSize = 'small';
  expect(await preferences.handleSave()).toBe(true);
  expect(user.updateProfileAction).toHaveBeenLastCalledWith({
    preferences: expect.objectContaining({ portionSize: 'small', favoriteIngredients: ['豆腐'] }),
  });
  expect(user.userInfo?.nickname).toBe('小明');
});
