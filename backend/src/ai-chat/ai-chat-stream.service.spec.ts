import { Test, TestingModule } from '@nestjs/testing';
import { AIChatService } from './ai-chat.service';
import { PrismaService } from '@/prisma.service';
import { AIConfigService } from './services/ai-config.service';
import { PromptSecurityService } from './services/prompt-security.service';
import { OpenAIProviderService } from './services/ai-provider/openai-provider.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { StreamChunk } from './services/ai-provider/base-ai-provider.interface';

const mockPrismaService = {
  aISession: {
    findFirst: jest.fn(),
  },
  aIMessage: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((cb) => cb(mockPrismaService)),
};

const mockAIConfigService = {
  getProviderConfig: jest.fn().mockReturnValue({
    model: 'gpt-4',
    temperature: 0.7,
  }),
};

const mockPromptSecurityService = {
  validateUserInput: jest
    .fn()
    .mockReturnValue({ isValid: true, sanitized: 'test' }),
  enhanceSystemPrompt: jest.fn((p) => p),
  filterAIResponse: jest.fn((r) => r),
  validateToolParams: jest.fn().mockReturnValue({ isValid: true }),
};

const mockToolRegistryService = {
  getAllTools: jest.fn().mockReturnValue([]),
  executeTool: jest.fn(),
};

// Helper to create an async generator from an array
async function* createAsyncGenerator<T>(data: T[]): AsyncGenerator<T> {
  for (const item of data) {
    yield item;
  }
}

const mockOpenAIProviderService = {
  setConfig: jest.fn(),
  streamChat: jest.fn(),
};

describe('AIChatService - Stream', () => {
  let service: AIChatService;
  let prisma: typeof mockPrismaService;
  let openaiProvider: typeof mockOpenAIProviderService;
  let toolRegistry: typeof mockToolRegistryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIChatService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AIConfigService, useValue: mockAIConfigService },
        { provide: PromptSecurityService, useValue: mockPromptSecurityService },
        { provide: OpenAIProviderService, useValue: mockOpenAIProviderService },
        { provide: ToolRegistryService, useValue: mockToolRegistryService },
      ],
    }).compile();

    service = module.get<AIChatService>(AIChatService);
    prisma = mockPrismaService;
    openaiProvider = mockOpenAIProviderService;
    toolRegistry = mockToolRegistryService;
  });

  describe('streamChat', () => {
    const userId = 'u1';
    const sessionId = 's1';
    const dto = { message: 'Hello' };

    it('should handle basic text stream', (done) => {
      prisma.aISession.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        messages: [],
      });
      prisma.aIMessage.findMany.mockResolvedValue([]);
      prisma.aIMessage.create.mockResolvedValue({ id: 'msg1' });

      // Mock stream response
      const chunks: StreamChunk[] = [
        { type: 'text', content: 'Hello' },
        { type: 'text', content: ' World' },
      ];
      openaiProvider.streamChat.mockReturnValue(createAsyncGenerator(chunks));

      const events: any[] = [];

      service.streamChat(userId, sessionId, dto).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          try {
            expect(events).toHaveLength(2);
            expect(events[0].data).toBe('Hello');
            expect(events[1].data).toBe(' World');
            expect(prisma.aIMessage.create).toHaveBeenCalledTimes(2); // One for user, one for assistant
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    });

    it('should handle tool calls', (done) => {
      prisma.aISession.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        messages: [],
      });
      prisma.aIMessage.findMany.mockResolvedValue([]);
      prisma.aIMessage.create.mockResolvedValue({ id: 'msg1' });

      // First pass: AI returns a tool call
      const toolCallChunk: StreamChunk = {
        type: 'tool_call',
        toolCall: {
          id: 'call1',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: JSON.stringify({ city: 'Beijing' }),
          },
        },
      };

      // Second pass: AI returns text after tool execution results are fed back
      const textChunk: StreamChunk = {
        type: 'text',
        content: 'It is sunny.',
      };

      mockToolRegistryService.executeTool.mockResolvedValue('Sunny');

      let callCount = 0;
      openaiProvider.streamChat.mockImplementation(async function* () {
        if (callCount === 0) {
          callCount++;
          yield toolCallChunk;
        } else {
          yield textChunk;
        }
      });

      // Need two streams if handleStreamChat calls streamChat recursively
      // But mockImplementation persists state.
      // Wait, openaiProvider.streamChat returns a generator.
      // If handleStreamChat is recursive, it calls streamChat again.
      // The mock above handles sequential calls by using closure var callCount.

      const events: any[] = [];

      service.streamChat(userId, sessionId, dto).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          try {
            expect(toolRegistry.executeTool).toHaveBeenCalledWith(
              'get_weather',
              { city: 'Beijing' },
              expect.anything(),
            );
            // It should emit text event from the second stream
            expect(events).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ data: 'It is sunny.' }),
              ]),
            );
            done();
          } catch (e) {
            done(e);
          }
        },
        error: (err) => done(err),
      });
    });
  });

  // Directly test private methods via 'any' cast if necessary or skip if complexity is too high to simulate via public API
  describe('private helper (via explicit call)', () => {
    it('getChatTime should return Date', () => {
      const result = (service as any).getChatTime();
      expect(result).toBeInstanceOf(Date);
    });
  });
});
