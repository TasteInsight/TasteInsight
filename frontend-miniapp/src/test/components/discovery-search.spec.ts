import { defineComponent, h, nextTick, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { onLoad, onHide, onShow } from '@dcloudio/uni-app';
import SearchBar from '@/components/SearchBar.vue';
import SearchPage from '@/pages/search/index.vue';
import { useSearch } from '@/pages/search/composables/use-search';

jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onHide: jest.fn(),
  onShow: jest.fn(),
  onReachBottom: jest.fn(),
}));
jest.mock('@/pages/search/composables/use-search', () => ({ useSearch: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

const boundWrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  boundWrappers.splice(0).forEach(wrapper => {
    wrapper.element.remove();
    wrapper.unmount();
  });
  jest.useRealTimers();
});

const mountBoundSearch = (initial = '') => {
  const keyword = ref(initial);
  const focused = ref(false);
  const submitted: string[] = [];
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(SearchBar, {
          editable: true,
          focus: focused.value,
          modelValue: keyword.value,
          'onUpdate:modelValue': (value: string) => {
            keyword.value = value;
          },
          onSubmit: () => submitted.push(keyword.value),
          onClear: () => {
            keyword.value = '';
          },
        }),
    }),
    { global: { stubs: { 'uni-icons': true } } }
  );
  document.body.appendChild(wrapper.element);
  boundWrappers.push(wrapper);
  return { wrapper, search: wrapper.findComponent(SearchBar), keyword, focused, submitted };
};

const typeNative = (field: HTMLInputElement, value: string) => {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

const confirmNative = (field: HTMLInputElement) => {
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  );
  field.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
  );
};

test('search entry navigates once to its supplied venue scope without nesting controls', async () => {
  const url = '/pages/search/index?windowId=window-1&scopeName=%E5%AE%B6%E5%B8%B8%E8%8F%9C';
  const wrapper = mount(SearchBar, {
    props: { searchUrl: url, placeholder: '搜索这个窗口的菜品' },
    global: { stubs: { 'uni-icons': true } },
  });
  expect(wrapper.find('button button').exists()).toBe(false);
  expect(wrapper.get('button').attributes('aria-label')).toBe('搜索这个窗口的菜品');
  expect(wrapper.get('button').attributes('role')).toBe('button');
  expect(wrapper.get('button').attributes('tabindex')).toBe('0');
  await wrapper.get('button').trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url }));
  wrapper.unmount();
});

test('editable search emits input, submit and clear without owning the query or navigation', async () => {
  const wrapper = mount(SearchBar, {
    props: { editable: true, modelValue: '米饭', focus: true },
    global: { stubs: { 'uni-icons': true } },
  });
  expect(wrapper.get('input').attributes('type')).toBe('search');
  expect(wrapper.get('input').attributes('aria-label')).toBe('搜索菜品或食堂');
  expect(wrapper.get('input').attributes('placeholder')).toBe('搜索菜品或食堂');
  expect((wrapper.get('input').element as HTMLInputElement).value).toBe('米饭');
  await wrapper.get('input').setValue('面食');
  expect(wrapper.emitted('update:modelValue')).toEqual([['面食']]);
  await wrapper.get('input').trigger('keydown', { key: 'Enter' });
  await wrapper.get('input').trigger('keyup', { key: 'Enter' });
  expect(wrapper.emitted('submit')).toHaveLength(1);
  await wrapper.get('[aria-label="清空搜索"]').trigger('click');
  expect(wrapper.emitted('clear')).toHaveLength(1);
  expect(uni.navigateTo).not.toHaveBeenCalled();
  wrapper.unmount();
});

test.each(['entry', 'clear', 'submit'] as const)(
  '%s action supports Enter and Space exactly once and cancels activation after blur',
  async action => {
    const wrapper = mount(SearchBar, {
      props: { editable: action !== 'entry', modelValue: '米饭' },
      global: { stubs: { 'uni-icons': true } },
    });
    boundWrappers.push(wrapper);
    const button = wrapper.get(action === 'entry' ? 'button' : `.discovery-search__${action}`);
    expect(button.attributes('role')).toBe('button');
    expect(button.attributes('tabindex')).toBe('0');
    const activationCount = () =>
      action === 'entry'
        ? (uni.navigateTo as jest.Mock).mock.calls.length
        : wrapper.emitted(action)?.length || 0;
    for (const key of ['Enter', ' ']) {
      const initialCount = activationCount();
      await button.trigger('keydown', { key });
      await button.trigger('keydown', { key, repeat: true });
      expect(activationCount()).toBe(initialCount);
      await button.trigger('keyup', { key });
      expect(activationCount()).toBe(initialCount + 1);
      await button.trigger('keyup', { key });
      expect(activationCount()).toBe(initialCount + 1);
      await button.trigger('keydown', { key });
      await button.trigger('blur');
      await button.trigger('keyup', { key });
      expect(activationCount()).toBe(initialCount + 1);
    }
  }
);

