import { mount } from '@vue/test-utils';
import { onHide, onShow, onUnload } from '@dcloudio/uni-app';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import AboutPage from '@/pages/settings/about.vue';

jest.mock('@dcloudio/uni-app', () => ({
  onHide: jest.fn(),
  onShow: jest.fn(),
  onUnload: jest.fn(),
}));

const wrappers: ReturnType<typeof mount>[] = [];

function setup() {
  const wrapper = mount(AboutPage);
  wrappers.push(wrapper);
  return wrapper;
}

async function tapLogo(wrapper: ReturnType<typeof mount>, count = 5, gap = 0) {
  for (let index = 0; index < count; index += 1) {
    if (index > 0) jest.advanceTimersByTime(gap);
    await wrapper.get('.about-logo-button').trigger('tap');
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-09T12:00:00Z'));
  Object.assign(uni, {
    navigateTo: jest.fn(),
    showToast: jest.fn(),
    vibrateShort: jest.fn(),
    setClipboardData: jest.fn(),
  });
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  jest.useRealTimers();
});

it('keeps the configured version and opens both agreement documents', async () => {
  const wrapper = setup();
  const manifest = readFileSync(resolve(__dirname, '../../manifest.json'), 'utf8');
  const version = manifest.match(/"versionName"\s*:\s*"([^"]+)"/)![1];
  expect(wrapper.text()).toContain(`Version ${version}`);
  expect(wrapper.text()).not.toContain('彩蛋');
  const agreement = wrapper.findAll('button').find(button => button.text() === '用户协议')!;
  await agreement.trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/settings/privacy?type=user' });

  const privacy = wrapper.findAll('button').find(button => button.text() === '隐私政策')!;
  await privacy.trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/settings/privacy' });
});

it('describes the cross-platform app and keeps implemented features available in a compact disclosure', async () => {
  const wrapper = setup();
  expect(wrapper.get('.about-description').text()).toContain('菜品点评与推荐应用');
  const features = wrapper.findAll('button').find(button => button.text() === '主要功能')!;
  expect(features.attributes('aria-expanded')).toBe('false');
  expect(wrapper.find('.about-features').exists()).toBe(false);
  await features.trigger('click');
  expect(features.attributes('aria-expanded')).toBe('true');
  expect(wrapper.get('.about-features').text()).toContain('按日、周、月查看饮食规划');
  expect(wrapper.findAll('.about-feature')).toHaveLength(5);
  await features.trigger('click');
  expect(wrapper.find('.about-features').exists()).toBe(false);
  expect(wrapper.text()).not.toMatch(
    /小程序|feedback@tasteinsight\.com|tasteinsight_official|微信公众号|TasteInsight Team|由热爱技术的开发者创建|Copyright|2024/
  );
  expect(wrapper.text()).toContain('免责声明');
  expect(wrapper.text()).toContain('请向窗口核对食材');
});

it('copies the repository issue tracker from the project feedback action', async () => {
  const wrapper = setup();
  const feedback = wrapper.get('.about-contact');
  expect(feedback.text()).toContain('项目反馈');
  expect(feedback.text()).toContain('GitHub Issues');
  expect(feedback.text()).toContain('复制链接');
  await feedback.trigger('click');
  expect(uni.setClipboardData).toHaveBeenCalledWith(
    expect.objectContaining({ data: 'https://github.com/TasteInsight/TasteInsight/issues' })
  );
  expect(uni.navigateTo).not.toHaveBeenCalled();

  (uni.setClipboardData as jest.Mock).mock.calls[0][0].fail();
  expect(uni.showToast).toHaveBeenCalledWith({ title: '复制失败，请重试', icon: 'none' });
});

it('opens the hidden page only on the fifth consecutive tap and confirms successful navigation', async () => {
  const wrapper = setup();
  await tapLogo(wrapper, 4);
  expect(uni.navigateTo).not.toHaveBeenCalled();
  await tapLogo(wrapper, 1);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  expect((uni.navigateTo as jest.Mock).mock.calls[0][0].url).toBe('/pages/easter-egg/index');
  expect(uni.showToast).not.toHaveBeenCalled();

  (uni.navigateTo as jest.Mock).mock.calls[0][0].success();
  expect(uni.showToast).toHaveBeenCalledWith({
    title: '彩蛋入口已解锁',
    icon: 'none',
    duration: 1200,
  });
  expect(uni.vibrateShort).toHaveBeenCalledTimes(1);
  expect(() => (uni.vibrateShort as jest.Mock).mock.calls[0][0].fail()).not.toThrow();
});

