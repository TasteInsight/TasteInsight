import { mount } from '@vue/test-utils';
import { onHide, onUnload } from '@dcloudio/uni-app';
import EasterEgg from '@/pages/easter-egg/index.vue';
import { readFileSync } from 'fs';
import { resolve } from 'path';

jest.mock('@dcloudio/uni-app', () => ({ onHide: jest.fn(), onUnload: jest.fn() }));
const wrappers: ReturnType<typeof mount>[] = [];
const stored = new Map<string, any>();
function setup() {
  const wrapper = mount(EasterEgg);
  wrappers.push(wrapper);
  return { wrapper, vm: wrapper.vm as any };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  stored.clear();
  Object.assign(uni, {
    getStorageSync: jest.fn(key => stored.get(key)),
    setStorageSync: jest.fn((key, value) => stored.set(key, JSON.parse(JSON.stringify(value)))),
    showToast: jest.fn(),
    showModal: jest.fn(),
    vibrateShort: jest.fn(),
    setClipboardData: jest.fn(options => options.success?.()),
  });
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.clearAllTimers();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('cancels a hidden challenge, retains earned records, and allows a fresh start', () => {
  const { vm } = setup();
  vm.startChallenge();
  vm.nextDish();
  jest.advanceTimersByTime(2000);
  const earned = JSON.parse(JSON.stringify(vm.stats));
  (onHide as jest.Mock).mock.calls[0][0]();
  expect(vm.challenge.active).toBe(false);
  expect(vm.challenge.remaining).toBe(10);
  expect(vm.challenge.count).toBe(0);
  expect(vm.stats).toEqual(earned);
  expect(jest.getTimerCount()).toBe(0);
  vm.startChallenge();
  expect(vm.challenge.active).toBe(true);
  expect(vm.challenge.remaining).toBe(10);
  expect(jest.getTimerCount()).toBe(1);
});

it('an old interval callback cannot alter or reward a new challenge', () => {
  const interval = jest.spyOn(global, 'setInterval');
  const { vm } = setup();
  vm.startChallenge();
  const oldTick = interval.mock.calls[0][0] as () => void;
  (onHide as jest.Mock).mock.calls[0][0]();
  vm.startChallenge();
  const coins = vm.stats.coins;
  oldTick();
  expect(vm.challenge.remaining).toBe(10);
  expect(vm.challenge.active).toBe(true);
  expect(vm.stats.coins).toBe(coins);
  jest.advanceTimersByTime(1000);
  expect(vm.challenge.remaining).toBe(9);
});

it('completes the existing target and reward exactly once', () => {
  const interval = jest.spyOn(global, 'setInterval');
  const { vm } = setup();
  vm.startChallenge();
  vm.nextDish();
  vm.nextDish();
  vm.nextDish();
  const coins = vm.stats.coins;
  jest.advanceTimersByTime(10000);
  expect(vm.challenge.active).toBe(false);
  expect(vm.stats.coins).toBe(coins + 5);
  expect(vm.stats.bestChallengeCount).toBe(3);
  (interval.mock.calls[0][0] as () => void)();
  expect(vm.stats.coins).toBe(coins + 5);
  expect(jest.getTimerCount()).toBe(0);
});

it('unload ends an active round without awarding completion', () => {
  const { vm } = setup();
  vm.startChallenge();
  const coins = vm.stats.coins;
  (onUnload as jest.Mock).mock.calls[0][0]();
  jest.advanceTimersByTime(15000);
  expect(vm.challenge.active).toBe(false);
  expect(vm.challenge.remaining).toBe(10);
  expect(vm.stats.coins).toBe(coins);
});

it('keeps the challenge start beside its real generate action', async () => {
  const { wrapper } = setup();
  const generator = wrapper.get('.egg-generator');
  const actions = generator.get('.egg-play-actions');
  await actions.get('[data-action="challenge"]').trigger('tap');
  await actions.get('[data-action="generate"]').trigger('tap');
  expect(generator.text()).toContain('1 / 3');
  expect(wrapper.get('[data-action="challenge"]').attributes('disabled')).toBeDefined();
});

it('preserves theme, snow, missions, titles, flavor and clipboard controls', async () => {
  const { wrapper, vm } = setup();
  vm.toggleDarkMode({ detail: { value: true } });
  vm.toggleSnow({ detail: { value: true } });
  vm.toggleMission('m1');
  vm.onHeatChange({ detail: { value: 8 } });
  vm.stats.coins = 20;
  vm.drawTitle();
  vm.equipRandomTitle();
  vm.copyDish();
  vm.copyFortune();
  vm.shareText();
  await wrapper.vm.$nextTick();
  expect(wrapper.classes()).toContain('egg-dark');
  expect(vm.flakes.length).toBe(14);
  expect(vm.stats.missions.m1).toBe(true);
  expect(vm.stats.heat).toBe(8);
  expect(vm.stats.titles.length).toBe(1);
  expect(vm.stats.equippedTitle).toBeTruthy();
  expect(uni.setClipboardData).toHaveBeenCalledTimes(3);
  expect(stored.get('TI_EASTER_EGG_STATE').isDarkMode).toBe(true);
});

it('does not count repeated start taps as a new play or create another interval', () => {
  const { vm } = setup();
  vm.startChallenge();
  const plays = vm.stats.plays;
  vm.startChallenge();
  expect(vm.stats.plays).toBe(plays);
  expect(jest.getTimerCount()).toBe(1);
});

it('reset cancels the old round and synchronizes theme and mutation state', () => {
  const { vm } = setup();
  vm.toggleDarkMode({ detail: { value: true } });
  vm.toggleSnow({ detail: { value: true } });
  vm.nextDish();
  vm.nextDish();
  vm.startChallenge();
  (uni.showModal as jest.Mock).mockImplementation(options => options.success({ confirm: true }));
  vm.resetAll();
  expect(vm.isDarkMode).toBe(false);
  expect(vm.isSnowing).toBe(false);
  expect(vm.challenge.active).toBe(false);
  expect(vm.challenge.remaining).toBe(10);
  expect(jest.getTimerCount()).toBe(0);
  vm.nextDish();
  expect(vm.stats.mutations).toBe(0);
  expect(stored.get('TI_EASTER_EGG_STATE').isDarkMode).toBe(false);
});

it('keeps light and dark body, secondary and action text above 4.5:1 contrast', () => {
  const source = readFileSync(resolve(__dirname, '../../pages/easter-egg/index.vue'), 'utf8');
  const luminance = (hex: string) => {
    const full =
      hex.length === 4
        ? '#' +
          hex
            .slice(1)
            .split('')
            .map(char => char + char)
            .join('')
        : hex;
    const values = [1, 3, 5].map(start => {
      const channel = parseInt(full.slice(start, start + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  const contrast = (one: string, two: string) => {
    const values = [luminance(one), luminance(two)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  for (const selector of ['egg-page', 'egg-dark']) {
    const rule = source.match(new RegExp('\\.' + selector + '\\s*\\{([^}]+)\\}'))![1];
    const color = (name: string) =>
      rule.match(new RegExp('--egg-' + name + ':\\s*(#[0-9a-f]+)'))![1];
    for (const text of ['text', 'muted', 'accent']) {
      for (const surface of ['bg', 'surface'])
        expect(contrast(color(text), color(surface))).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contrast('#fff', '#660874')).toBeGreaterThanOrEqual(4.5);
  expect(source).not.toMatch(/text-gray-600|text-gray-800|bg-gradient/);
});
