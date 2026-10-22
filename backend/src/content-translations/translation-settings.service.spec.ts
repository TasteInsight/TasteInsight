import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AIConfigService } from '@/ai-chat/services/ai-config.service';
import { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { PrismaService } from '@/prisma.service';
import { UpdateTranslationSettingsDto } from './dto/update-translation-settings.dto';
import { TranslationSettingsService } from './translation-settings.service';

const admin: AdminInfo = {
  id: 'global-config-admin',
  username: 'config-admin',
  role: 'admin',
  scope: 'GLOBAL',
  canteenIds: [],
  permissions: ['config:view', 'config:edit'],
};
const prefix = 'ai.translation.';

describe('TranslationSettingsService', () => {
  let service: TranslationSettingsService;
  let values: Map<string, string>;
  let environment: Record<string, string | undefined>;
  let prisma: {
    aIConfig: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let config: ConfigService;

  beforeEach(() => {
    values = new Map();
    environment = {};
    const aIConfig = {
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          [...values]
            .filter(([key]) => where.key.in.includes(key))
            .map(([key, value]) => ({ key, value })),
        ),
      ),
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(
          values.has(where.key) ? { value: values.get(where.key) } : null,
        ),
      ),
      upsert: jest.fn(({ where, create }) => {
        values.set(where.key, create.value);
        return Promise.resolve();
      }),
      deleteMany: jest.fn(({ where }) =>
        Promise.resolve(values.delete(where.key)),
      ),
    };
    prisma = {
      aIConfig,
      $transaction: jest.fn(async (run) => {
        const snapshot = new Map(values);
        try {
          return await run({
            aIConfig,
            $queryRaw: jest.fn().mockResolvedValue([]),
          });
        } catch (error) {
          values = snapshot;
          throw error;
        }
      }),
    };
    config = { get: (key: string) => environment[key] } as ConfigService;
    service = new TranslationSettingsService(
      prisma as unknown as PrismaService,
      config,
    );
  });
  const save = (settings: UpdateTranslationSettingsDto) =>
    service.updateSettings(settings, admin);

  it('starts disabled and unconfigured without using chat settings', async () => {
    environment = {
      AI_API_KEY: 'chat-secret',
      AI_MODEL: 'chat-model',
      AI_BASE_URL: 'https://chat.example/v1',
    };
    values.set('ai.api_key', 'db-chat-secret');
    values.set('ai.model', 'db-chat-model');
    await expect(service.getSettings(admin)).resolves.toEqual({
      enabled: false,
      available: false,
      model: '',
      baseUrl: '',
      apiKeyConfigured: false,
      invalidFields: [],
      managedByEnv: {
        enabled: false,
        model: false,
        baseUrl: false,
        apiKey: false,
      },
    });
    await expect(service.getProviderConfig()).rejects.toThrow('手工填写英文');
    expect(prisma.aIConfig.findMany).toHaveBeenCalledWith({
      where: {
        key: {
          in: [
            prefix + 'enabled',
            prefix + 'model',
            prefix + 'base_url',
            prefix + 'api_key',
          ],
        },
      },
      select: { key: true, value: true },
    });
  });

  it('validates enablement against the effective configuration atomically', async () => {
    await expect(save({ enabled: true })).rejects.toThrow('启用翻译辅助需配置');
    await expect(save({ apiKey: 'translation-secret' })).resolves.toMatchObject(
      { apiKeyConfigured: true, available: false },
    );
    await expect(save({ enabled: true })).rejects.toThrow('启用翻译辅助需配置');
    await expect(
      save({ enabled: true, model: 'translation-model' }),
    ).resolves.toMatchObject({ available: true });
    await expect(service.getProviderConfig()).resolves.toEqual({
      apiKey: 'translation-secret',
      model: 'translation-model',
      baseUrl: 'https://api.openai.com/v1',
    });
    await expect(save({ model: '' })).rejects.toThrow('启用翻译辅助需配置');
    expect(values.get(prefix + 'model')).toBe('translation-model');
    await expect(save({ enabled: false })).resolves.toMatchObject({
      apiKeyConfigured: true,
      available: false,
    });
  });

  it('keeps chat and translation credentials and models independent', async () => {
    values.set('ai.api_key', 'chat-secret');
    values.set('ai.model', 'chat-model');
    values.set('ai.base_url', 'https://chat.example/v1');
    const chat = new AIConfigService(
      prisma as unknown as PrismaService,
      config,
    );
    await save({
      enabled: true,
      model: 'translator',
      apiKey: 'translation-secret',
      baseUrl: 'http://localhost:12345/v1',
    });
    await expect(chat.getProviderConfig()).resolves.toEqual({
      apiKey: 'chat-secret',
      model: 'chat-model',
      baseUrl: 'https://chat.example/v1',
    });
    await expect(service.getProviderConfig()).resolves.toEqual({
      apiKey: 'translation-secret',
      model: 'translator',
      baseUrl: 'http://localhost:12345/v1',
    });
  });

  it('preserves an omitted or blank key and clears a key only for null', async () => {
    const initial = await save({
      enabled: true,
      model: 'translator',
      apiKey: 'private-key',
    });
    expect(JSON.stringify(initial)).not.toContain('private-key');
    await save({ model: 'translator-v2' });
    await save({ apiKey: '' });
    expect(values.get(prefix + 'api_key')).toBe('private-key');
    await expect(save({ apiKey: null })).rejects.toThrow('同时关闭翻译辅助');
    expect(values.get(prefix + 'api_key')).toBe('private-key');
    await expect(save({ enabled: false, apiKey: null })).resolves.toMatchObject(
      {
        apiKeyConfigured: false,
        available: false,
      },
    );
    expect(values.has(prefix + 'api_key')).toBe(false);
  });

  it('reads updates from another instance without a stale cache', async () => {
    const other = new TranslationSettingsService(
      prisma as unknown as PrismaService,
      config,
    );
    await expect(service.getStatus()).resolves.toEqual({
      enabled: false,
      available: false,
    });
    await other.updateSettings(
      { enabled: true, apiKey: 'shared-key', model: 'translator' },
      admin,
    );
    await expect(service.getStatus()).resolves.toEqual({
      enabled: true,
      available: true,
    });
    await other.updateSettings({ enabled: false, apiKey: null }, admin);
    await expect(service.getStatus()).resolves.toEqual({
      enabled: false,
      available: false,
    });
  });

  it('applies each environment field before database settings, including false', async () => {
    await save({
      enabled: true,
      model: 'db-model',
      apiKey: 'db-key',
      baseUrl: 'https://db.example/v1',
    });
    environment = {
      AI_TRANSLATION_ENABLED: 'false',
      AI_TRANSLATION_MODEL: 'env-model',
      AI_TRANSLATION_API_KEY: 'env-key',
      AI_TRANSLATION_BASE_URL: 'http://127.0.0.1:12345/v1',
    };
    await expect(service.getSettings(admin)).resolves.toEqual({
      enabled: false,
      available: false,
      model: 'env-model',
      baseUrl: 'http://127.0.0.1:12345/v1',
      apiKeyConfigured: true,
      invalidFields: [],
      managedByEnv: { enabled: true, model: true, baseUrl: true, apiKey: true },
    });
    environment.AI_TRANSLATION_ENABLED = 'true';
    await expect(service.getProviderConfig()).resolves.toEqual({
      apiKey: 'env-key',
      model: 'env-model',
      baseUrl: 'http://127.0.0.1:12345/v1',
    });
  });

  it.each([
    ['enabled', false, 'AI_TRANSLATION_ENABLED', 'false'],
    ['model', 'other', 'AI_TRANSLATION_MODEL', 'model'],
    ['baseUrl', '', 'AI_TRANSLATION_BASE_URL', 'https://provider.example/v1'],
    ['apiKey', null, 'AI_TRANSLATION_API_KEY', 'env-secret'],
  ])(
    'rejects writes to an environment-managed %s without changing other fields',
    async (field, value, envKey, envValue) => {
      environment[envKey] = envValue;
      await expect(save({ model: 'changed', [field]: value })).rejects.toThrow(
        '部署管理员',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('treats blank environment fields as unset and fails closed for invalid enablement', async () => {
    environment.AI_TRANSLATION_API_KEY = '  ';
    await save({ enabled: true, model: 'model', apiKey: 'db-key' });
    environment.AI_TRANSLATION_ENABLED = 'invalid';
    await expect(service.getStatus()).resolves.toEqual({
      enabled: false,
      available: false,
    });
    expect((await service.getSettings(admin)).managedByEnv.apiKey).toBe(false);
  });

  it.each([
    'file:///tmp/model',
    'ftp://provider.example',
    'https://user:secret@provider.example/v1',
    'https://provider.example/v1?key=secret',
    'https://provider.example/v1#secret',
    'https://provider.example/v1?',
    'not a URL',
  ])('rejects an invalid endpoint atomically: %s', async (baseUrl) => {
    await expect(save({ model: 'changed', baseUrl })).rejects.toThrow(
      'HTTP(S)',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('makes invalid environment endpoints unavailable without exposing embedded credentials', async () => {
    environment = {
      AI_TRANSLATION_ENABLED: 'true',
      AI_TRANSLATION_MODEL: 'model',
      AI_TRANSLATION_API_KEY: 'key',
      AI_TRANSLATION_BASE_URL: 'https://user:secret@provider.example/v1',
    };
    const settings = await service.getSettings(admin);
    expect(settings).toMatchObject({
      enabled: true,
      available: false,
      baseUrl: '',
      invalidFields: ['baseUrl'],
    });
    expect(JSON.stringify(settings)).not.toContain('secret');
  });

  it('rolls back a failed save and hides database errors that may contain credentials', async () => {
    await save({ model: 'original' });
    prisma.aIConfig.upsert
      .mockImplementationOnce(({ where, create }) => {
        values.set(where.key, create.value);
        return Promise.resolve();
      })
      .mockRejectedValueOnce(new Error('write failed for private-key'));
    await expect(
      save({ model: 'changed', apiKey: 'private-key' }),
    ).rejects.toThrow('翻译配置保存失败');
    expect(values.get(prefix + 'model')).toBe('original');
    expect(values.has(prefix + 'api_key')).toBe(false);
  });

  it('requires global scope even for a canteen administrator with configuration permissions', async () => {
    const canteenAdmin = { ...admin, scope: 'CANTEENS' as const };
    await expect(service.getSettings(canteenAdmin)).rejects.toThrow(
      '全局管理权限',
    );
    await expect(
      service.updateSettings({ enabled: true }, canteenAdmin),
    ).rejects.toThrow('全局管理权限');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('UpdateTranslationSettingsDto', () => {
  it.each([
    { enabled: null },
    { enabled: 'true' },
    { enabled: 'false' },
    { enabled: 1 },
    { model: null },
    { model: 123 },
    { baseUrl: null },
    { apiKey: 123 },
  ])('rejects invalid request field types: %p', async (input) => {
    expect(
      await validate(
        plainToInstance(UpdateTranslationSettingsDto, input, {
          enableImplicitConversion: true,
        }),
      ),
    ).not.toHaveLength(0);
  });
  it('trims provided string fields and accepts key deletion', async () => {
    const dto = plainToInstance(UpdateTranslationSettingsDto, {
      model: ' model ',
      baseUrl: ' ',
      apiKey: null,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toEqual({ model: 'model', baseUrl: '', apiKey: null });
    expect(
      plainToInstance(UpdateTranslationSettingsDto, { apiKey: ' ' }).apiKey,
    ).toBe('');
  });
});
