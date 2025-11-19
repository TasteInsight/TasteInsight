// @/api/modules/news.ts
import request from '@/utils/request';
import type { News, PaginationParams, PaginatedData, ApiResponse } from '@/types/api';

// ========== Mock 配置 ==========
const USE_MOCK = true;

const mockDelay = (ms: number = 300) => 
  new Promise(resolve => setTimeout(resolve, ms));

const createMockNews = (): News[] => [
  {
    id: 'news_001',
    title: '一食堂新菜品上线通知',
    content: '亲爱的同学们，为丰富大家的就餐选择，一食堂将于本周推出多款新菜品，包括川味特色小炒、养生炖汤等。所有新菜品均采用新鲜食材，价格亲民，欢迎大家前来品尝！营养师团队精心搭配，确保每道菜品营养均衡。新菜品将于周一正式推出。',
    summary: '一食堂推出多款新菜品，包括川味特色小炒、养生炖汤等',
    canteenId: 'canteen_001',
    canteenName: '一食堂',
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: '食堂管理员',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'news_002',
    title: '校园食堂卫生检查结果公布',
    content: '根据学校后勤处最新卫生检查结果，所有食堂均获得A级评定。检查组对食堂的食品安全管理、环境卫生、人员健康等多个方面进行了全面检查，一食堂、二食堂、三食堂均表现出色，各项指标均达到优秀标准。学校将继续加强食堂监管，确保师生饮食安全。',
    summary: '所有食堂均获得A级卫生评定，食品安全有保障',
    canteenId: '',
    canteenName: '',
    publishedAt: new Date(Date.now() - 172800000).toISOString(),
    createdBy: '后勤处',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'news_003',
    title: '二食堂推出营养套餐',
    content: '为帮助同学们合理搭配营养，二食堂特别推出营养套餐系列。每套餐品包含主菜、配菜、汤品和水果，营养均衡，热量适中。套餐价格仅需25元起，性价比超高！营养师会根据季节变化调整菜品，确保营养丰富多样。',
    summary: '二食堂推出营养套餐，营养均衡价格实惠',
    canteenId: 'canteen_002',
    canteenName: '二食堂',
    publishedAt: new Date(Date.now() - 259200000).toISOString(),
    createdBy: '营养师',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'news_004',
    title: '食堂营业时间调整通知',
    content: '根据寒假放假安排，食堂营业时间将进行如下调整：早餐6:30-8:30，午餐11:00-13:30，晚餐17:00-19:30。寒假期间将继续为留校同学提供优质服务。如有特殊需求，请提前联系食堂管理人员。',
    summary: '寒假期间食堂营业时间调整通知',
    canteenId: '',
    canteenName: '',
    publishedAt: new Date(Date.now() - 345600000).toISOString(),
    createdBy: '后勤管理中心',
    createdAt: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: 'news_005',
    title: '三食堂特色窗口开放',
    content: '三食堂特色窗口正式开放！窗口提供日韩料理、东南亚风味等多种特色菜品。主厨均有海外烹饪经验，保证正宗口味。欢迎同学们前来体验世界各地的美食文化。每周还会推出限定特色菜品，敬请期待！',
    summary: '三食堂特色窗口开放，提供日韩及东南亚美食',
    canteenId: 'canteen_003',
    canteenName: '三食堂',
    publishedAt: new Date(Date.now() - 432000000).toISOString(),
    createdBy: '三食堂经理',
    createdAt: new Date(Date.now() - 432000000).toISOString(),
  },
];

const mockNewsDatabase = createMockNews();
// ========== End Mock 配置 ==========

/**
 * 获取新闻列表
 */
export const getNewsList = async (params?: {
  page?: number;
  pageSize?: number;
  canteenId?: string;
}): Promise<ApiResponse<PaginatedData<News>>> => {
  if (USE_MOCK) {
    await mockDelay(400);
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = mockNewsDatabase.slice(startIndex, endIndex);
    
    console.log(`📰 [Mock] 获取新闻列表 (第${page}页):`, items);
    
    return {
      code: 200,
      message: 'Success',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total: mockNewsDatabase.length,
          totalPages: Math.ceil(mockNewsDatabase.length / pageSize),
        },
      },
    };
  }
  
  return request<PaginatedData<News>>({
    url: '/news',
    method: 'GET',
  });
};

/**
 * 获取新闻详情
 */
export const getNewsById = async (
  id: string
): Promise<ApiResponse<News>> => {
  if (USE_MOCK) {
    await mockDelay(300);
    const news = mockNewsDatabase.find(item => item.id === id);
    
    if (!news) {
      console.warn(`📰 [Mock] 新闻不存在: ${id}`);
      return {
        code: 404,
        message: '新闻不存在',
        data: null as any,
      };
    }
    
    console.log(`📰 [Mock] 获取新闻详情: ${news.title}`, news);
    return {
      code: 200,
      message: 'Success',
      data: news,
    };
  }
  
  return request<News>({
    url: `/news/${id}`,
    method: 'GET',
  });
};