import { vi } from 'vitest';

// Minimal uni-app global mock for component tests.
(globalThis as any).uni = {
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
};