test('two synchronous native edits followed immediately by Enter submit the final value', () => {
  const { wrapper, keyword, submitted } = mountBoundSearch();
  const field = wrapper.get('input').element as HTMLInputElement;
  typeNative(field, '米');
  typeNative(field, '米饭');
  confirmNative(field);
  expect(keyword.value).toBe('米饭');
  expect(submitted).toEqual(['米饭']);
});

test('the submit action synchronizes the current native field before the parent search runs', async () => {
  const { wrapper, keyword, submitted } = mountBoundSearch('米');
  (wrapper.get('input').element as HTMLInputElement).value = '米饭';
  await wrapper.get('.discovery-search__submit').trigger('click');
  expect(keyword.value).toBe('米饭');
  expect(submitted).toEqual(['米饭']);
});

test('clear keeps the native field and model empty after rapidly delivered edits', async () => {
  jest.useFakeTimers();
  const { wrapper, keyword, submitted } = mountBoundSearch();
  const field = wrapper.get('input').element as HTMLInputElement;
  typeNative(field, '米');
  typeNative(field, '米饭');
  await nextTick();
  await wrapper.get('.discovery-search__clear').trigger('click');
  jest.advanceTimersByTime(200);
  await nextTick();
  expect(keyword.value).toBe('');
  expect(field.value).toBe('');
  expect(submitted).toEqual([]);
});

test('IME confirmation commits text without submitting until a separate Enter sequence', async () => {
  const { wrapper, keyword, submitted } = mountBoundSearch();
  const field = wrapper.get('input');
  await field.trigger('compositionstart');
  typeNative(field.element as HTMLInputElement, '米饭');
  await field.trigger('keydown', { key: 'Enter', isComposing: true });
  await field.trigger('compositionend');
  await field.trigger('keyup', { key: 'Enter' });
  expect(keyword.value).toBe('米饭');
  expect(submitted).toEqual([]);
  await field.trigger('keydown', { key: 'Enter' });
  await field.trigger('keydown', { key: 'Enter', repeat: true });
  await field.trigger('keyup', { key: 'Enter' });
  expect(submitted).toEqual(['米饭']);
});

test('the H5 focus prop operates the actual input and releases it when disabled', async () => {
  const { search, focused } = mountBoundSearch();
  focused.value = true;
  await nextTick();
  expect(document.activeElement).toBe(search.get('input').element);
  focused.value = false;
  await nextTick();
  expect(document.activeElement).not.toBe(search.get('input').element);
});

test('UniApp confirm synchronizes its final detail value before emitting submit', async () => {
  const { search, keyword, submitted } = mountBoundSearch('米');
  (search.vm as any).isH5 = false;
  search.vm.$forceUpdate();
  await nextTick();
  const field = search.get('.discovery-search__uni-input');
  field.element.dispatchEvent(new CustomEvent('confirm', { detail: { value: '米饭' } }));
  expect(keyword.value).toBe('米饭');
  expect(submitted).toEqual(['米饭']);
});

test('scoped arrival focuses once and a return to results does not reopen the input', async () => {
  const state = {
    keyword: ref(''),
    searchResults: ref({ canteens: [], windows: [], dishes: [] }),
    hasResults: ref(false),
    loading: ref(false),
    loadingMore: ref(false),
    hasMore: ref(false),
    error: ref(''),
    loadMoreError: ref(''),
    submittedKeyword: ref(''),
    hasSearched: ref(false),
    initialized: ref(false),
    search: jest.fn(),
    loadMore: jest.fn(),
    clearSearch: jest.fn(() => {
      state.keyword.value = '';
    }),
    resetResults: jest.fn(),
    retrySearch: jest.fn(),
    refreshPreferredSort: jest.fn(),
    goToAddDish: jest.fn(),
  };
  (useSearch as jest.Mock).mockReturnValue(state);
  const wrapper = mount(SearchPage, { global: { stubs: { 'uni-icons': true } } });
  (onLoad as jest.Mock).mock.calls[0][0]({
    windowId: 'window-1',
    scopeName: encodeURIComponent('家常菜窗口'),
  });
  await flushPromises();
  expect((useSearch as jest.Mock).mock.calls[0][0].value).toEqual({ windowId: 'window-1' });
  expect(wrapper.text()).toContain('家常菜窗口');
  expect(wrapper.findComponent(SearchBar).props('focus')).toBe(true);

  (onHide as jest.Mock).mock.calls[0][0]();
  await wrapper.vm.$nextTick();
  (onShow as jest.Mock).mock.calls[0][0]();
  await wrapper.vm.$nextTick();
  expect(wrapper.findComponent(SearchBar).props('focus')).toBe(false);
  expect(state.refreshPreferredSort).toHaveBeenCalledTimes(1);

  state.keyword.value = '米饭';
  await wrapper.vm.$nextTick();
  wrapper.findComponent(SearchBar).vm.$emit('clear');
  await flushPromises();
  expect(state.clearSearch).toHaveBeenCalledTimes(1);
  expect(wrapper.findComponent(SearchBar).props('focus')).toBe(true);
  wrapper.unmount();
});
