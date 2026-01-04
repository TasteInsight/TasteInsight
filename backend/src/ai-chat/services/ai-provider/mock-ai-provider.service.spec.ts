import { Test, TestingModule } from '@nestjs/testing';
import { MockAIProviderService } from './mock-ai-provider.service';
import { Tool, StreamChunk } from './base-ai-provider.interface';

describe('MockAIProviderService', () => {
  let service: MockAIProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockAIProviderService],
    }).compile();

    service = module.get<MockAIProviderService>(MockAIProviderService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error if not configured', async () => {
    const messages: any[] = [{ role: 'user', content: 'hello' }];
    const tools: Tool[] = [];
    const iterator = service.streamChat(messages, tools);

    await expect(iterator.next()).rejects.toThrow('AI provider not configured');
  });

  it('should stream basic text response', async () => {
    service.setConfig({ apiKey: 'test', model: 'mock' });
    const messages: any[] = [{ role: 'user', content: 'hello' }];
    const tools: Tool[] = [];
    const iterator = service.streamChat(messages, tools);

    const chunks: StreamChunk[] = [];
    for await (const chunk of iterator) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.type === 'text')).toBe(true);
    expect(chunks.some((c) => c.type === 'done')).toBe(true);

    // Check content
    const fullText = chunks
      .filter((c) => c.type === 'text')
      .map((c) => c.content)
      .join('');
    expect(fullText).toContain('收到您的消息');
  });

  it('should trigger tool call for specific keywords', async () => {
    service.setConfig({ apiKey: 'test', model: 'mock' });
    const messages: any[] = [{ role: 'user', content: '推荐个午餐' }];
    const tools: Tool[] = [
      {
        type: 'function',
        function: {
          name: 'recommend_dishes',
          description: 'recommend dishes',
          parameters: {},
        },
      },
    ];

    // We expect the mock logic to catch '推荐' and '午餐' and trigger recommend_dishes

    const iterator = service.streamChat(messages, tools);
    const chunks: StreamChunk[] = [];
    for await (const chunk of iterator) {
      chunks.push(chunk);
    }

    const toolCallChunk = chunks.find((c) => c.type === 'tool_call');
    expect(toolCallChunk).toBeDefined();
    expect(toolCallChunk!.toolCall!.function.name).toBe('recommend_dishes');

    // Check arguments logic
    const args = JSON.parse(toolCallChunk!.toolCall!.function.arguments);
    expect(args.mealTime).toBe('lunch');
  });

  it('should NOT trigger tool call if results already exist', async () => {
    service.setConfig({ apiKey: 'test', model: 'mock' });

    // Messages history includes a tool response (not error)
    const messages: any[] = [
      { role: 'user', content: '推荐午餐' },
      { role: 'assistant', content: null, tool_calls: [] },
      { role: 'tool', content: 'Here are results: ...' }, // Simulated successful result
    ];

    const tools: Tool[] = [
      {
        type: 'function',
        function: {
          name: 'recommend_dishes',
          description: 'recommend dishes',
          parameters: {},
        },
      },
    ];

    const iterator = service.streamChat(messages, tools);
    const chunks: StreamChunk[] = [];
    for await (const chunk of iterator) {
      chunks.push(chunk);
    }

    // Should NOT have tool call
    const toolCallChunk = chunks.find((c) => c.type === 'tool_call');
    expect(toolCallChunk).toBeUndefined();

    // Should have text
    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.length).toBeGreaterThan(0);
    // Based on logic: if user message says '推荐', it returns specific text
    const fullText = textChunks.map((c) => c.content).join('');
    expect(fullText).toContain('根据您的时间');
  });
});
