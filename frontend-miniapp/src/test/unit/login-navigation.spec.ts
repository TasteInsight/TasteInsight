import { openLogin, returnFromLogin } from '@/utils/login-navigation';

let pages: any[];
beforeEach(() => {
  pages = [{ route: 'pages/profile/index' }];
  (global as any).getCurrentPages = () => pages;
  uni.navigateTo = jest.fn(options => options.complete?.({ errMsg: 'navigateTo:ok' }));
  uni.navigateBack = jest.fn();
  uni.switchTab = jest.fn();
});
afterEach(() => {
  delete (global as any).getCurrentPages;
});

test('opens login once and keeps the source page in the native stack', () => {
  openLogin();
  expect(uni.navigateTo).toHaveBeenCalledWith(
    expect.objectContaining({ url: '/pages/login/index' })
  );
  pages.push({ route: 'pages/login/index' });
  openLogin();
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
});
test('coalesces taps while navigation is pending', () => {
  (uni.navigateTo as jest.Mock).mockImplementation(() => {});
  openLogin();
  openLogin();
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  (uni.navigateTo as jest.Mock).mock.calls[0][0].complete({ errMsg: 'navigateTo:ok' });
});
test.each(['cancel', 'success'])('%s returns to the source instead of replacing it', () => {
  pages.push({ route: 'pages/login/index' });
  returnFromLogin();
  expect(uni.navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 1 }));
  expect(uni.switchTab).not.toHaveBeenCalled();
});
test('a direct login entry has a public home fallback', () => {
  pages = [{ route: 'pages/login/index' }];
  returnFromLogin();
  expect(uni.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
});
test('a completed request does not close an agreement page', () => {
  pages.push({ route: 'pages/login/index' }, { route: 'pages/settings/privacy' });
  returnFromLogin();
  expect(uni.navigateBack).not.toHaveBeenCalled();
  expect(uni.switchTab).not.toHaveBeenCalled();
});
