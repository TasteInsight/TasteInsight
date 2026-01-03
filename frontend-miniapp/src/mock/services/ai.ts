import type {
  SuggestionData,
  ApiResponse,
  SessionCreateData,
  HistoryData,
  ChatMessageItem,
  ChatRequest,
  AIStreamCallbacks,
} from '@/types/api';

// 模拟网络延迟
const mockDelay = () => new Promise(resolve => setTimeout(resolve, 200));

// 模拟会话存储
const mockSessions = new Map<string, ChatMessageItem[]>();

// AI 提示词数据
const mockAISuggestions = [
  '帮我推荐一些适合减肥的菜品',
  '我今天想吃辣的，有什么推荐？',
  '推荐一些适合早餐的健康食物',
  '我喜欢吃海鲜，有什么好的选择？',
  '帮我搭配一个营养均衡的午餐',
  '推荐一些适合办公室工作的便当',
  '我想吃素食，有什么推荐？',
  '推荐一些适合运动后的恢复食物',
  '帮我推荐一些适合儿童的菜品',
  '推荐一些适合孕妇的营养餐',
  '我想吃甜品，有什么健康的选项？',
  '推荐一些适合晚餐的清淡食物',
  '帮我推荐一些适合聚会的菜品',
  '推荐一些适合冬天的暖胃食物',
  '我想吃酸的，有什么推荐？',
  '推荐一些适合夏天的清凉食物',
  '帮我推荐一些适合上班族的快手菜',
  '推荐一些适合学生党的经济实惠菜品',
  '我想吃面食，有什么好的选择？',
  '推荐一些适合节日庆祝的特色菜品',
];

// 获取AI提示词
export const mockGetAISuggestions = async (clientContext?: {
  localTime?: string;
  timeZone?: string;
  tzOffsetMinutes?: number;
}): Promise<ApiResponse<SuggestionData>> => {
  console.log('🤖 [Mock] 获取AI提示词 - 开始', clientContext);
  await mockDelay();

  // 确保返回的是纯对象
  const response = {
    code: 200,
    message: 'success',
    data: {
      suggestions: [...mockAISuggestions], // 创建副本
    },
  };

  console.log('🤖 [Mock] 获取AI提示词 - 返回数据:', JSON.stringify(response));
  return response;
};

// 创建会话
export const mockCreateAISession = async (): Promise<ApiResponse<SessionCreateData>> => {
  console.log('🤖 [Mock] 创建AI会话 - 开始');
  await mockDelay();

  const sessionId = `mock-session-${Date.now()}`;
  mockSessions.set(sessionId, []);

  const response = {
    code: 200,
    message: 'success',
    data: {
      sessionId,
      welcomeMessage: '你好！我是你的美食助手，有什么可以帮你的吗？',
    },
  };

  console.log('🤖 [Mock] 创建AI会话 - 返回数据:', JSON.stringify(response));
  return response;
};

// 获取历史记录
export const mockGetAIHistory = async (sessionId: string): Promise<ApiResponse<HistoryData>> => {
  console.log(`🤖 [Mock] 获取AI历史记录 - SessionId: ${sessionId}`);
  await mockDelay();

  // 模拟一些历史数据，如果为空
  let messages = mockSessions.get(sessionId);
  if (!messages) {
    messages = [];
    mockSessions.set(sessionId, messages);
  }

  const response = {
    code: 200,
    message: 'success',
    data: {
      messages,
    },
  };

  return response;
};

// 流式对话
export const mockStreamAIChat = (
  sessionId: string,
  payload: ChatRequest,
  callbacks: AIStreamCallbacks = {}
) => {
  console.log(`🤖 [Mock] 流式对话 - SessionId: ${sessionId}, Message: ${payload.message}`);

  let isAborted = false;

  // 模拟用户消息入库
  const userMsg: ChatMessageItem = {
    role: 'user',
    timestamp: new Date().toISOString(),
    content: [{ type: 'text', data: payload.message }],
  };

  const history = mockSessions.get(sessionId) || [];
  history.push(userMsg);
  mockSessions.set(sessionId, history);

  // 模拟AI回复
  const aiResponseText = `收到你的消息："${payload.message}"。这是一个模拟的流式回复。
  
我可以帮你推荐菜品，或者制定饮食计划。`;

  const chunks = aiResponseText.split('');
  let currentIndex = 0;

  const streamInterval = setInterval(() => {
    if (isAborted) {
      clearInterval(streamInterval);
      return;
    }

    if (currentIndex >= chunks.length) {
      clearInterval(streamInterval);

      // 模拟AI消息入库
      const aiMsg: ChatMessageItem = {
        role: 'assistant',
        timestamp: new Date().toISOString(),
        content: [{ type: 'text', data: aiResponseText }],
      };
      history.push(aiMsg);
      mockSessions.set(sessionId, history);

      callbacks.onComplete?.();
      return;
    }

    // 每次发送几个字符
    const chunkSize = Math.floor(Math.random() * 3) + 1;
    const chunkContent = chunks.slice(currentIndex, currentIndex + chunkSize).join('');
    currentIndex += chunkSize;

    // 发送事件类型和文本chunk
    callbacks.onEvent?.('text_chunk');
    callbacks.onMessage?.(chunkContent);
  }, 100);

  return {
    close: () => {
      isAborted = true;
      clearInterval(streamInterval);
      console.log('🤖 [Mock] 流式对话 - 已中断');
    },
  };
};

// 删除会话
export const mockDeleteAISession = async (sessionId: string): Promise<ApiResponse<null>> => {
  console.log(`🤖 [Mock] 删除AI会话 - SessionId: ${sessionId}`);
  await mockDelay();

  // 从模拟存储中删除会话
  mockSessions.delete(sessionId);

  const response = {
    code: 200,
    message: 'success',
    data: null,
  };

  console.log('🤖 [Mock] 删除AI会话 - 返回数据:', JSON.stringify(response));
  return response;
};
