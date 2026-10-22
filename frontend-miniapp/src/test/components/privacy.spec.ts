import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import PrivacyPage from '@/pages/settings/privacy.vue';

jest.mock('@dcloudio/uni-app', () => ({ onLoad: jest.fn(), onShow: jest.fn(), onHide: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  uni.setNavigationBarTitle = jest.fn();
  uni.setClipboardData = jest.fn();
});

test.each([
  [{ type: 'user' }, '用户协议', '1. 账号与校园身份', '1. 登录与身份认证'],
  [{ type: 'privacy' }, '隐私政策', '1. 登录与身份认证', '1. 账号与校园身份'],
  [{}, '隐私政策', '1. 登录与身份认证', '1. 账号与校园身份'],
  [{ type: 'unknown' }, '隐私政策', '1. 登录与身份认证', '1. 账号与校园身份'],
])('loads the requested document for %j', async (options, title, expected, absent) => {
  const wrapper = mount(PrivacyPage);
  const load = (onLoad as jest.Mock).mock.calls[0][0];
  load(options);
  await nextTick();
  expect(uni.setNavigationBarTitle).toHaveBeenCalledWith({ title });
  expect(wrapper.text()).toContain(expected);
  expect(wrapper.text()).not.toContain(absent);
  expect(wrapper.text()).toContain('最后更新时间：2026年10月20日');
  expect(wrapper.text()).toContain('TasteInsight 食鉴运营团队');
  expect(wrapper.text()).not.toContain('15535257229');
  await wrapper.get('button').trigger('click');
  expect(uni.setClipboardData).toHaveBeenCalledWith(
    expect.objectContaining({ data: '2366769492@qq.com' })
  );
  wrapper.unmount();
});

test('privacy explains sensitive AI context, identity purposes and rights application', () => {
  const wrapper = mount(PrivacyPage);
  const text = wrapper.text();
  expect(text).toContain('微信账号标识（OpenID');
  expect(text).toContain('校园资格认证与账号登录分别管理');
  expect(text).toContain('处理校方返回的账号标识和在校资格信息，并记录认证结果及有效期');
  expect(text).not.toContain('校方返回的账号标识、在校资格结果及认证有效期');
  expect(text).toContain('过敏原可能反映健康情况');
  expect(text).toContain('已保存的饮食偏好、过敏原、收藏、菜品浏览记录和推荐结果');
  expect(text).toContain('举报对象、举报类别、原因、处理状态及结果');
  expect(text).toContain('核验申请人与账号的关联');
  expect(text).toContain('注销账号');
  expect(text).not.toMatch(/使用本小程序，即表示|自动注销|一键导出|所有数据.*境内/);
  wrapper.unmount();
});

test('copying the contact email reports a clipboard failure', async () => {
  (uni.setClipboardData as jest.Mock).mockImplementationOnce(options => options.fail());
  const wrapper = mount(PrivacyPage);
  await wrapper.get('button').trigger('keydown', { key: 'Enter' });
  await wrapper.get('button').trigger('keyup', { key: 'Enter' });
  expect(uni.showToast).toHaveBeenCalledWith({ title: '复制失败，请重试', icon: 'none' });
  wrapper.unmount();
});

test.each([
  ['privacy', 'Enter'],
  ['privacy', ' '],
  ['user', 'Enter'],
  ['user', ' '],
])('copies the email once with %s document and %j key', async (type, key) => {
  const wrapper = mount(PrivacyPage);
  (onLoad as jest.Mock).mock.calls[0][0]({ type });
  await nextTick();
  const button = wrapper.get('button');
  expect(button.attributes('role')).toBe('button');
  expect(button.attributes('tabindex')).toBe('0');
  await button.trigger('keydown', { key });
  expect(uni.setClipboardData).not.toHaveBeenCalled();
  await button.trigger('keyup', { key });
  expect(uni.setClipboardData).toHaveBeenCalledTimes(1);
  expect(uni.setClipboardData).toHaveBeenCalledWith(
    expect.objectContaining({ data: '2366769492@qq.com' })
  );
  await button.trigger('keyup', { key });
  expect(uni.setClipboardData).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});

test('blurring the contact button cancels its pending keyboard activation', async () => {
  const wrapper = mount(PrivacyPage);
  const button = wrapper.get('button');
  await button.trigger('keydown', { key: ' ' });
  await button.trigger('blur');
  await button.trigger('keyup', { key: ' ' });
  expect(uni.setClipboardData).not.toHaveBeenCalled();
  wrapper.unmount();
});
