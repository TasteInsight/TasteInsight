import { Test, TestingModule } from '@nestjs/testing';
import { AIConfigService } from './ai-config.service';
import { PrismaService } from '@/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('AIConfigService', () => {
  let service: AIConfigService;
  let configValues: Record<string, string | undefined>;
  let findUnique: jest.Mock;

  beforeEach(async () => {
    configValues = {
      AI_PROVIDER: 'openai',
      AI_API_KEY: 'test-key',
      AI_MODEL: 'gpt-4',
    };
    findUnique = jest.fn().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIConfigService,
        {
          provide: PrismaService,
          useValue: {
            aIConfig: {
              findUnique,
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
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

  it('prefers AI_PROVIDER over the database provider', async () => {
    findUnique.mockImplementation(({ where: { key } }) =>
      Promise.resolve(key === 'ai.provider' ? { value: 'other' } : null),
    );

    await expect(service.getProviderConfig()).resolves.toMatchObject({
      apiKey: 'test-key',
      model: 'gpt-4',
    });
  });

  it('uses the database model when AI_MODEL is unset', async () => {
    configValues.AI_MODEL = '';
    findUnique.mockImplementation(({ where: { key } }) =>
      Promise.resolve(key === 'ai.model' ? { value: 'db-model' } : null),
    );

    await expect(service.getProviderConfig()).resolves.toMatchObject({
      model: 'db-model',
    });
  });

  it('rejects unsupported providers instead of silently using OpenAI', async () => {
    configValues.AI_PROVIDER = 'other';

    await expect(service.getProviderConfig()).rejects.toThrow(
      'Unsupported AI provider: other',
    );
  });
});
