// @/pages/news/composables/useNewsDetail.ts
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getNewsById } from '@/api/modules/news';
import dayjs from 'dayjs';
import type { News } from '@/types/api';

/**
 * 新闻详情相关的组合式函数
 * 处理新闻详情的获取和显示逻辑
 */
export function useNewsDetail() {
  const newsDetail = ref<News>({} as News);
  const loading = ref<boolean>(false);

  /**
   * 处理富文本内容，主要是为了让图片自适应屏幕宽度
   */
  const formattedContent = computed((): string => {
    if (!newsDetail.value.content) return '';

    let content: string = newsDetail.value.content;

    // 0. 移除 html 和 body 标签，防止 rich-text 解析异常
    content = content.replace(/<\/?html[^>]*>/gi, '').replace(/<\/?body[^>]*>/gi, '');

    // 1. 给 img 标签添加 max-width: 100% 样式
    content = content.replace(/<img[^>]*>/gi, (match: string) => {
      // 如果已经有 style 属性
      if (match.indexOf('style="') > -1) {
        return match.replace('style="', 'style="max-width:100%;height:auto;display:block;margin:10px auto;');
      }
      // 如果没有 style 属性
      return match.replace('<img', '<img style="max-width:100%;height:auto;display:block;margin:10px auto;"');
    });

    // 2. 给 table 添加 max-width: 100%
    content = content.replace(/<table[^>]*>/gi, (match: string) => {
      if (match.indexOf('style="') > -1) {
        return match.replace('style="', 'style="max-width:100%;box-sizing:border-box;');
      }
      return match.replace('<table', '<table style="max-width:100%;box-sizing:border-box;"');
    });

    // 3. 给 pre 添加样式防止溢出
    content = content.replace(/<pre[^>]*>/gi, (match: string) => {
      if (match.indexOf('style="') > -1) {
        return match.replace('style="', 'style="max-width:100%;white-space:pre-wrap;word-break:break-all;');
      }
      return match.replace('<pre', '<pre style="max-width:100%;white-space:pre-wrap;word-break:break-all;"');
    });

    return content;
  });

  /**
   * 格式化时间显示
   * @param time 时间字符串
   */
  const formatTime = (time: string): string => {
    if (!time) return '';
    return dayjs(time).format('YYYY-MM-DD HH:mm');
  };

  /**
   * 获取新闻详情
   * @param id 新闻ID
   */
  const fetchNewsDetail = async (id: string): Promise<void> => {
    loading.value = true;
    try {
      const res = await getNewsById(id);
      if (res.code === 200 && res.data) {
        newsDetail.value = res.data;
      } else {
        uni.showToast({ title: '加载失败', icon: 'error' });
      }
    } catch (error) {
      console.error('获取新闻详情失败:', error);
      uni.showToast({ title: '网络错误', icon: 'error' });
    } finally {
      loading.value = false;
    }
  };

  /**
   * 初始化详情页
   * 在页面加载时调用
   */
  const initDetailPage = (): void => {
    onLoad((options: any) => {
      if (options.id) {
        fetchNewsDetail(options.id);
      } else {
        uni.showToast({ title: '参数错误', icon: 'none' });
      }
    });
  };

  return {
    newsDetail,
    loading,
    formattedContent,
    formatTime,
    fetchNewsDetail,
    initDetailPage,
  };
}