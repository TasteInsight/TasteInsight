const assert = require('node:assert/strict');
const path = require('node:path');

const projectPath = path.resolve(
  process.argv[2] || process.env.UNI_OUTPUT_DIR || 'dist/build/mp-weixin'
);
const storage = new Map();

// 使用基础微信接口替身执行构建产物，覆盖依赖解析和 i18n 启动流程。
global.wx = {
  getSystemInfoSync: () => ({
    platform: 'devtools',
    language: 'zh_CN',
    SDKVersion: '3.17.4',
    windowWidth: 375,
    windowHeight: 720,
  }),
  getAppBaseInfo: () => ({ language: 'zh_CN' }),
  getDeviceInfo: () => ({ platform: 'devtools' }),
  canIUse: () => false,
  getStorageSync: key => storage.get(key) ?? '',
  setStorageSync: (key, value) => {
    storage.set(key, value);
  },
  setStorage: ({ key, data, success }) => {
    storage.set(key, data);
    success?.({ errMsg: 'setStorage:ok' });
  },
};
global.Page = options => options;
global.Component = options => options;
global.App = options => options;
const nativeApp = { $vm: { $locale: 'zh-Hans' } };
global.getApp = () => nativeApp;
global.getCurrentPages = () => [];

try {
  const app = require(path.join(projectPath, 'i18n/index.js'));
  app.initializeI18n();
  assert.equal(app.t('account.settings.language'), '语言');
  assert.equal(app.t('common.selectedCount', { count: 3 }), '已选择 3 项');
  app.setLanguagePreference('en');
  assert.equal(app.t('account.settings.language'), 'Language');
  assert.equal(app.t('nav.settings'), 'Settings');
  assert.equal(app.t('common.selectedCount', { count: 3 }), '3 selected');
  assert.equal(app.t('common.dish.reviews', { count: 1 }), '1 review');
  assert.equal(app.t('common.dish.reviews', { count: 3 }), '3 reviews');
  app.initializeI18n();
  assert.equal(app.t('account.settings.language'), 'Language');
  app.setLanguagePreference('zh-Hans');
  assert.equal(app.t('account.settings.language'), '语言');
  app.setLanguagePreference('system');
  assert.equal(app.t('account.settings.language'), '语言');
  console.log('PASS built miniapp i18n initialization, formatting and language switching');
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
}
