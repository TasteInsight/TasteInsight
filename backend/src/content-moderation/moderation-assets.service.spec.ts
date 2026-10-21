import { ConfigService } from '@nestjs/config';
import { ModerationAssetsService } from './moderation-assets.service';

describe('moderation assets', () => {
  const prisma = {
    contributionImage: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn(),
    },
    contentModerationAsset: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const local = { upload: jest.fn(), read: jest.fn(), remove: jest.fn() };
  let service: ModerationAssetsService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModerationAssetsService(
      prisma as never,
      new ConfigService({
        MODERATION_PUBLIC_BASE_URL: 'https://api.example.com/api/v1',
        MODERATION_MEDIA_SECRET: 'fixture-long-enough-for-valid-signatures',
      }),
      { defaultId: 'local', forId: () => local } as never,
    );
    prisma.contentModerationAsset.findUnique.mockResolvedValue({
      id: 'asset123456789012345',
      userId: 'author',
      approved: false,
      storageId: 'local',
      storageKey: '.moderation/image.png',
    });
    local.read.mockResolvedValue(Buffer.from('image'));
  });
  it('keeps staged objects private while permitting a time-limited signed preview', async () => {
    await expect(service.read('asset123456789012345')).rejects.toThrow(
      '图片尚未公开',
    );
    const url = new URL(service.preview('asset123456789012345'));
    await expect(
      service.read(
        'asset123456789012345',
        url.searchParams.get('expires')!,
        url.searchParams.get('signature')!,
      ),
    ).resolves.toMatchObject({ buffer: Buffer.from('image') });
    await expect(
      service.read(
        'asset123456789012345',
        url.searchParams.get('expires')!,
        '0'.repeat(64),
      ),
    ).rejects.toThrow('图片尚未公开');
    await expect(
      service.read(
        'asset123456789012345',
        '1000000000000',
        url.searchParams.get('signature')!,
      ),
    ).rejects.toThrow('图片尚未公开');
  });
  it('recognizes canonical persisted URLs when the configured origin uses equivalent spelling', () => {
    const normalized = new ModerationAssetsService(
      prisma as never,
      new ConfigService({
        MODERATION_PUBLIC_BASE_URL: 'https://API.EXAMPLE.COM:443/api/v1/',
        MODERATION_MEDIA_SECRET: 'fixture-long-enough-for-valid-signatures',
      }),
      { defaultId: 'local', forId: () => local } as never,
    );
    const preview = normalized.preview('asset123456789012345');
    const canonical = new URL(preview).origin + new URL(preview).pathname;
    expect(normalized.assetId(canonical)).toBe('asset123456789012345');
  });
  it('allows public access only after explicit content approval', async () => {
    prisma.contentModerationAsset.findUnique.mockResolvedValue({
      approved: true,
      storageId: 'local',
      storageKey: '.moderation/image.png',
    });
    await expect(service.read('asset123456789012345')).resolves.toBeDefined();
  });
  it.each([
    'https://other.example.com/api/v1/content-moderation/images/asset123456789012345',
    'https://api.example.com/api/v1/content-moderation/images/../private',
    'https://api.example.com/api/v1/content-moderation/images/asset/other',
  ])('does not treat arbitrary URLs as managed media: %s', (url) => {
    expect(service.assetId(url)).toBeUndefined();
  });
  it('rejects another user staging an unapproved image', async () => {
    await expect(
      service.assertImages(prisma as never, 'another-user', [
        service.preview('asset123456789012345'),
      ]),
    ).rejects.toThrow('图片不存在或暂不可使用');
  });
  it('removes the private object when its database registration fails', async () => {
    local.upload.mockResolvedValue({ filename: '.moderation/new.png' });
    local.remove.mockResolvedValue(undefined);
    prisma.contentModerationAsset.create.mockRejectedValue(
      new Error('database unavailable'),
    );
    await expect(
      service.stage({ mimetype: 'image/png' } as never, 'author'),
    ).rejects.toThrow('database unavailable');
    expect(local.remove).toHaveBeenCalledWith('.moderation/new.png');
  });
});
