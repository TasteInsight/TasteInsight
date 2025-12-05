import dayjs from 'dayjs';
import type { News } from '@/types/api';

/**
 * 新闻项相关的组合式函数
 * 处理新闻项的显示逻辑和交互
 */
export function useNewsItem() {
  /**
   * 格式化时间显示
   * @param time 时间字符串
   * @param format 格式化模式，'date' 或 'datetime'
   */
  const formatTime = (time: string, format: 'date' | 'datetime' = 'date'): string => {
    if (!time) return '';

    const date = dayjs(time);
    return format === 'date'
      ? date.format('YYYY-MM-DD')
      : date.format('YYYY-MM-DD HH:mm');
  };

  /**
   * 去除HTML标签，用于生成摘要
   * @param html HTML字符串
   * @param maxLength 最大长度
   */
  const stripHtml = (html: string, maxLength: number = 60): string => {
    if (!html) return '';

    const stripped = html.replace(/<[^>]*>/g, '');
    return stripped.length > maxLength
      ? stripped.substring(0, maxLength) + '...'
      : stripped;
  };

  /**
   * 获取新闻摘要
   * @param news 新闻对象
   */
  const getNewsSummary = (news: News): string => {
    return news.summary || stripHtml(news.content || '');
  };

  /**
   * 获取新闻标签显示文本
   * @param news 新闻对象
   */
  const getNewsTagText = (news: News): string => {
    return news.canteenName || '全校公告';
  };

  /**
   * 获取新闻标签样式类名
   * @param news 新闻对象
   */
  const getNewsTagClass = (news: News): string => {
    return news.canteenName
      ? 'bg-orange-50 text-orange-600'
      : 'bg-blue-50 text-blue-600';
  };

  /**
   * 跳转到新闻详情页
   * @param newsId 新闻ID
   */
  const goToDetail = (newsId: string): void => {
    if (newsId) {
      uni.navigateTo({
        url: `/pages/news/components/detail?id=${newsId}`,
      });
    }
  };

  return {
    formatTime,
    stripHtml,
    getNewsSummary,
    getNewsTagText,
    getNewsTagClass,
    goToDetail,
  };
}