it('keeps the 800 ms adjacent-tap window and resets after a longer gap', async () => {
  const wrapper = setup();
  await tapLogo(wrapper, 4, 800);
  jest.advanceTimersByTime(801);
  await tapLogo(wrapper, 1);
  expect(uni.navigateTo).not.toHaveBeenCalled();
  await tapLogo(wrapper, 4, 800);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
});

it('does not queue another navigation while the hidden page is opening', async () => {
  const wrapper = setup();
  await tapLogo(wrapper, 15);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  (uni.navigateTo as jest.Mock).mock.calls[0][0].success();
  await tapLogo(wrapper);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);

  (onHide as jest.Mock).mock.calls[0][0]();
  (onShow as jest.Mock).mock.calls[0][0]();
  await tapLogo(wrapper);
  expect(uni.navigateTo).toHaveBeenCalledTimes(2);
});

it('allows another full sequence after failed navigation without announcing an unlock', async () => {
  const wrapper = setup();
  await tapLogo(wrapper);
  (uni.navigateTo as jest.Mock).mock.calls[0][0].fail();
  expect(uni.showToast).toHaveBeenCalledWith({ title: '页面跳转失败，请重试', icon: 'none' });
  expect(uni.vibrateShort).not.toHaveBeenCalled();
  await tapLogo(wrapper, 4);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  await tapLogo(wrapper, 1);
  expect(uni.navigateTo).toHaveBeenCalledTimes(2);
});

it.each([onHide, onUnload])(
  'clears a partial secret sequence when the page leaves',
  async leave => {
    const wrapper = setup();
    await tapLogo(wrapper, 4);
    (leave as jest.Mock).mock.calls[0][0]();
    (onShow as jest.Mock).mock.calls[0][0]();
    await tapLogo(wrapper, 1);
    expect(uni.navigateTo).not.toHaveBeenCalled();
    await tapLogo(wrapper, 4);
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  }
);

it.each(['Enter', ' '])('allows the same hidden sequence from the %p key', async key => {
  const wrapper = setup();
  const logo = wrapper.get('.about-logo-button');
  expect(logo.attributes('role')).toBe('button');
  expect(logo.attributes('tabindex')).toBe('0');
  for (let count = 0; count < 5; count += 1) {
    await logo.trigger('keydown', { key });
    await logo.trigger('keyup', { key });
  }
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
});

it('clears an unfinished keyboard activation when the page hides', async () => {
  const wrapper = setup();
  const logo = wrapper.get('.about-logo-button');
  await tapLogo(wrapper, 4);
  await logo.trigger('keydown', { key: 'Enter' });
  (onHide as jest.Mock).mock.calls[0][0]();
  (onShow as jest.Mock).mock.calls[0][0]();
  await logo.trigger('keyup', { key: 'Enter' });
  await tapLogo(wrapper, 4);
  expect(uni.navigateTo).not.toHaveBeenCalled();
  await tapLogo(wrapper, 1);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
});

it('keeps project feedback and open-source license details operable by keyboard', async () => {
  const wrapper = setup();
  const contact = wrapper.get('.about-contact');
  await contact.trigger('keydown', { key: 'Enter' });
  await contact.trigger('keyup', { key: 'Enter' });
  expect(uni.setClipboardData).toHaveBeenCalledWith(
    expect.objectContaining({ data: 'https://github.com/TasteInsight/TasteInsight/issues' })
  );

  const features = wrapper.findAll('button').find(button => button.text() === '主要功能')!;
  await features.trigger('keydown', { key: 'Enter' });
  await features.trigger('keyup', { key: 'Enter' });
  expect(features.attributes('aria-expanded')).toBe('true');
  expect(wrapper.findAll('.about-feature')).toHaveLength(5);

  const technical = wrapper.findAll('button').find(button => button.text().includes('技术与开源'))!;
  await technical.trigger('keydown', { key: ' ' });
  await technical.trigger('keyup', { key: ' ' });
  expect(technical.attributes('aria-expanded')).toBe('true');
  const details = wrapper.get('.about-technical').text();
  expect(details).toContain('Vue 3');
  expect(details).toContain('uni-app');
  expect(details).toContain('Tailwind CSS');
  expect(details).toContain('Pinia');
  expect(details).toContain('MIT License');
  expect(details).toContain('Apache-2.0');
  await technical.trigger('click');
  expect(technical.attributes('aria-expanded')).toBe('false');
});
