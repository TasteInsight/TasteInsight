/** @jest-environment node */
import { nextTick } from 'vue';
import { useSheetKeyboard, useSheetInputScroll } from '@/pages/dish/composables/use-sheet-keyboard';

const mockMount: Array<() => void> = [];
const mockUnmount: Array<() => void> = [];
jest.mock('vue', () => ({
  ...jest.requireActual('vue'),
  onMounted: (callback: () => void) => mockMount.push(callback),
  onUnmounted: (callback: () => void) => mockUnmount.push(callback),
}));

let keyboardChange: (event: { height: number }) => void;
let windowHeight = 800;
beforeEach(() => {
  mockMount.length = 0;
  mockUnmount.length = 0;
  windowHeight = 800;
  (global as any).uni = {
    getSystemInfoSync: () => ({ windowHeight }),
    onKeyboardHeightChange: jest.fn(callback => {
      keyboardChange = callback;
    }),
    offKeyboardHeightChange: jest.fn(),
  };
});
afterEach(() => mockUnmount.forEach(callback => callback()));

it('reissues the focused field target after every native keyboard viewport change', async () => {
  const scroll = useSheetInputScroll();
  const style = useSheetKeyboard(scroll.revealFocusedField);
  mockMount.forEach(callback => callback());
  await scroll.focusField('review-content-field');
  expect(scroll.scrollIntoView.value).toBe('review-content-field');
  keyboardChange({ height: 300 });
  expect(scroll.scrollIntoView.value).toBe('');
  expect(style.value.bottom).toContain('300px');
  await nextTick();
  expect(scroll.scrollIntoView.value).toBe('review-content-field');
  keyboardChange({ height: 250 });
  expect(scroll.scrollIntoView.value).toBe('');
  await nextTick();
  expect(scroll.scrollIntoView.value).toBe('review-content-field');
});

it('still repositions when native layout resize already consumed the keyboard inset', async () => {
  const scroll = useSheetInputScroll();
  const style = useSheetKeyboard(scroll.revealFocusedField);
  mockMount.forEach(callback => callback());
  await scroll.focusField('report-reason-field');
  windowHeight = 500;
  keyboardChange({ height: 300 });
  expect(style.value.bottom).toContain('0px');
  expect(scroll.scrollIntoView.value).toBe('');
  await nextTick();
  expect(scroll.scrollIntoView.value).toBe('report-reason-field');
});

it.each(['blur', 'unmount'])(
  'cancels a pending reveal on %s without modifying the next focus',
  async phase => {
    const scroll = useSheetInputScroll();
    const pending = scroll.focusField('old-field');
    if (phase === 'blur') scroll.blurField();
    else mockUnmount.forEach(callback => callback());
    await pending;
    expect(scroll.scrollIntoView.value).toBe('');
    if (phase === 'blur') {
      await scroll.focusField('current-field');
      expect(scroll.scrollIntoView.value).toBe('current-field');
    }
  }
);

it('keeps keyboard-only consumers free of internal scrolling behavior', () => {
  const style = useSheetKeyboard();
  mockMount.forEach(callback => callback());
  keyboardChange({ height: 220 });
  expect(style.value.bottom).toContain('220px');
});
