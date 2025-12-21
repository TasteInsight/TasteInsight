import { useNewsDetail } from '@/pages/news/composables/use-news-detail';
import { getNewsById } from '@/api/modules/news';
import { ref } from 'vue';

// Mock API
jest.mock('@/api/modules/news', () => ({
  getNewsById: jest.fn()
}));

// Mock onLoad
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: (fn: Function) => fn({ id: '123' }),
}));

// Mock uni
(global as any).uni = {
  showToast: jest.fn(),
} as any;

describe('useNewsDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize and fetch news detail', async () => {
    const mockNews = {
      id: 123,
      title: 'Test News',
      content: '<p>Content</p>',
      publishTime: '2023-01-01T12:00:00Z'
    };
    (getNewsById as jest.Mock).mockResolvedValue({
      code: 200,
      data: mockNews
    });

    const { newsDetail, loading, initDetailPage } = useNewsDetail();
    
    // Trigger init which calls onLoad -> fetchNewsDetail
    initDetailPage();
    
    expect(loading.value).toBe(true);
    
    // Wait for async
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(loading.value).toBe(false);
    expect(newsDetail.value).toEqual(mockNews);
    expect(getNewsById).toHaveBeenCalledWith('123');
  });

  it('should format content correctly', async () => {
    const mockNews = {
      id: 123,
      title: 'Test News',
      content: '<img src="test.jpg"><table><tr><td>Data</td></tr></table><pre>Code</pre>',
    };
    (getNewsById as jest.Mock).mockResolvedValue({
      code: 200,
      data: mockNews
    });

    const { newsDetail, formattedContent, initDetailPage } = useNewsDetail();
    initDetailPage();
    await new Promise(resolve => setTimeout(resolve, 0));

    const content = formattedContent.value;
    expect(content).toContain('max-width:100%');
    expect(content).toContain('display:block'); // img style
    expect(content).toContain('box-sizing:border-box'); // table style
    expect(content).toContain('white-space:pre-wrap'); // pre style
  });

  it('should handle fetch error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getNewsById as jest.Mock).mockRejectedValue(new Error('Network Error'));

    const { newsDetail, loading, initDetailPage } = useNewsDetail();
    initDetailPage();
    
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(loading.value).toBe(false);
    expect(newsDetail.value).toEqual({});
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});
