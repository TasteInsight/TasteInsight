// Mock 食堂数据
import type { Canteen, Window } from '@/types/api';

export const createMockCanteens = (): Canteen[] => [
  {
    id: 'canteen_001',
    name: '一食堂',
    position: '校园东区',
    description: '学校最大的综合性食堂，提供多种风味美食',
    images: ['https://via.placeholder.com/400x300'],
    operatingHours: '06:30-21:00',
    averageRating: 4.5,
    reviewCount: 1280,
  },
  {
    id: 'canteen_002',
    name: '二食堂',
    position: '校园西区',
    description: '以特色小吃和地方风味为主',
    images: ['https://via.placeholder.com/400x300'],
    operatingHours: '06:30-21:30',
    averageRating: 4.3,
    reviewCount: 956,
  },
  {
    id: 'canteen_003',
    name: '三食堂',
    position: '校园南区',
    description: '清真食堂，提供清真餐饮',
    images: ['https://via.placeholder.com/400x300'],
    operatingHours: '07:00-20:30',
    averageRating: 4.6,
    reviewCount: 623,
  },
  {
    id: 'canteen_004',
    name: '美食广场',
    position: '校园北区',
    description: '集合各地特色美食的综合美食广场',
    images: ['https://via.placeholder.com/400x300'],
    operatingHours: '07:00-22:00',
    averageRating: 4.4,
    reviewCount: 1543,
  },
];

export const createMockWindows = (): Window[] => [
  // 一食堂窗口
  {
    id: 'window_001',
    name: '川味窗口',
    number: '101',
    position: '一食堂1楼',
    description: '正宗川菜，麻辣鲜香',
    tag: ['川菜', '辣味', '热门'],
  },
  {
    id: 'window_002',
    name: '粤菜窗口',
    number: '102',
    position: '一食堂1楼',
    description: '清淡爽口的粤式美食',
    tag: ['粤菜', '清淡', '营养'],
  },
  {
    id: 'window_003',
    name: '早餐窗口',
    number: '103',
    position: '一食堂1楼',
    description: '各式早餐，粥品点心',
    tag: ['早餐', '粥品', '包子'],
  },
  {
    id: 'window_004',
    name: '面食窗口',
    number: '104',
    position: '一食堂1楼',
    description: '各种面食，现做现卖',
    tag: ['面条', '拉面', '刀削面'],
  },
  {
    id: 'window_005',
    name: '素食窗口',
    number: '105',
    position: '一食堂2楼',
    description: '健康素食，营养均衡',
    tag: ['素食', '健康', '低脂'],
  },
  
  // 二食堂窗口
  {
    id: 'window_006',
    name: '湘菜窗口',
    number: '201',
    position: '二食堂1楼',
    description: '湖南特色菜品',
    tag: ['湘菜', '辣味', '下饭'],
  },
  {
    id: 'window_007',
    name: '家常菜窗口',
    number: '202',
    position: '二食堂1楼',
    description: '经典家常菜，味道正宗',
    tag: ['家常菜', '经典', '实惠'],
  },
  {
    id: 'window_008',
    name: '盖饭窗口',
    number: '203',
    position: '二食堂1楼',
    description: '各种盖浇饭，快捷方便',
    tag: ['盖饭', '快餐', '实惠'],
  },
  {
    id: 'window_009',
    name: '烧烤窗口',
    number: '204',
    position: '二食堂2楼',
    description: '夜宵烧烤，美味诱人',
    tag: ['烧烤', '夜宵', '串串'],
  },
  
  // 三食堂窗口
  {
    id: 'window_010',
    name: '清真窗口',
    number: '301',
    position: '三食堂1楼',
    description: '正宗清真美食',
    tag: ['清真', '牛羊肉', '特色'],
  },
  {
    id: 'window_011',
    name: '新疆风味',
    number: '302',
    position: '三食堂1楼',
    description: '新疆特色美食',
    tag: ['新疆', '拌面', '抓饭'],
  },
  
  // 美食广场窗口
  {
    id: 'window_012',
    name: '东北菜窗口',
    number: '401',
    position: '美食广场1楼',
    description: '东北特色菜品',
    tag: ['东北菜', '分量足', '实惠'],
  },
  {
    id: 'window_013',
    name: '西式快餐',
    number: '402',
    position: '美食广场1楼',
    description: '汉堡披萨炸鸡',
    tag: ['西餐', '快餐', '年轻'],
  },
  {
    id: 'window_014',
    name: '日韩料理',
    number: '403',
    position: '美食广场2楼',
    description: '日式韩式料理',
    tag: ['日料', '韩餐', '精致'],
  },
  {
    id: 'window_015',
    name: '甜品饮品',
    number: '404',
    position: '美食广场2楼',
    description: '各式甜品奶茶',
    tag: ['甜品', '奶茶', '下午茶'],
  },
];

// 窗口与食堂的映射关系
export const windowCanteenMap: Record<string, string> = {
  window_001: 'canteen_001',
  window_002: 'canteen_001',
  window_003: 'canteen_001',
  window_004: 'canteen_001',
  window_005: 'canteen_001',
  window_006: 'canteen_002',
  window_007: 'canteen_002',
  window_008: 'canteen_002',
  window_009: 'canteen_002',
  window_010: 'canteen_003',
  window_011: 'canteen_003',
  window_012: 'canteen_004',
  window_013: 'canteen_004',
  window_014: 'canteen_004',
  window_015: 'canteen_004',
};

// 根据食堂ID获取窗口列表
export const getWindowsByCanteenId = (canteenId: string): Window[] => {
  const windows = createMockWindows();
  return windows.filter(window => windowCanteenMap[window.id] === canteenId);
};

// 根据窗口ID获取食堂ID
export const getCanteenIdByWindowId = (windowId: string): string | undefined => {
  return windowCanteenMap[windowId];
};
