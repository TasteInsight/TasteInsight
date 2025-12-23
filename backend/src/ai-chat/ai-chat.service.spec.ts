import { Test, TestingModule } from '@nestjs/testing';
import { AIChatService } from './ai-chat.service';
import { PrismaService } from '../../src/prisma.service';
import { AIConfigService } from './services/ai-config.service';
import { OpenAIProviderService } from './services/ai-provider/openai-provider.service';
import { ToolRegistryService } from './tools/tool-registry.service';

describe('AIChatService', () => {
  let service: AIChatService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIChatService,
        {
          provide: PrismaService,
          useValue: {
            aISession: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            aIMessage: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            canteen: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AIConfigService,
          useValue: {
            getProviderConfig: jest.fn(),
          },
        },
        {
          provide: OpenAIProviderService,
          useValue: {
            setConfig: jest.fn(),
            streamChat: jest.fn(),
          },
        },
        {
          provide: ToolRegistryService,
          useValue: {
            getAllTools: jest.fn().mockReturnValue([]),
            executeTool: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AIChatService>(AIChatService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a new session with default scene', async () => {
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        scene: 'general_chat',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.aISession, 'create').mockResolvedValue(mockSession);

      const result = await service.createSession('user123', {});

      expect(result).toHaveProperty('sessionId', 'session123');
      expect(result).toHaveProperty('welcomeMessage');
      expect(prisma.aISession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          scene: 'general_chat',
        },
      });
    });

    it('should create session with specified scene', async () => {
      const mockSession = {
        id: 'session456',
        userId: 'user123',
        scene: 'meal_planner',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.aISession, 'create').mockResolvedValue(mockSession);

      const result = await service.createSession('user123', {
        scene: 'meal_planner',
      });

      expect(result.sessionId).toBe('session456');
      expect(result.welcomeMessage).toContain('膳食规划');
    });
  });

  describe('getSuggestions', () => {
    it('should return time-based suggestions', async () => {
      jest.spyOn(prisma.canteen, 'findMany').mockResolvedValue([
        {
          id: 'canteen1',
          name: '第一食堂',
          position: 'test',
          description: null,
          images: [],
          openingHours: [],
          averageRating: 0,
          reviewCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const suggestions = await service.getSuggestions('user123');

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => /早餐|午餐|晚餐|夜宵/.test(s))).toBe(true);
    });

    it('should include canteen-specific suggestions', async () => {
      jest.spyOn(prisma.canteen, 'findMany').mockResolvedValue([
        {
          id: 'canteen1',
          name: '学生食堂',
          position: 'test',
          description: null,
          images: [],
          openingHours: [],
          averageRating: 0,
          reviewCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const suggestions = await service.getSuggestions('user123');

      expect(suggestions.some((s) => s.includes('学生食堂'))).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return chat history for valid session', async () => {
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        scene: 'general_chat',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMessages = [
        {
          id: 'msg1',
          sessionId: 'session123',
          role: 'user',
          content: [{ type: 'text', data: 'Hello' }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'msg2',
          sessionId: 'session123',
          role: 'assistant',
          content: [{ type: 'text', data: 'Hi!' }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(prisma.aISession, 'findFirst').mockResolvedValue(mockSession);
      jest.spyOn(prisma.aIMessage, 'findMany').mockResolvedValue(mockMessages);

      const result = await service.getHistory('user123', 'session123');

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
    });

    it('should throw error for non-existent session', async () => {
      jest.spyOn(prisma.aISession, 'findFirst').mockResolvedValue(null);

      await expect(
        service.getHistory('user123', 'invalid-session'),
      ).rejects.toThrow('Session not found');
    });

    it('should support cursor-based pagination', async () => {
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        scene: 'general_chat',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create 51 messages to test pagination
      const mockMessages = Array.from({ length: 51 }, (_, i) => ({
        id: `msg${i}`,
        sessionId: 'session123',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', data: `Message ${i}` }],
        createdAt: new Date(Date.now() - i * 1000),
        updatedAt: new Date(),
      }));

      jest.spyOn(prisma.aISession, 'findFirst').mockResolvedValue(mockSession);
      jest.spyOn(prisma.aIMessage, 'findMany').mockResolvedValue(mockMessages);

      const result = await service.getHistory('user123', 'session123');

      expect(result.messages).toHaveLength(50);
      expect(result).toHaveProperty('cursor');
    });
  });
});
