import { defineComponent, nextTick, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { useAllergens } from '@/pages/settings/composables/use-allergens';
import { useUserStore } from '@/store/modules/use-user-store';
import request from '@/utils/request';
import { locale } from '@/i18n';
jest.mock('@dcloudio/uni-app', () => ({ onShow: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/utils/request', () => ({ __esModule: true, default: jest.fn() }));

it('keeps a late catalogue read clean and restores an account-owned multiword draft', async () => {
  const storage = new Map<string, string>();
  Object.assign(uni, {
    getStorageSync: jest.fn(key => storage.get(key)),
    setStorageSync: jest.fn((key, value) => storage.set(key, value)),
    removeStorageSync: jest.fn(key => storage.delete(key)),
  });
  const store = reactive({
    sessionVersion: 0,
    isLoggedIn: true,
    userInfo: { id: 'allergen-editor-user', allergens: ['Peanut'] },
    fetchProfileAction: jest.fn().mockResolvedValue(undefined),
  });
  (useUserStore as unknown as jest.Mock).mockReturnValue(store);
  let resolveCatalog!: (response: any) => void;
  (request as jest.Mock)
    .mockReturnValueOnce(
      new Promise(resolve => {
        resolveCatalog = resolve;
      })
    )
    .mockResolvedValue({ data: [] });
  const Host = defineComponent({ setup: () => useAllergens(), template: '<div />' });
  const first = mount(Host);
  await flushPromises();
  expect(first.vm.dirty).toBe(false);
  resolveCatalog({
    data: [{ value: '花生', nameZh: '花生', nameEn: 'Peanuts', aliases: ['Peanut', 'Peanuts'] }],
  });
  await flushPromises();
  expect(first.vm.dirty).toBe(false);
  locale.value = 'en';
  await nextTick();
  expect(first.vm.displayAllergens).toBe('Peanuts');
  first.vm.editAllergens();
  first.vm.inputAllergens({ detail: { value: 'Peanuts, Pine nuts' } });
  first.vm.finishAllergens();
  expect(first.vm.dirty).toBe(true);
  first.unmount();
  const second = mount(Host);
  await flushPromises();
  expect(second.vm.restoredDraft).toBe(true);
  expect(second.vm.form.allergens).toBe('Peanuts, Pine nuts');
  expect(second.vm.dirty).toBe(true);
  second.vm.editAllergens();
  store.sessionVersion++;
  store.userInfo = { id: 'another-editor-user', allergens: ['Milk'] };
  await flushPromises();
  expect(second.vm.displayAllergens).toBe('');
  await second.vm.loadProfile();
  expect(second.vm.displayAllergens).toBe('Milk');
  expect(second.vm.dirty).toBe(false);
  second.unmount();
  locale.value = 'zh-Hans';
});
