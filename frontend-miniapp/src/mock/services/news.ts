// Mock 新闻服务
import type { News, PaginationParams, PaginatedData } from '@/types/api';
import { createMockNews } from '../data/news';

// 模拟网络延迟
const mockDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 300));

// 获取新闻列表
export const mockGetNewsList = async (params?: PaginationParams): Promise<PaginatedData<News>> => {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 10;
  
  console.log(`📰 [Mock] 获取新闻列表 (第${page}页)`);
  await mockDelay();
  
  const allNews = createMockNews();
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = allNews.slice(start, end);
  
  console.log(`✅ [Mock] 返回 ${items.length} 条新闻`);
  return {
    items,
    meta: {
      page,
      pageSize,
      total: allNews.length,
      totalPages: Math.ceil(allNews.length / pageSize),
    },
  };
};

// 获取新闻详情
export const mockGetNewsById = async (id: string): Promise<News | null> => {
  console.log(`📰 [Mock] 获取新闻详情: ${id}`);
  await mockDelay();
  
  const allNews = createMockNews();
  const news = allNews.find(n => n.id === id);
  
  if (news) {
    console.log(`✅ [Mock] 找到新闻: ${news.title}`);
    return news;
  } else {
    console.warn(`⚠️ [Mock] 新闻不存在: ${id}`);
    return null;
  }
};
