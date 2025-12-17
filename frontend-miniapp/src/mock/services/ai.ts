// Mock AI 服务
import type { SuggestionData, ApiResponse } from '@/types/api';

// 模拟网络延迟
const mockDelay = () => new Promise(resolve => setTimeout(resolve, 200));

// AI 提示词数据
const mockAISuggestions = [
  "帮我推荐一些适合减肥的菜品",
  "我今天想吃辣的，有什么推荐？",
  "推荐一些适合早餐的健康食物",
  "我喜欢吃海鲜，有什么好的选择？",
  "帮我搭配一个营养均衡的午餐",
  "推荐一些适合办公室工作的便当",
  "我想吃素食，有什么推荐？",
  "推荐一些适合运动后的恢复食物",
  "帮我推荐一些适合儿童的菜品",
  "推荐一些适合孕妇的营养餐",
  "我想吃甜品，有什么健康的选项？",
  "推荐一些适合晚餐的清淡食物",
  "帮我推荐一些适合聚会的菜品",
  "推荐一些适合冬天的暖胃食物",
  "我想吃酸的，有什么推荐？",
  "推荐一些适合夏天的清凉食物",
  "帮我推荐一些适合上班族的快手菜",
  "推荐一些适合学生党的经济实惠菜品",
  "我想吃面食，有什么好的选择？",
  "推荐一些适合节日庆祝的特色菜品"
];

// 获取AI提示词
export const mockGetAISuggestions = async (): Promise<ApiResponse<SuggestionData>> => {
  console.log('🤖 [Mock] 获取AI提示词 - 开始');
  await mockDelay();
  
  // 确保返回的是纯对象
  const response = {
    code: 200,
    message: 'success',
    data: {
      suggestions: [...mockAISuggestions] // 创建副本
    }
  };
  
  console.log('🤖 [Mock] 获取AI提示词 - 返回数据:', JSON.stringify(response));
  return response;
};