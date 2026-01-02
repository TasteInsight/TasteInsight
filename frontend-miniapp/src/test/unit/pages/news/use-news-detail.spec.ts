import { jest } from '@jest/globals';

describe('pages/news/composables/use-news-detail.ts', () => {
  const MODULE_PATH = '@/pages/news/composables/use-news-detail';

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (global as any).uni;
  });

  test('formattedContent transforms img/table/pre tags and empty content', () => {
    const { formattedContent, newsDetail } = require(MODULE_PATH).useNewsDetail();
    expect(formattedContent.value).toBe('');

    newsDetail.value.content = '<html><body><img src="x.png"><table></table><pre>code</pre></body></html>';
    const out = formattedContent.value;
    expect(out).toContain('max-width:100%');
    expect(out).toContain('white-space:pre-wrap');
  });

  test('formatTime returns formatted date or empty', () => {
    const { formatTime } = require(MODULE_PATH).useNewsDetail();
    expect(formatTime('')).toBe('');
    const formatted = formatTime('2020-01-01T01:02:03Z');
    expect(formatted).toMatch(/2020-01-01/);
  });

  test('fetchNewsDetail handles success, non-200 and exception', async () => {
    const getNewsById = jest.fn() as unknown as jest.Mock<any, any>;
    getNewsById.mockResolvedValue({ code: 200, data: { id: 'n1', content: 'x' } });
    jest.doMock('@/api/modules/news', () => ({ getNewsById }));

    (global as any).uni = { showToast: jest.fn() };

    const { useNewsDetail } = require(MODULE_PATH);
    const inst = useNewsDetail();

    await inst.fetchNewsDetail('n1');
    expect(inst.newsDetail.value.id).toBe('n1');

    getNewsById.mockResolvedValueOnce({ code: 500, message: 'err' });
    await inst.fetchNewsDetail('n2');
    expect((global as any).uni.showToast).toHaveBeenCalled();

    getNewsById.mockRejectedValueOnce(new Error('net'));
    await inst.fetchNewsDetail('n3');
    expect((global as any).uni.showToast).toHaveBeenCalled();
  });

  test('initDetailPage calls fetchNewsDetail when id present and shows param error otherwise', () => {
    const getNewsById = jest.fn();
    jest.doMock('@/api/modules/news', () => ({ getNewsById }));

    // mock onLoad to invoke callback immediately
    const onLoad = jest.fn((cb: any) => cb({ id: 'n1' }));
    jest.doMock('@dcloudio/uni-app', () => ({ onLoad }));

    (global as any).uni = { showToast: jest.fn() };

    const { useNewsDetail } = require(MODULE_PATH);
    const inst = useNewsDetail();
    inst.initDetailPage();

    // now call onLoad with no id
    (onLoad as any).mockImplementation((cb: any) => cb({}));
    inst.initDetailPage();

    expect((global as any).uni.showToast).toHaveBeenCalled();
  });
});