import { Injectable, Logger } from '@nestjs/common';
import {
  BaseAIProvider,
  AIProviderConfig,
  AIMessage,
  Tool,
  StreamChunk,
} from './base-ai-provider.interface';

/**
 * Mock AI Provider for testing
 * Simulates OpenAI API responses without making actual API calls
 */
@Injectable()
export class MockAIProviderService implements BaseAIProvider {
  private readonly logger = new Logger(MockAIProviderService.name);
  private config: AIProviderConfig | null = null;

  constructor() {
    // Warn if used in non-test environment (though this shouldn't happen in production)
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(
        '⚠️  WARNING: MockAIProviderService is being used in production! This should not happen.',
      );
    } else {
      this.logger.log('Mock AI Provider initialized (for testing only)');
    }
  }

  setConfig(config: AIProviderConfig) {
    this.config = config;
    this.logger.log('Mock AI Provider configured (no actual API calls)');
  }

  async *streamChat(
    messages: AIMessage[],
    tools: Tool[],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.config) {
      throw new Error('AI provider not configured');
    }

    this.logger.debug(
      `Mock AI: Processing ${messages.length} messages with ${tools.length} tools`,
    );

    // Get the last user message
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();

    const userMessageText = lastUserMessage?.content || '';

    // Check for recent tool messages in conversation history
    const recentToolMessages = messages
      .filter((m) => m.role === 'tool')
      .slice(-3); // Check last 3 tool messages

    const hasToolError = recentToolMessages.some(
      (m) =>
        m.content &&
        typeof m.content === 'string' &&
        m.content.includes('Error executing tool'),
    );

    // Check if we have successful tool results (not errors)
    const hasToolResults = recentToolMessages.some(
      (m) =>
        m.content &&
        typeof m.content === 'string' &&
        !m.content.includes('Error executing tool'),
    );

    // Simulate AI thinking delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check if user message suggests tool usage
    // BUT: Don't call tools again if we already have successful tool results
    // Only retry if there was an error
    const shouldUseTools =
      tools.length > 0 &&
      !hasToolResults && // Don't call tools if we already have results
      (hasToolError ||
        userMessageText.includes('推荐') ||
        userMessageText.includes('搜索') ||
        userMessageText.includes('食堂') ||
        userMessageText.includes('食谱') ||
        userMessageText.includes('计划'));

    if (shouldUseTools && tools.length > 0) {
      // Simulate tool calling
      const toolToCall = tools[0]; // Use first available tool
      const toolCallId = `call_${Date.now()}`;

      // First, yield some text response
      const textResponse = hasToolError
        ? '让我重新尝试。'
        : '让我帮您查找相关信息。';
      for (const char of textResponse) {
        yield {
          type: 'text',
          content: char,
        };
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Generate appropriate arguments based on tool name
      let toolArguments: any = {};
      if (toolToCall.function.name === 'recommend_dishes') {
        // Determine mealTime from user message or default to lunch
        let mealTime = 'lunch';
        if (
          userMessageText.includes('早餐') ||
          userMessageText.includes('早饭')
        ) {
          mealTime = 'breakfast';
        } else if (
          userMessageText.includes('午餐') ||
          userMessageText.includes('午饭')
        ) {
          mealTime = 'lunch';
        } else if (
          userMessageText.includes('晚餐') ||
          userMessageText.includes('晚饭')
        ) {
          mealTime = 'dinner';
        } else if (userMessageText.includes('夜宵')) {
          mealTime = 'nightsnack';
        }
        toolArguments = { mealTime };
      } else if (toolToCall.function.name === 'search_dishes') {
        // Extract keyword from user message
        const keywordMatch = userMessageText.match(/搜索|找|查找|(.+)/);
        toolArguments = {
          keyword: keywordMatch?.[1]?.trim() || userMessageText || '菜品',
        };
      } else if (toolToCall.function.name === 'generate_meal_plan') {
        toolArguments = { days: 7 };
      }

      // Then yield tool call
      yield {
        type: 'tool_call',
        toolCall: {
          id: toolCallId,
          type: 'function',
          function: {
            name: toolToCall.function.name,
            arguments: JSON.stringify(toolArguments),
          },
        },
      };

      // Yield done after tool call
      yield { type: 'done' };
      return;
    }

    // Generate a mock text response based on user message
    let responseText = '';

    if (userMessageText.includes('推荐') || userMessageText.includes('午餐')) {
      responseText =
        '根据您的时间，我为您推荐以下午餐选项：\n\n1. 宫保鸡丁 - 经典川菜，口感丰富\n2. 红烧肉 - 肥而不腻，营养丰富\n3. 麻婆豆腐 - 素食佳选，麻辣鲜香\n\n这些菜品都很受欢迎，您可以根据个人口味选择。';
    } else if (
      userMessageText.includes('搜索') ||
      userMessageText.includes('找')
    ) {
      responseText =
        '我为您找到了以下相关菜品：\n\n1. 宫保鸡丁\n2. 鱼香肉丝\n3. 回锅肉\n\n这些菜品都符合您的搜索条件。';
    } else if (userMessageText.includes('食堂')) {
      responseText =
        '一食堂目前营业中，提供多种美食选择。推荐窗口：川味窗口、粤菜窗口。';
    } else if (
      userMessageText.includes('食谱') ||
      userMessageText.includes('计划')
    ) {
      responseText =
        '我为您制定了一份一周的饮食计划，包含营养均衡的早餐、午餐和晚餐。计划已保存，您可以随时查看和调整。';
    } else {
      responseText = `收到您的消息："${userMessageText}"。\n\n我是您的AI美食助手，可以帮您：\n- 推荐菜品\n- 搜索美食\n- 查询食堂信息\n- 制定饮食计划\n\n请告诉我您需要什么帮助？`;
    }

    // Stream the response character by character to simulate real streaming
    for (const char of responseText) {
      yield {
        type: 'text',
        content: char,
      };
      // Small delay to simulate network streaming
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    yield { type: 'done' };
  }
}
