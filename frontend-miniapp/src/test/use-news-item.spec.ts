import { useNewsItem } from '@/pages/news/composables/use-news-item';

describe('useNewsItem', () => {
  const { formatTime, stripHtml, getNewsSummary, getNewsTagText } = useNewsItem();

  it('should format time correctly', () => {
    const time = '2023-01-01T12:30:00';
    expect(formatTime(time, 'date')).toBe('2023-01-01');
    expect(formatTime(time, 'datetime')).toBe('2023-01-01 12:30');
    expect(formatTime('')).toBe('');
  });

  it('should strip HTML tags', () => {
    const html = '<p>Hello <b>World</b></p>';
    expect(stripHtml(html)).toBe('Hello World');
    expect(stripHtml('')).toBe('');
  });

  it('should truncate long text', () => {
    const longText = 'a'.repeat(100);
    const stripped = stripHtml(longText, 10);
    expect(stripped).toBe('aaaaaaaaaa...');
    expect(stripped.length).toBe(13); // 10 chars + 3 dots
  });

  it('should get news summary', () => {
    const newsWithSummary = { summary: 'Summary', content: 'Content' } as any;
    expect(getNewsSummary(newsWithSummary)).toBe('Summary');

    const newsWithoutSummary = { content: '<p>Content</p>' } as any;
    expect(getNewsSummary(newsWithoutSummary)).toBe('Content');
  });

  it('should get news tag text', () => {
    const newsWithCanteen = { canteenName: 'Canteen A' } as any;
    expect(getNewsTagText(newsWithCanteen)).toBe('Canteen A');

    const newsWithoutCanteen = {} as any;
    expect(getNewsTagText(newsWithoutCanteen)).toBe('全校公告');
  });
});
