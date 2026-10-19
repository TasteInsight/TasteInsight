import { ConfigService } from '@nestjs/config';
import { ModerationSettingsService } from './moderation-settings.service';

describe('moderation settings', () => {
  const prisma = {
    contentModerationSettings: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const providers = { readiness: jest.fn() };
  let config: ConfigService, service: ModerationSettingsService;
  beforeEach(() => {
    jest.clearAllMocks();
    config = new ConfigService({
      NODE_ENV: 'production',
      MODERATION_PUBLIC_BASE_URL: 'https://api.example.com/api/v1',
      MODERATION_MEDIA_SECRET: 'fixture-secret-long-enough-for-signatures',
    });
    providers.readiness.mockReturnValue({
      aliyun: {
        configured: false,
        missing: ['MODERATION_ALIYUN_ACCESS_KEY_ID'],
      },
      wechat: { configured: true, missing: [] },
    });
    prisma.contentModerationSettings.findUnique.mockResolvedValue(null);
    service = new ModerationSettingsService(
      prisma as never,
      config,
      providers as never,
    );
  });
  it('preserves legacy settings before the unified policy is enabled', async () => {
    expect(await service.policy()).toEqual({
      enabled: false,
      provider: 'aliyun',
      mode: 'machine',
    });
  });
  it('rejects unavailable credentials before writing the policy', async () => {
    await expect(
      service.update({ enabled: true, provider: 'aliyun', mode: 'machine' }),
    ).rejects.toThrow('MODERATION_ALIYUN_ACCESS_KEY_ID');
    expect(prisma.contentModerationSettings.upsert).not.toHaveBeenCalled();
  });
  it('allows manual review without cloud credentials but requires protected image configuration', async () => {
    await service.update({ enabled: true, provider: 'aliyun', mode: 'manual' });
    expect(prisma.contentModerationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { enabled: true, provider: 'aliyun', mode: 'manual' },
      }),
    );
    config.set('MODERATION_MEDIA_SECRET', 'short');
    await expect(
      service.update({ enabled: true, provider: 'aliyun', mode: 'manual' }),
    ).rejects.toThrow('MODERATION_MEDIA_SECRET');
  });
  it.each([
    'http://api.example.com',
    'https://username:password@api.example.com',
    'https://api.example.com/?key=value',
    'invalid',
  ])('rejects unsafe public bases in production: %s', async (base) => {
    config.set('MODERATION_PUBLIC_BASE_URL', base);
    await expect(
      service.update({ enabled: true, provider: 'wechat', mode: 'machine' }),
    ).rejects.toThrow('MODERATION_PUBLIC_BASE_URL');
  });
  it('returns only availability and variable names to the admin', async () => {
    expect(JSON.stringify(await service.get())).not.toContain('fixture-secret');
  });
});
