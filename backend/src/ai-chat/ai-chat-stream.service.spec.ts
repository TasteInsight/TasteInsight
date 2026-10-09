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
  completeChat: jest.fn().mockResolvedValue('{"suggestions":[]}'),
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
            expect(events).toEqual([
              { type: 'message_received', data: { messageId: 'msg1' } },
              { type: 'text_chunk', data: 'Hello' },
              { type: 'text_chunk', data: ' World' },
              { type: 'reply_complete', data: { messageId: 'msg1' } },
            ]);
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

    it('should not expose internal database errors to the stream client', (done) => {
      prisma.aISession.findFirst.mockRejectedValue(
        new Error('postgresql://db-user:db-password@internal-host/database'),
      );

      const events: any[] = [];
      service.streamChat(userId, sessionId, dto).subscribe({
        next: (event) => events.push(event),
        complete: () => {
          try {
            expect(events).toEqual([
              {
                type: 'error',
                data: { error: '抱歉，我现在无法处理您的请求，请稍后再试。' },
              },
            ]);
            expect(JSON.stringify(events)).not.toContain('db-password');
            expect(JSON.stringify(events)).not.toContain('internal-host');
            done();
          } catch (error) {
            done(error);
          }
        },
        error: done,
      });
    });
  });

  describe('message receipt', () => {
    const collectEvents = () => {
      const events: any[] = [];
      const complete = new Promise<void>((resolve, reject) => {
        service.streamChat('u1', 's1', { message: 'Hello' }).subscribe({
          next: (event) => events.push(event),
          complete: resolve,
          error: reject,
        });
      });
      return { events, complete };
    };

    beforeEach(() => {
      prisma.aISession.findFirst.mockResolvedValue({
        id: 's1', userId: 'u1', scene: 'general_chat', messages: [],
      });
      prisma.aIMessage.create.mockResolvedValue({ id: 'user-message' });
      mockPromptSecurityService.validateUserInput.mockReturnValue({
        isValid: true, sanitized: 'Hello',
      });
      openaiProvider.streamChat.mockReturnValue(createAsyncGenerator([]));
    });

    it('acknowledges only after user persistence and before provider work', async () => {
      let finishSaving!: (message: { id: string }) => void;
      let startedSaving!: () => void;
      const saveStarted = new Promise<void>((resolve) => { startedSaving = resolve; });
      prisma.aIMessage.create.mockImplementationOnce(() => {
        startedSaving();
        return new Promise((resolve) => { finishSaving = resolve; });
      });
      const { events, complete } = collectEvents();
      await saveStarted;

      expect(events).toEqual([]);
      expect(mockAIConfigService.getProviderConfig).not.toHaveBeenCalled();
      expect(openaiProvider.streamChat).not.toHaveBeenCalled();
      openaiProvider.streamChat.mockImplementationOnce(() => {
        expect(events).toEqual([
          { type: 'message_received', data: { messageId: 'persisted-user' } },
        ]);
        return createAsyncGenerator([{ type: 'text', content: 'Reply' }]);
      });

      finishSaving({ id: 'persisted-user' });
      await complete;
      expect(events).toEqual([
        { type: 'message_received', data: { messageId: 'persisted-user' } },
        { type: 'text_chunk', data: 'Reply' },
        { type: 'reply_complete', data: { messageId: 'user-message' } },
      ]);
    });

    it.each(['session', 'input', 'database'])('does not acknowledge a rejected %s', async (failure) => {
      if (failure === 'session') prisma.aISession.findFirst.mockResolvedValueOnce(null);
      if (failure === 'input') {
        mockPromptSecurityService.validateUserInput.mockReturnValueOnce({
          isValid: false, sanitized: '',
        });
      }
      if (failure === 'database') {
        prisma.aIMessage.create.mockRejectedValueOnce(new Error('save failed'));
      }

      const { events, complete } = collectEvents();
      await complete;
      expect(events.map((event) => event.type)).toEqual(['error']);
      expect(openaiProvider.streamChat).not.toHaveBeenCalled();
    });

    it('retains the receipt when the provider fails before a reply', async () => {
      openaiProvider.streamChat.mockReturnValueOnce(createAsyncGenerator([
        { type: 'error', error: 'provider unavailable' },
      ]));

      const { events, complete } = collectEvents();
      await complete;
      expect(events).toEqual([
        { type: 'message_received', data: { messageId: 'user-message' } },
        { type: 'error', data: { error: '抱歉，我现在无法处理您的请求，请稍后再试。' } },
      ]);
      expect(prisma.aIMessage.create).toHaveBeenCalledTimes(1);
    });

    it('acknowledges persistence even when loading provider configuration fails', async () => {
      mockAIConfigService.getProviderConfig.mockRejectedValueOnce(new Error('configuration unavailable'));

      const { events, complete } = collectEvents();
      await complete;
      expect(events.map((event) => event.type)).toEqual(['message_received', 'error']);
      expect(openaiProvider.streamChat).not.toHaveBeenCalled();
    });

    it('retains the receipt when saving the assistant fails', async () => {
      prisma.aIMessage.create
        .mockResolvedValueOnce({ id: 'user-message' })
        .mockRejectedValueOnce(new Error('assistant save failed'));

      const { events, complete } = collectEvents();
      await complete;
      expect(events.map((event) => event.type)).toEqual(['message_received', 'error']);
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
