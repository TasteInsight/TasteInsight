import { Test, TestingModule } from '@nestjs/testing';
import { AIConfigService } from './ai-config.service';
import { PrismaService } from '@/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('AIConfigService', () => {
  let service: AIConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIConfigService,
        {
          provide: PrismaService,
          useValue: {
            aIConfig: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'AI_API_KEY') return 'test-key';
              if (key === 'AI_MODEL') return 'gpt-4';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AIConfigService>(AIConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return provider config', async () => {
    const config = await service.getProviderConfig();

    expect(config).toHaveProperty('apiKey');
    expect(config).toHaveProperty('model');
    expect(typeof config.apiKey).toBe('string');
    expect(typeof config.model).toBe('string');
  });
});
