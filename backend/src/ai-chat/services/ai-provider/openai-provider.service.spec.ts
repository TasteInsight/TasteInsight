import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIProviderService } from './openai-provider.service';
import {
  AIProviderConfig,
  AIMessage,
  Tool,
} from './base-ai-provider.interface';

// Mock OpenAI class
const mockCreate = jest.fn();
const mockOpenAIInstance = {
  chat: {
    completions: {
      create: mockCreate,
    },
  },
};

// Mock the OpenAI module with both default and named exports
jest.mock('openai', () => {
  const MockOpenAI = jest.fn().mockImplementation(() => mockOpenAIInstance);
  return {
    __esModule: true,
    default: MockOpenAI,
    OpenAI: MockOpenAI,
  };
});

describe('OpenAIProviderService', () => {
  let service: OpenAIProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenAIProviderService],
    }).compile();

    service = module.get<OpenAIProviderService>(OpenAIProviderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setConfig', () => {
    it('should set config and create OpenAI client', () => {
      const config: AIProviderConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
      };

      service.setConfig(config);

      // Verify config is stored
      expect(service['config']).toEqual(config);
      expect(service['client']).toBeDefined();
    });

    it('should update config when called multiple times', () => {
      const config1: AIProviderConfig = {
        apiKey: 'test-api-key-1',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
      };

      const config2: AIProviderConfig = {
        apiKey: 'test-api-key-2',
        baseUrl: 'https://custom.api.com/v1',
        model: 'gpt-4',
      };

      service.setConfig(config1);
      expect(service['config']).toEqual(config1);

      service.setConfig(config2);
      expect(service['config']).toEqual(config2);
    });
  });

  describe('streamChat', () => {
    const mockConfig: AIProviderConfig = {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
    };

    const mockMessages: AIMessage[] = [{ role: 'user', content: '你好' }];

    const mockTools: Tool[] = [];

    it('should throw error when client is not configured', async () => {
      const generator = service.streamChat(mockMessages, mockTools);

      await expect(generator.next()).rejects.toThrow(
        'AI provider not configured',
      );
    });

    it('should yield text content from stream', async () => {
      service.setConfig(mockConfig);

      // Mock the stream response
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{ delta: { content: '你好' }, finish_reason: null }],
          };
          yield {
            choices: [
              { delta: { content: '，我是AI助手' }, finish_reason: null },
            ],
          };
          yield {
            choices: [{ delta: {}, finish_reason: 'stop' }],
          };
        },
      };

      mockCreate.mockResolvedValue(mockStream);

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'text', content: '你好' });
      expect(chunks).toContainEqual({ type: 'text', content: '，我是AI助手' });
      expect(chunks).toContainEqual({ type: 'done' });
    });

    it('should yield tool calls from stream', async () => {
      service.setConfig(mockConfig);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_123',
                      function: { name: 'search_dishes', arguments: '' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      function: { arguments: '{"keyword":"宫保鸡丁"}' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [{ delta: {}, finish_reason: 'tool_calls' }],
          };
        },
      };

      mockCreate.mockResolvedValue(mockStream);

      const toolDefinitions: Tool[] = [
        {
          type: 'function',
          function: {
            name: 'search_dishes',
            description: 'Search dishes',
            parameters: { type: 'object', properties: {} },
          },
        },
      ];

      const generator = service.streamChat(mockMessages, toolDefinitions);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      const toolCallChunks = chunks.filter((c) => c.type === 'tool_call');
      expect(toolCallChunks.length).toBeGreaterThan(0);
      expect(chunks).toContainEqual({ type: 'done' });
    });

    it('should handle multiple tool calls in stream', async () => {
      service.setConfig(mockConfig);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_1',
                      function: { name: 'tool_a', arguments: '{}' },
                    },
                    {
                      index: 1,
                      id: 'call_2',
                      function: { name: 'tool_b', arguments: '{}' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
          yield {
            choices: [{ delta: {}, finish_reason: 'tool_calls' }],
          };
        },
      };

      mockCreate.mockResolvedValue(mockStream);

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      const toolCallChunks = chunks.filter((c) => c.type === 'tool_call');
      expect(toolCallChunks.length).toBe(2);
    });

    it('should yield done when stream completes without finish_reason', async () => {
      service.setConfig(mockConfig);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{ delta: { content: '测试' } }],
          };
          // Stream ends without finish_reason
        },
      };

      mockCreate.mockResolvedValue(mockStream);

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks[chunks.length - 1]).toEqual({ type: 'done' });
    });

    it('should handle error and yield error message for unauthorized', async () => {
      service.setConfig(mockConfig);

      mockCreate.mockRejectedValue(new Error('401 Unauthorized'));

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({
        type: 'error',
        error: '抱歉，我现在无法处理您的请求，请稍后再试。',
      });
    });

    it('should handle error and yield error message for rate limit', async () => {
      service.setConfig(mockConfig);

      mockCreate.mockRejectedValue(new Error('429 rate_limit exceeded'));

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({
        type: 'error',
        error: '抱歉，当前请求过于频繁，请稍后再试。',
      });
    });

    it('should handle error and yield error message for timeout', async () => {
      service.setConfig(mockConfig);

      mockCreate.mockRejectedValue(new Error('Request timeout'));

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({
        type: 'error',
        error: '抱歉，响应时间过长，请稍后再试。',
      });
    });

    it('should handle network error', async () => {
      service.setConfig(mockConfig);

      mockCreate.mockRejectedValue(new Error('network connection failed'));

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({
        type: 'error',
        error: '抱歉，响应时间过长，请稍后再试。',
      });
    });

    it('should handle unknown error with default message', async () => {
      service.setConfig(mockConfig);

      mockCreate.mockRejectedValue(new Error('unknown error occurred'));

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({
        type: 'error',
        error: '抱歉，我现在无法处理您的请求，请稍后再试。',
      });
    });

    it('should handle non-Error objects', async () => {
      service.setConfig(mockConfig);

      mockCreate.mockRejectedValue('string error');

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({
        type: 'error',
        error: '抱歉，我现在无法处理您的请求，请稍后再试。',
      });
    });

    it('should skip empty delta', async () => {
      service.setConfig(mockConfig);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{ delta: null, finish_reason: null }],
          };
          yield {
            choices: [{ delta: { content: '内容' }, finish_reason: null }],
          };
          yield {
            choices: [{ delta: {}, finish_reason: 'stop' }],
          };
        },
      };

      mockCreate.mockResolvedValue(mockStream);

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'text', content: '内容' });
      expect(chunks).toContainEqual({ type: 'done' });
      expect(chunks.length).toBe(2);
    });

    it('should handle empty choices array', async () => {
      service.setConfig(mockConfig);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [],
          };
          yield {
            choices: [{ delta: { content: '内容' }, finish_reason: 'stop' }],
          };
        },
      };

      mockCreate.mockResolvedValue(mockStream);

      const generator = service.streamChat(mockMessages, mockTools);
      const chunks = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should still get text and done
      expect(chunks.some((c) => c.type === 'text')).toBe(true);
      expect(chunks.some((c) => c.type === 'done')).toBe(true);
    });
  });
});
