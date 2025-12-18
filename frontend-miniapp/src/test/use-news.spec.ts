import { useNewsList } from '@/pages/news/composables/use-news-list';
import { getNewsList } from '@/api/modules/news';
import { ref, nextTick } from 'vue';

// Mock API
jest.mock('@/api/modules/news', () => ({
  getNewsList: jest.fn()
}));

// Mock onMounted
jest.mock('vue', () => {
  const original = jest.requireActual('vue');
  return {
    ...original,
    onMounted: (fn: Function) => fn(),
  };
});

// Helper to wait for promises
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('useNewsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    (getNewsList as jest.Mock).mockResolvedValue({ code: 200, data: { items: [] } });
    const { list, loading, finished, isRefreshing } = useNewsList();
    
    expect(loading.value).toBe(true);
    
    await flushPromises();

    expect(list.value).toEqual([]);
    expect(loading.value).toBe(false);
  });

  it('should fetch news successfully', async () => {
    const mockNews = [{ id: 1, title: 'News 1' }];
    (getNewsList as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        items: mockNews,
        meta: { total: 1, totalPages: 1 }
      }
    });

    const { list, loading } = useNewsList();
    
    expect(loading.value).toBe(true);
    
    await flushPromises();

    expect(loading.value).toBe(false);
    expect(list.value).toEqual(mockNews);
  });

  it('should handle refresh', async () => {
    (getNewsList as jest.Mock).mockResolvedValue({ code: 200, data: { items: [], meta: { totalPages: 0 } } });
    const { refresh, isRefreshing, list } = useNewsList();
    
    await flushPromises(); // Wait for initial load

    const promise = refresh();
    expect(isRefreshing.value).toBe(true);
    
    await promise;

    expect(isRefreshing.value).toBe(false);
  });
});
