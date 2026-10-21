import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import { ModerationAssetsService } from '@/content-moderation/moderation-assets.service';
import { UploadModule } from './upload.module';
import { UploadService } from './upload.service';
import { ContributionImageCleanup } from './contribution-image-cleanup.service';
import { StorageStrategy } from './strategies/storage.strategy';
import { StorageService } from './storage.service';

describe.each(['local', 's3', 'aws-main', 'cos-cn'])(
  '%s storage lifecycle',
  (storageId) => {
    let module: TestingModule;
    let upload: UploadService;
    let assets: ModerationAssetsService;
    const key = `${storageId === 'local' ? '.moderation' : 'moderation-private'}/00000000-0000-4000-8000-000000000000.png`;
    const spyStore = (id: string, adapter: StorageStrategy) => ({
      id,
      adapter,
      upload: jest.spyOn(adapter, 'upload'),
      read: jest.spyOn(adapter, 'read'),
      remove: jest.spyOn(adapter, 'remove'),
    });
    let stores: ReturnType<typeof spyStore>[];
    let selected: ReturnType<typeof spyStore>;
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
      storageId,
      storageKey: key,
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      const cloud = {
        type: 's3',
        endpoint: 'https://cos.ap-guangzhou.myqcloud.com',
        region: 'ap-guangzhou',
        bucket: 'photos-1250000000',
        accessKeyId: 'fixture-key',
        secretAccessKey: 'fixture-secret',
      };
      module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            ignoreEnvVars: true,
            load: [
              () => ({
                NODE_ENV: 'test',
                UPLOAD_DEFAULT_STORAGE_ID: storageId,
                S3_ENDPOINT: cloud.endpoint,
                S3_REGION: cloud.region,
                S3_BUCKET: cloud.bucket,
                S3_ACCESS_KEY_ID: cloud.accessKeyId,
                S3_SECRET_ACCESS_KEY: cloud.secretAccessKey,
                UPLOAD_STORAGE_INSTANCES: JSON.stringify({
                  'aws-main': { ...cloud, bucket: 'aws-photos' },
                  'cos-cn': cloud,
                }),
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
        .useValue(prisma)
        .compile();
      const storage = module.get(StorageService);
      stores = storage.ids.map((id) => spyStore(id, storage.forId(id)));
      selected = stores.find((store) => store.id === storageId)!;
      selected.upload.mockImplementation((_file, privateFile) =>
        Promise.resolve({
          filename: privateFile
            ? key
            : 'images/00000000-0000-4000-8000-000000000000.png',
          url: 'https://objects.example.test/image.png',
        }),
      );
      selected.read.mockResolvedValue(Buffer.from('stored-image'));
      for (const store of stores) store.remove.mockResolvedValue(undefined);
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
      upload = module.get(UploadService);
      assets = module.get(ModerationAssetsService);
    });
    afterEach(async () => {
      await module.close();
      jest.restoreAllMocks();
    });

    it('shares one selected adapter across uploads and moderation', async () => {
      expect(module.get(StorageService).forId()).toBe(selected.adapter);
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
          storageId,
          storageKey: response.data.filename,
        }),
      });
      for (const other of stores.filter((store) => store !== selected))
        expect(other.upload).not.toHaveBeenCalled();
      const now = new Date();
      prisma.contributionImage.findMany.mockResolvedValue([
        { id: 'expired', storageId, storageKey: response.data.filename },
      ]);
      selected.remove.mockRejectedValueOnce(
        new Error('temporary storage failure'),
      );
      const cleanup = module.get(ContributionImageCleanup);
      await cleanup.tick(now);
      expect(prisma.contributionImage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storageId: { in: stores.map((store) => store.id) },
          }),
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
        data: expect.objectContaining({ storageId, storageKey: key }),
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
      await upload.removeContributionImage(storageId, key);
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

    it.each([false, true])(
      'reads historical local images after changing the upload store (approved: %s)',
      async (approved) => {
        const historicalKey =
          '.moderation/00000000-0000-4000-8000-000000000000.png';
        prisma.contentModerationAsset.findUnique.mockResolvedValue({
          ...asset,
          approved,
          storageId: 'local',
          storageKey: historicalKey,
        });
        stores[0].read.mockResolvedValue(Buffer.from('historical-local-image'));
        const signed = new URL(assets.preview(asset.id));
        await expect(
          assets.read(
            asset.id,
            approved ? undefined : signed.searchParams.get('expires')!,
            approved ? undefined : signed.searchParams.get('signature')!,
          ),
        ).resolves.toMatchObject({
          buffer: Buffer.from('historical-local-image'),
        });
        expect(stores[0].read).toHaveBeenCalledWith(historicalKey);
        for (const other of stores.slice(1))
          expect(other.read).not.toHaveBeenCalled();
      },
    );

    it.each(['s3', 'aws-main', 'cos-cn'])(
      'reads the recorded %s backend independently of the new upload default',
      async (recordedType) => {
        const recorded = stores.find((store) => store.id === recordedType)!;
        const storageKey =
          'moderation-private/00000000-0000-4000-8000-000000000000.png';
        prisma.contentModerationAsset.findUnique.mockResolvedValue({
          ...asset,
          approved: true,
          storageId: recordedType,
          storageKey,
        });
        recorded.read.mockResolvedValue(Buffer.from('historical-cloud-image'));
        await expect(assets.read(asset.id)).resolves.toMatchObject({
          buffer: Buffer.from('historical-cloud-image'),
        });
        expect(recorded.read).toHaveBeenCalledWith(storageKey);
        for (const other of stores.filter((store) => store !== recorded))
          expect(other.read).not.toHaveBeenCalled();
      },
    );

    it('cleans expired objects across configured instances and rejects removed IDs', async () => {
      const other = stores.find(
        (store) => store.id !== storageId && store.id !== 'local',
      )!;
      const sharedKey =
        'moderation-private/00000000-0000-4000-8000-000000000000.png';
      prisma.contributionImage.findMany.mockResolvedValue([
        { id: 'a', storageId, storageKey: key },
        { id: 'b', storageId: other.id, storageKey: sharedKey },
      ]);
      await module.get(ContributionImageCleanup).tick();
      expect(selected.remove).toHaveBeenCalledWith(key);
      expect(other.remove).toHaveBeenCalledWith(sharedKey);
      await expect(
        upload.removeContributionImage('removed-instance', key),
      ).rejects.toThrow('not configured');
      prisma.contentModerationAsset.findUnique.mockResolvedValue({
        ...asset,
        approved: true,
        storageId: 'unknown',
      });
      await expect(assets.read(asset.id)).rejects.toThrow('not configured');
    });
  },
);
