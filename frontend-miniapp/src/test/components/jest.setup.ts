import { config } from '@vue/test-utils';

const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const first = args[0];
  if (
    typeof first === 'string' &&
    first.includes('Do not use built-in or reserved HTML elements as component id')
  ) {
    return;
  }
  originalWarn(...args);
};

const ViewStub = {
  name: 'view',
  inheritAttrs: false,
  template: '<div v-bind="$attrs"><slot /></div>',
};

const TextStub = {
  name: 'text',
  inheritAttrs: false,
  template: '<span v-bind="$attrs"><slot /></span>',
};

const ImageStub = {
  name: 'image',
  inheritAttrs: false,
  template: '<img v-bind="$attrs" />',
};

config.global.stubs = {
  ...(config.global.stubs || {}),
  view: ViewStub,
  text: TextStub,
  image: ImageStub,
};

// Minimal uni global so components that call uni.* won't crash.
(globalThis as any).uni = (globalThis as any).uni || {
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  showToast: jest.fn(),
  navigateTo: jest.fn(),
  switchTab: jest.fn(),
};
