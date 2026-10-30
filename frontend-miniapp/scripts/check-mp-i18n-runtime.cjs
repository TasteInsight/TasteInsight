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
let nativeApp;
global.App = options => {
  nativeApp = options;
  return options;
};
global.getApp = () => nativeApp;
global.getCurrentPages = () => [];

try {
  const entry = require(path.join(projectPath, 'app.js'));
  const globalProperties = nativeApp.$vm.$.appContext.config.globalProperties;
  const translate = globalProperties.$t;
  assert.equal(translate('account.settings.language'), '语言');
  assert.equal(translate('common.selectedCount', { count: 3 }), '已选择 3 项');
  globalProperties.$i18n.locale = 'en';
  assert.equal(translate('account.settings.language'), 'Language');
  assert.equal(translate('nav.settings'), 'Settings');
  assert.equal(translate('common.selectedCount', { count: 3 }), '3 selected');
  assert.equal(translate('common.dish.reviews', { count: 1 }), '1 review');
  assert.equal(translate('common.dish.reviews', { count: 3 }), '3 reviews');
  storage.set('tasteinsight.language', 'en');
  entry.createApp();
  assert.equal(translate('account.settings.language'), 'Language');
  storage.set('tasteinsight.language', 'zh-Hans');
  entry.createApp();
  assert.equal(translate('account.settings.language'), '语言');
  storage.set('tasteinsight.language', 'system');
  entry.createApp();
  assert.equal(translate('account.settings.language'), '语言');
  console.log('PASS built miniapp i18n initialization, formatting and language switching');
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
}
