import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import sharp from 'sharp';
import { PrismaService } from '@/prisma.service';
import { ModerationAssetsService } from '@/content-moderation/moderation-assets.service';
import { ModerationPublicController } from '@/content-moderation/moderation-public.controller';
import { ModerationWorkerService } from '@/content-moderation/moderation-worker.service';
import { WechatModerationCallbackService } from '@/content-moderation/wechat-callback.service';
import { ContributionImageCleanup } from '@/upload/contribution-image-cleanup.service';
import { StorageService } from '@/upload/storage.service';
import { UploadService } from '@/upload/upload.service';

describe('storage instances (PostgreSQL + filesystem + HTTP)', () => {
  const userId = `storage-${randomUUID()}`;
  const apps: INestApplication[] = [];
  const db = new PrismaService();
  let directory: string;
  let file: Express.Multer.File;
  let legacy: string;

  const open = async (defaultId: string) => {
    const config = new ConfigService({
      NODE_ENV: 'test',
      UPLOAD_DEFAULT_STORAGE_ID: defaultId,
      UPLOAD_LOCAL_PATH: join(directory, 'legacy'),
      UPLOAD_STORAGE_INSTANCES: JSON.stringify({
        'disk-a': {
          type: 'local',
          path: join(directory, 'a'),
          publicBaseUrl: 'https://a.example.test/images',
        },
        'disk-b': {
          type: 'local',
          path: join(directory, 'b'),
          publicBaseUrl: 'https://b.example.test/images',
        },
      }),
      MODERATION_PUBLIC_BASE_URL: 'http://localhost',
      MODERATION_MEDIA_SECRET: 'storage-instances-fixture-signing-secret',
    });
    const module = await Test.createTestingModule({
      controllers: [ModerationPublicController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: db },
        { provide: WechatModerationCallbackService, useValue: {} },
        { provide: ModerationWorkerService, useValue: {} },
        StorageService,
        ModerationAssetsService,
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    apps.push(app);
    return {
      app,
      config,
      storage: app.get(StorageService),
      assets: app.get(ModerationAssetsService),
    };
  };
  const getImage = (app: INestApplication, url: string) => {
    const parsed = new URL(url);
    return request(app.getHttpServer()).get(parsed.pathname + parsed.search);
  };

  beforeAll(async () => {
    directory = await mkdtemp(
      join(tmpdir(), 'tasteinsight-storage-instances-'),
    );
    await db.$connect();
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#345678' },
    })
      .png()
      .toBuffer();
    file = {
      buffer,
      size: buffer.length,
      originalname: 'image.png',
      mimetype: 'image/png',
    } as Express.Multer.File;
  });
  afterAll(async () => {
    await db.contentModerationAsset.deleteMany({ where: { userId } });
    await db.contributionImage.deleteMany({ where: { userId } });
    for (const app of apps) await app.close();
    await db.$disconnect();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('reads old and new instances through signed HTTP after changing the write default', async () => {
    const first = await open('disk-a');
    const a = await first.assets.stage(file, userId);
    const original = await db.contentModerationAsset.findFirstOrThrow({
      where: { userId, storageId: 'disk-a' },
    });
    const second = await open('disk-b');
    const b = await second.assets.stage(file, userId);
    const current = await db.contentModerationAsset.findFirstOrThrow({
      where: { userId, storageId: 'disk-b' },
    });
    expect(await readFile(join(directory, 'a', a.filename))).toEqual(
      file.buffer,
    );
    expect(await readFile(join(directory, 'b', b.filename))).toEqual(
      file.buffer,
    );
    expect((await getImage(second.app, a.url).expect(200)).body).toEqual(
      file.buffer,
    );
    expect((await getImage(second.app, b.url).expect(200)).body).toEqual(
      file.buffer,
    );
    await getImage(
      second.app,
      new URL(a.url).origin + new URL(a.url).pathname,
    ).expect(404);
    await db.contentModerationAsset.update({
      where: { id: original.id },
      data: { approved: true },
    });
    expect(
      (
        await getImage(
          second.app,
          new URL(a.url).origin + new URL(a.url).pathname,
        ).expect(200)
      ).body,
    ).toEqual(file.buffer);
    expect(
      await db.$queryRaw`SELECT "storageType" FROM content_moderation_assets WHERE id = ${current.id}`,
    ).toEqual([{ storageType: 'disk-b' }]);
  });

  it('reads legacy storageType records and maps both existing database columns', async () => {
    const { app, assets, storage } = await open('disk-b');
    const image = await storage.forId('local').upload(file, true);
    legacy = randomUUID();
    await db.$executeRaw`INSERT INTO content_moderation_assets (id, "userId", "storageType", "storageKey", "mimeType") VALUES (${legacy}, ${userId}, 'local', ${image.filename}, 'image/png')`;
    await db.$executeRaw`INSERT INTO contribution_images (id, "userId", url, "storageType", "storageKey", "expiresAt") VALUES (${randomUUID()}, ${userId}, ${`https://legacy.example.test/${legacy}`}, 'local', ${image.filename}, CURRENT_TIMESTAMP - INTERVAL '1 day')`;
    expect(
      (
        await db.contentModerationAsset.findUniqueOrThrow({
          where: { id: legacy },
        })
      ).storageId,
    ).toBe('local');
    expect(
      (await getImage(app, assets.preview(legacy)).expect(200)).body,
    ).toEqual(file.buffer);
    const ledger = await db.contributionImage.findFirstOrThrow({
      where: { userId, storageId: 'local' },
    });
    await db.contributionImage.update({
      where: { id: ledger.id },
      data: { storageId: 'disk-b' },
    });
    expect(
      await db.$queryRaw`SELECT "storageType" FROM contribution_images WHERE id = ${ledger.id}`,
    ).toEqual([{ storageType: 'disk-b' }]);
    await db.contributionImage.update({
      where: { id: ledger.id },
      data: { storageId: 'local' },
    });
  });

  it('cleans expired files across all configured instances using their persisted IDs', async () => {
    const { storage, config } = await open('disk-b');
    const assets = await db.contentModerationAsset.findMany({
      where: { userId, storageId: { in: ['disk-a', 'disk-b'] } },
    });
    for (const asset of assets)
      await db.contributionImage.create({
        data: {
          userId,
          url: `https://cleanup.example.test/${asset.id}`,
          storageId: asset.storageId,
          storageKey: asset.storageKey,
          expiresAt: new Date(0),
        },
      });
    const upload = new UploadService(storage, db);
    const cleanup = new ContributionImageCleanup(db, upload, config);
    await cleanup.tick();
    const rows = await db.contributionImage.findMany({ where: { userId } });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.deletedAt && row.expiresAt === null)).toBe(
      true,
    );
    for (const asset of await db.contentModerationAsset.findMany({
      where: { userId },
    }))
      await expect(
        storage.forId(asset.storageId).read(asset.storageKey),
      ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
