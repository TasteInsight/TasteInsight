export {};

describe('feedback defaults', () => {
  let interceptors: Record<string, UniNamespace.InterceptorOptions>;
  let addInterceptor: jest.Mock;
  let registerFeedbackDefaults: () => void;
  let originalAddInterceptor: typeof uni.addInterceptor;

  beforeEach(() => {
    jest.resetModules();
    interceptors = {};
    originalAddInterceptor = uni.addInterceptor;
    addInterceptor = jest.fn((name, options) => {
      interceptors[name] = options;
    });
    uni.addInterceptor = addInterceptor;
    ({ registerFeedbackDefaults } = require('@/utils/feedback'));
  });

  afterEach(() => {
    uni.addInterceptor = originalAddInterceptor;
  });

  it('registers once and applies branded defaults only to feedback options', () => {
    registerFeedbackDefaults();
    registerFeedbackDefaults();

    expect(addInterceptor.mock.calls.map(([name]) => name)).toEqual([
      'showModal',
      'showActionSheet',
    ]);

    const modal: UniNamespace.ShowModalOptions = { title: '退出登录', content: '确定退出？' };
    interceptors.showModal.invoke!(modal);
    expect(modal).toEqual({
      title: '退出登录',
      content: '确定退出？',
      confirmColor: '#660874',
      cancelColor: '#667085',
    });

    const sheet: UniNamespace.ShowActionSheetOptions = { itemList: ['编辑', '删除'] };
    interceptors.showActionSheet.invoke!(sheet);
    expect(sheet.itemColor).toBe('#1f2937');
    expect(Object.keys(interceptors.showModal)).toEqual(['invoke']);
    expect(Object.keys(interceptors.showActionSheet)).toEqual(['invoke']);
  });

  it('preserves explicit colors, edit options, labels and callbacks without invoking them', () => {
    registerFeedbackDefaults();
    const options: UniNamespace.ShowModalOptions = {
      title: '删除动态？',
      content: '删除后无法恢复。',
      showCancel: false,
      confirmText: '删除',
      cancelText: '继续编辑',
      confirmColor: '#b42318',
      cancelColor: '#475467',
      editable: true,
      placeholderText: '输入名称',
      success: jest.fn(),
      fail: jest.fn(),
      complete: jest.fn(),
    };
    const original = { ...options };

    interceptors.showModal.invoke!(options);

    expect(options).toEqual(original);
    expect(options.success).not.toHaveBeenCalled();
    expect(options.fail).not.toHaveBeenCalled();
    expect(options.complete).not.toHaveBeenCalled();
  });

  it('preserves action-sheet choices, destructive colors, popover and callbacks', () => {
    registerFeedbackDefaults();
    const options: UniNamespace.ShowActionSheetOptions = {
      itemList: ['删除回复'],
      itemColor: '#b42318',
      popover: { top: 10, left: 20, width: 100, height: 44 },
      success: jest.fn(),
      fail: jest.fn(),
      complete: jest.fn(),
    };
    const original = { ...options };

    interceptors.showActionSheet.invoke!(options);

    expect(options).toEqual(original);
    expect(options.success).not.toHaveBeenCalled();
    expect(options.fail).not.toHaveBeenCalled();
    expect(options.complete).not.toHaveBeenCalled();
  });
});
