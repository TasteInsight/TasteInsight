import { useNewsList } from '@/pages/news/composables/use-news-list';
import { getNewsList } from '@/api/modules/news';
import { ref } from 'vue';

// Mock API
jest.mock('@/api/modules/news');

// Mock Vue onMounted
jest.mock('vue', () => {
  const originalVue = jest.requireActual('vue');
  return {
    ...originalVue,
    onMounted: jest.fn((fn) => fn()),
  };
});

describe('useNewsList', () => {
  const mockNewsItems = [
    { id: 1, title: 'News 1', content: 'Content 1', createTime: '2023-01-01' },
    { id: 2, title: 'News 2', content: 'Content 2', createTime: '2023-01-02' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch news list on mount', async () => {
    (getNewsList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: mockNewsItems,
        meta: { page: 1, pageSize: 10, total: 20, totalPages: 2 },
      },
    });

    const { list, loading, finished } = useNewsList();

    expect(loading.value).toBe(true);
    
    // Wait for the promise to resolve
    await new Promise(process.nextTick);

    expect(getNewsList).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(list.value).toEqual(mockNewsItems);
    expect(loading.value).toBe(false);
    expect(finished.value).toBe(false);
  });

  it('should load more data', async () => {
    // First page load
    (getNewsList as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: {
        items: mockNewsItems,
        meta: { page: 1, pageSize: 10, total: 20, totalPages: 2 },
      },
    });

    const { list, loadMore, meta } = useNewsList();
    await new Promise(process.nextTick);

    expect(list.value).toHaveLength(2);
    expect(meta.page).toBe(2);

    // Load second page
    const moreNewsItems = [
      { id: 3, title: 'News 3', content: 'Content 3', createTime: '2023-01-03' },
    ];
    (getNewsList as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: {
        items: moreNewsItems,
        meta: { page: 2, pageSize: 10, total: 20, totalPages: 2 },
      },
    });

    await loadMore();

    expect(getNewsList).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
    expect(list.value).toHaveLength(3);
    expect(list.value[2]).toEqual(moreNewsItems[0]);
    expect(meta.page).toBe(3);
  });

  it('should set finished to true when all pages are loaded', async () => {
    (getNewsList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: mockNewsItems,
        meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
      },
    });

    const { finished } = useNewsList();
    await new Promise(process.nextTick);

    expect(finished.value).toBe(true);
  });

  it('should handle refresh', async () => {
    // Initial load
    (getNewsList as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: {
        items: mockNewsItems,
        meta: { page: 1, pageSize: 10, total: 20, totalPages: 2 },
      },
    });

    const { list, refresh, meta } = useNewsList();
    await new Promise(process.nextTick);

    expect(list.value).toHaveLength(2);

    // Refresh
    const refreshedItems = [
      { id: 4, title: 'News 4', content: 'Content 4', createTime: '2023-01-04' },
    ];
    (getNewsList as jest.Mock).mockResolvedValueOnce({
      code: 200,
      data: {
        items: refreshedItems,
        meta: { page: 1, pageSize: 10, total: 20, totalPages: 2 },
      },
    });

    await refresh();

    expect(getNewsList).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(list.value).toEqual(refreshedItems);
    expect(meta.page).toBe(2);
  });

  it('should handle API error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getNewsList as jest.Mock).mockRejectedValue(new Error('Network Error'));

    const { list, finished, loading } = useNewsList();
    
    expect(loading.value).toBe(true);
    await new Promise(process.nextTick);

    expect(list.value).toEqual([]);
    expect(finished.value).toBe(true);
    expect(loading.value).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('API请求错误:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should handle API failure response', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getNewsList as jest.Mock).mockResolvedValue({
      code: 500,
      message: 'Server Error',
    });

    const { list, finished } = useNewsList();
    await new Promise(process.nextTick);

    expect(list.value).toEqual([]);
    expect(finished.value).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith('获取新闻列表失败:', 'Server Error');

    consoleSpy.mockRestore();
  });
});
