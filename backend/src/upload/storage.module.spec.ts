import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import { ModerationAssetsService } from '@/content-moderation/moderation-assets.service';
import { UploadModule } from './upload.module';
import { UploadService } from './upload.service';
import { ContributionImageCleanup } from './contribution-image-cleanup.service';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';
import { STORAGE_STRATEGY } from './strategies/storage.strategy';

describe.each(['local', 'oss', 's3'])('%s storage lifecycle', (storageType) => {
  let module: TestingModule;
  let upload: UploadService;
  let assets: ModerationAssetsService;
  const key = `${storageType === 'local' ? '.moderation' : 'moderation-private'}/00000000-0000-4000-8000-000000000000.png`;
  const stores = [
    LocalStorageStrategy,
    OssStorageStrategy,
    S3StorageStrategy,
  ].map((provider) => ({
    provider,
    upload: jest.fn(),
    read: jest.fn(),
    remove: jest.fn(),
  }));
  const selected = stores[['local', 'oss', 's3'].indexOf(storageType)];
  const prisma = {
    studentVerification: { findUnique: jest.fn() },
    contributionImage: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    contentModerationSettings: { findUnique: jest.fn() },
    contentModerationAsset: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const imageFile = async () => {
    const buffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    return {
      buffer,
      size: buffer.length,
      originalname: 'untrusted.txt',
      mimetype: 'text/plain',
    } as Express.Multer.File;
  };
  const asset = {
    id: 'asset123456789012345',
    userId: 'student',
    approved: false,
    storageType,
    storageKey: key,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    selected.upload.mockImplementation((_file, privateFile) =>
      Promise.resolve({
        filename: privateFile
          ? key
          : 'images/00000000-0000-4000-8000-000000000000.png',
        url: 'https://objects.example.test/image.png',
      }),
    );
    selected.read.mockResolvedValue(Buffer.from('stored-image'));
    selected.remove.mockResolvedValue(undefined);
    prisma.studentVerification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
      expiresAt: new Date(Date.now() + 86400000),
    });
    prisma.contentModerationSettings.findUnique.mockResolvedValue(null);
    prisma.contentModerationAsset.create.mockResolvedValue(asset);
    prisma.contentModerationAsset.findUnique.mockResolvedValue(asset);
    prisma.contributionImage.create.mockResolvedValue({});
    prisma.contributionImage.findMany.mockResolvedValue([]);
    prisma.contributionImage.updateMany.mockResolvedValue({ count: 1 });
    const builder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              UPLOAD_STORAGE_TYPE: storageType,
              MODERATION_PUBLIC_BASE_URL: 'https://api.example.test/api/v1',
              MODERATION_MEDIA_SECRET:
                'fixture-signing-secret-at-least-32-bytes',
            }),
          ],
        }),
        PrismaModule,
        UploadModule,
      ],
      providers: [ContributionImageCleanup],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma);
    for (const store of stores)
      builder.overrideProvider(store.provider).useValue(store);
    module = await builder.compile();
    upload = module.get(UploadService);
    assets = module.get(ModerationAssetsService);
  });
  afterEach(async () => {
    await module.close();
  });

  it('shares one selected adapter across uploads and moderation', async () => {
    expect(module.get(STORAGE_STRATEGY)).toBe(selected);
    const response = await upload.uploadFile(
      await imageFile(),
      'student',
      'student',
    );
    expect(selected.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        originalname: 'image.png',
        mimetype: 'image/png',
      }),
    );
    expect(prisma.contributionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storageType,
        storageKey: response.data.filename,
      }),
    });
    for (const other of stores.filter((store) => store !== selected))
      expect(other.upload).not.toHaveBeenCalled();
    const now = new Date();
    prisma.contributionImage.findMany.mockResolvedValue([
      { id: 'expired', storageType, storageKey: response.data.filename },
    ]);
    selected.remove.mockRejectedValueOnce(
      new Error('temporary storage failure'),
    );
    const cleanup = module.get(ContributionImageCleanup);
    await cleanup.tick(now);
    expect(prisma.contributionImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storageType }),
      }),
    );
    expect(prisma.contributionImage.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { expiresAt: new Date(now.getTime() + 300000) },
      }),
    );
    await cleanup.tick(new Date(now.getTime() + 300001));
    expect(selected.remove).toHaveBeenCalledTimes(2);
    expect(selected.remove).toHaveBeenLastCalledWith(response.data.filename);
    expect(prisma.contributionImage.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { expiresAt: null } }),
    );
  });

  it('stores private moderation media, serves signed previews, and publishes after approval', async () => {
    prisma.contentModerationSettings.findUnique.mockResolvedValue({
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
    });
    const response = await upload.uploadFile(
      await imageFile(),
      'student',
      'student',
    );
    expect(selected.upload).toHaveBeenCalledWith(expect.anything(), true);
    expect(response.data.url).toContain('/content-moderation/images/');
    expect(response.data.url).not.toContain('objects.example.test');
    expect(prisma.contentModerationAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ storageType, storageKey: key }),
    });
    await expect(assets.read(asset.id)).rejects.toThrow('图片尚未公开');
    expect(selected.read).not.toHaveBeenCalled();
    const url = new URL(response.data.url);
    await expect(
      assets.read(
        asset.id,
        url.searchParams.get('expires')!,
        url.searchParams.get('signature')!,
      ),
    ).resolves.toMatchObject({ buffer: Buffer.from('stored-image') });
    expect(selected.read).toHaveBeenCalledWith(key);
    await assets.approve(prisma as never, [response.data.url]);
    expect(prisma.contentModerationAsset.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [asset.id] } },
      data: { approved: true },
    });
    prisma.contentModerationAsset.findUnique.mockResolvedValue({
      ...asset,
      approved: true,
    });
    await expect(assets.read(asset.id)).resolves.toBeDefined();
    await upload.removeContributionImage(storageType, key);
    expect(selected.remove).toHaveBeenCalledWith(key);
  });

  it('removes private bytes when moderation registration fails', async () => {
    prisma.contentModerationAsset.create.mockRejectedValue(
      new Error('registration failed'),
    );
    await expect(assets.stage(await imageFile(), 'student')).rejects.toThrow(
      'registration failed',
    );
    expect(selected.remove).toHaveBeenCalledWith(key);
  });

  it.each([false, true])(
    'rolls back contribution registration with moderation enabled: %s',
    async (enabled) => {
      prisma.contentModerationSettings.findUnique.mockResolvedValue({
        enabled,
        provider: 'aliyun',
        mode: 'manual',
      });
      prisma.contributionImage.create.mockRejectedValue(
        new Error('contribution registration failed'),
      );
      await expect(
        upload.uploadFile(await imageFile(), 'student', 'student'),
      ).rejects.toThrow('contribution registration failed');
      expect(selected.remove).toHaveBeenCalledWith(
        enabled ? key : 'images/00000000-0000-4000-8000-000000000000.png',
      );
    },
  );

  it('refuses to read or delete an object belonging to another configured store', async () => {
    const otherStorage = storageType === 's3' ? 'oss' : 's3';
    prisma.contentModerationAsset.findUnique.mockResolvedValue({
      ...asset,
      approved: true,
      storageType: otherStorage,
    });
    await expect(assets.read(asset.id)).rejects.toThrow(
      'Image storage configuration changed',
    );
    await expect(
      upload.removeContributionImage(otherStorage, key),
    ).rejects.toThrow('Image storage configuration changed');
    expect(selected.read).not.toHaveBeenCalled();
    expect(selected.remove).not.toHaveBeenCalled();
  });
});
