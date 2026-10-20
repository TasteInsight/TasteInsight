import { PublicFilesModule } from '@/runtime/public-files.module';
import WechatCrypto from 'wechat-crypto';
import * as bodyParser from 'body-parser';
import { AdminUploadsModule } from '@/admin-uploads/admin-uploads.module';
import { AdminUploadsService } from '@/admin-uploads/admin-uploads.service';
import { randomUUID } from 'crypto';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import request from 'supertest';
import sharp from 'sharp';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import { AuthModule } from '@/auth/auth.module';
import { ReviewsModule } from '@/reviews/reviews.module';
import { ReviewsService } from '@/reviews/reviews.service';
import { CommentsModule } from '@/comments/comments.module';
import { CommentsService } from '@/comments/comments.service';
import { SocialModule } from '@/social/social.module';
import { SocialService } from '@/social/social.service';
import { UserProfileModule } from '@/user-profile/user-profile.module';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { UploadModule } from '@/upload/upload.module';
import { UploadService } from '@/upload/upload.service';
import { ModerationProcessingModule } from '@/content-moderation/moderation-processing.module';
import { ModerationAdminController } from '@/content-moderation/moderation-admin.controller';
import { ModerationPublicController } from '@/content-moderation/moderation-public.controller';
import { ModerationProviderService } from '@/content-moderation/providers/moderation-provider.service';
import { ModerationWorkerService } from '@/content-moderation/moderation-worker.service';
import { ModerationSettingsService } from '@/content-moderation/moderation-settings.service';
import { ModerationAssetsService } from '@/content-moderation/moderation-assets.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import { DishesService } from '@/dishes/dishes.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PrismaModule,
    PublicFilesModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', '127.0.0.1'),
          port: Number(config.get('REDIS_PORT', 6379)),
          password: config.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    AuthModule,
    AdminUploadsModule,
    ReviewsModule,
    CommentsModule,
    SocialModule,
    UserProfileModule,
    UploadModule,
    ModerationProcessingModule,
  ],
  controllers: [ModerationAdminController, ModerationPublicController],
  providers: [DishesService],
})
class AcceptanceModule {}

describe('unified content moderation (PostgreSQL + HTTP)', () => {
  const prefix = `moderation-${randomUUID()}`;
  let app: INestApplication;
  let db: PrismaService;
  let previousSettings: Awaited<
    ReturnType<PrismaService['contentModerationSettings']['findUnique']>
  >;
  let worker: ModerationWorkerService;
  let settings: ModerationSettingsService;
  let social: SocialService;
  let userId: string,
    otherId: string,
    dishId: string,
    adminToken: string,
    scopedToken: string,
    readOnlyToken: string;
  const providers = {
    readiness: jest.fn(() => ({
      aliyun: { configured: true, missing: [] },
      wechat: { configured: true, missing: [] },
    })),
    checkText: jest.fn(),
    checkImage: jest.fn(),
  };
  beforeAll(async () => {
    if (
      process.env.NODE_ENV !== 'test' ||
      !new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test')
    )
      throw new Error('Use the isolated moderation_test database');
    const module = await Test.createTestingModule({
      imports: [AcceptanceModule],
    })
      .overrideProvider(ModerationProviderService)
      .useValue(providers)
      .compile();
    app = module.createNestApplication();
    app.use(
      '/content-moderation/wechat/callback',
      bodyParser.text({ type: ['text/xml', 'application/xml'], limit: '1mb' }),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    app
      .get(ConfigService)
      .set('MODERATION_PUBLIC_BASE_URL', await app.getUrl());
    app
      .get(ConfigService)
      .set(
        'MODERATION_MEDIA_SECRET',
        'moderation-local-test-signature-secret-32',
      );
    app
      .get(ConfigService)
      .set('UPLOAD_LOCAL_PATH', '/private/tmp/tasteinsight-moderation-uploads');
    db = app.get(PrismaService);
    previousSettings = await db.contentModerationSettings.findUnique({
      where: { id: 'global' },
    });
    worker = app.get(ModerationWorkerService);
    settings = app.get(ModerationSettingsService);
    social = app.get(SocialService);
    await app.get(AdminConfigService).syncConfigTemplates();
  });
  beforeAll(async () => {
    const user = async (nickname: string) =>
      db.user.create({
        data: {
          nickname,
          studentVerification: {
            create: {
              method: 'MANUAL_REVIEW',
              status: 'VERIFIED',
              expiresAt: new Date(Date.now() + 86400000),
            },
          },
        },
      });
    userId = (await user('审核作者')).id;
    otherId = (await user('回复作者')).id;
    const canteen = await db.canteen.create({
      data: { name: '审核食堂', images: [], openingHours: [] },
    });
    dishId = (
      await db.dish.create({
        data: {
          name: '米饭',
          price: 2,
          tags: [],
          images: [],
          ingredients: [],
          allergens: [],
          canteenId: canteen.id,
          canteenName: canteen.name,
          windowName: '一号窗口',
          availableMealTime: [],
        },
      })
    ).id;
    const token = async (
      scope: 'GLOBAL' | 'CANTEENS',
      role: string,
      permissions: string[],
    ) => {
      const admin = await db.admin.create({
        data: {
          username: `${prefix}-${scope}-${role}`,
          password: 'fixture',
          scope,
          role,
          permissions: {
            create: permissions.map((permission) => ({ permission })),
          },
        },
      });
      return new JwtService().sign(
        { sub: admin.id, type: 'admin', sessionVersion: 0, tokenUse: 'access' },
        { secret: process.env.JWT_SECRET },
      );
    };
    adminToken = await token('GLOBAL', 'superadmin', []);
    scopedToken = await token('CANTEENS', 'admin', [
      'config:view',
      'config:edit',
    ]);
    readOnlyToken = await token('GLOBAL', 'admin', ['config:view']);
  });
  beforeEach(async () => {
    providers.checkText.mockReset().mockResolvedValue({ decision: 'pass' });
    providers.checkImage.mockReset().mockResolvedValue({ decision: 'pass' });
    await db.contentModerationTask.deleteMany({
      where: { userId: { in: [userId, otherId] } },
    });
    await db.contentModerationReceipt.deleteMany({
      where: { traceId: { startsWith: prefix } },
    });
    await db.contentModerationSettings.upsert({
      where: { id: 'global' },
      create: { enabled: true, provider: 'aliyun', mode: 'machine' },
      update: { enabled: true, provider: 'aliyun', mode: 'machine' },
    });
  });
  afterAll(async () => {
    if (db) {
      if (previousSettings)
        await db.contentModerationSettings.upsert({
          where: { id: 'global' },
          create: previousSettings,
          update: previousSettings,
        });
      else
        await db.contentModerationSettings.deleteMany({
          where: { id: 'global' },
        });
    }
    await app?.close();
  });
  const next = async (targetId: string) =>
    db.contentModerationTask.findFirstOrThrow({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
    });
  const createPost = async (text = '今日菜品不错', images: string[] = []) =>
    (await social.createPost(userId, { content: text, images })).data as {
      id: string;
      status: string;
      updatedAt: string;
    };
  const decide = (id: string, approved = true) =>
    request(app.getHttpServer())
      .post(`/admin/content-moderation/tasks/${id}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved, ...(!approved ? { reason: '内容需要修改' } : {}) });

  it('enforces global admin permissions and validates atomic settings without exposing secrets', async () => {
    await request(app.getHttpServer())
      .get('/admin/content-moderation/settings')
      .expect(401);
    const scopedPolicy = await request(app.getHttpServer())
      .get('/admin/content-moderation/policy')
      .set('Authorization', `Bearer ${scopedToken}`)
      .expect(200);
    expect(scopedPolicy.body.data).toEqual({
      enabled: true,
      provider: 'aliyun',
      mode: 'machine',
    });

    await request(app.getHttpServer())
      .get('/admin/content-moderation/settings')
      .set('Authorization', `Bearer ${scopedToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .put('/admin/content-moderation/settings')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({ enabled: true, provider: 'aliyun', mode: 'manual' })
      .expect(403);
    await request(app.getHttpServer())
      .put('/admin/content-moderation/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, provider: 'unknown', mode: 'machine' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .put('/admin/content-moderation/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, provider: 'wechat', mode: 'machine_and_manual' })
      .expect(200);
    expect(response.body.data).toMatchObject({
      provider: 'wechat',
      mode: 'machine_and_manual',
      enabled: true,
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'moderation-local-test-signature-secret',
    );
  });
  it('keeps a post private until all checks pass and then publishes it', async () => {
    const post = await createPost();
    expect(post.status).toBe('pending');
    expect(
      (await social.listPosts({ page: 1, pageSize: 20 } as never)).data,
    ).not.toEqual(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ id: post.id }),
        ]),
      }),
    );
    await worker.process(await next(post.id));
    expect(
      await db.post.findUniqueOrThrow({ where: { id: post.id } }),
    ).toMatchObject({ status: 'approved' });
    expect((await next(post.id)).status).toBe('approved');
  });
  it('retains manual decisions and routes risky, unknown and failed checks safely', async () => {
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
    });
    let post = await createPost();
    expect((await next(post.id)).status).toBe('manual');
    expect(providers.checkText).not.toHaveBeenCalled();
    await decide((await next(post.id)).id).expect(200);
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: post.id } })).status,
    ).toBe('approved');
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'machine_and_manual',
    });
    post = await createPost();
    await worker.process(await next(post.id));
    expect((await next(post.id)).status).toBe('manual');
    await decide((await next(post.id)).id, false).expect(200);
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: post.id } })).status,
    ).toBe('rejected');
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'machine',
    });
    providers.checkText.mockRejectedValueOnce(new Error('network transport'));
    post = await createPost();
    await worker.process(await next(post.id));
    expect((await next(post.id)).status).toBe('failed');
    await decide((await next(post.id)).id).expect(200);
    providers.checkText.mockResolvedValueOnce({ decision: 'block' });
    post = await createPost();
    await worker.process(await next(post.id));
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: post.id } })).status,
    ).toBe('rejected');
  });
  it('preserves the selected provider on existing jobs and supersedes edits/deletes', async () => {
    const post = await createPost();
    const original = await next(post.id);
    await settings.update({
      enabled: true,
      provider: 'wechat',
      mode: 'machine',
    });
    await worker.process(original);
    expect(providers.checkText).toHaveBeenCalledWith(
      'aliyun',
      expect.anything(),
    );
    const row = await db.post.findUniqueOrThrow({ where: { id: post.id } });
    await social.updatePost(userId, post.id, {
      content: '修改后的内容',
      images: [],
      expectedUpdatedAt: row.updatedAt.toISOString(),
    });
    const updated = await next(post.id);
    expect(updated.provider).toBe('wechat');
    await worker.process(original);
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: post.id } })).status,
    ).toBe('pending');
    await social.deletePost(userId, post.id);
    await worker.process(updated);
    expect((await next(post.id)).status).toBe('superseded');
  });
  it('holds public profile changes as a draft while preferences save immediately', async () => {
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
    });
    const profile = app.get(UserProfileService);
    const response = await profile.updateUserProfile(userId, {
      nickname: '待审昵称',
      bio: '待审简介',
      allergens: ['花生'],
    });
    expect(response.data.nickname).toBe('审核作者');
    expect(response.data.allergens).toEqual(['花生']);
    const task = await next(userId);
    expect(task.profilePatch).toEqual({
      nickname: '待审昵称',
      bio: '待审简介',
    });
    await decide(task.id).expect(200);
    expect(
      await db.user.findUniqueOrThrow({ where: { id: userId } }),
    ).toMatchObject({ nickname: '待审昵称', bio: '待审简介' });
  });
  it('refreshes private images in profile drafts, upload details and community administration', async () => {
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
    });
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#884488' },
    })
      .png()
      .toBuffer();
    const image = (
      await app.get(UploadService).uploadFile(
        {
          buffer,
          size: buffer.length,
          originalname: 'preview.png',
          mimetype: 'image/png',
        } as never,
        undefined,
        userId,
      )
    ).data;
    const assets = app.get(ModerationAssetsService);
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() - 7200000);
    let expired: string;
    try {
      expired = assets.preview(assets.assetId(image.url)!);
    } finally {
      clock.mockRestore();
    }
    await request(app.getHttpServer())
      .get(new URL(expired).pathname + new URL(expired).search)
      .expect(404);
    const profile = app.get(UserProfileService);
    await profile.updateUserProfile(userId, { avatar: expired });
    const post = await createPost('等待审核的图片', [expired]);
    const dish = await db.dish.findUniqueOrThrow({ where: { id: dishId } });
    const upload = await app.get(DishesService).uploadDish(
      {
        name: '图片投稿',
        price: 3,
        availableMealTime: [],
        canteenId: dish.canteenId,
        images: [expired],
      },
      userId,
    );
    const draft = (await profile.getUserProfile(userId)).data
      .publicProfileSubmission!;
    const detail = (await profile.getMyUpload(userId, upload.data.id)).data;
    const adminList = (
      await social.adminList('post', { page: 1, pageSize: 100 } as never, {
        scope: 'GLOBAL',
        canteenIds: [],
      })
    ).data as { items: { id: string; images: string[] }[] };
    const urls = [
      draft.fields.avatar as string,
      detail.images[0],
      adminList.items.find((item) => item.id === post.id)!.images[0],
    ];
    const statuses = await Promise.all(
      urls.map(
        async (url) =>
          (
            await request(app.getHttpServer()).get(
              new URL(url).pathname + new URL(url).search,
            )
          ).status,
      ),
    );
    expect(statuses).toEqual([200, 200, 200]);
    expect(
      (
        await db.contentModerationAsset.findUniqueOrThrow({
          where: { id: assets.assetId(image.url)! },
        })
      ).approved,
    ).toBe(false);
  });
  it('ends a rejected profile draft only when a new public edit replaces it after disabling moderation', async () => {
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
    });
    const profile = app.get(UserProfileService);
    await profile.updateUserProfile(userId, { nickname: '被拒昵称' });
    await decide((await next(userId)).id, false).expect(200);
    await settings.update({
      enabled: false,
      provider: 'aliyun',
      mode: 'manual',
    });
    const preferences = await profile.updateUserProfile(userId, {
      allergens: ['芝麻'],
    });
    expect(preferences.data.publicProfileSubmission?.fields.nickname).toBe(
      '被拒昵称',
    );
    const updated = await profile.updateUserProfile(userId, {
      nickname: '新公开昵称',
      bio: '新公开简介',
    });
    expect(updated.data).toMatchObject({
      nickname: '新公开昵称',
      bio: '新公开简介',
      publicProfileSubmission: null,
    });
    expect(
      (await profile.getUserProfile(userId)).data.publicProfileSubmission,
    ).toBeNull();
  });
  it('uses asset identity through contribution retries, edits and publication across authors', async () => {
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
    });
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#448844' },
    })
      .png()
      .toBuffer();
    const stage = async (owner: string) =>
      (
        await app.get(UploadService).uploadFile(
          {
            buffer,
            size: buffer.length,
            originalname: 'identity.png',
            mimetype: 'image/png',
          } as never,
          owner,
          owner,
        )
      ).data;
    const first = await stage(userId),
      second = await stage(otherId);
    const assets = app.get(ModerationAssetsService);
    await db.$transaction(async (tx) => {
      await assets.assertImages(tx, userId, [first.url]);
      await assets.approve(tx, [first.url]);
    });
    const base = await db.dish.findUniqueOrThrow({ where: { id: dishId } });
    const target = await db.dish.create({
      data: {
        name: '图片身份目标',
        price: 4,
        canteenId: base.canteenId,
        canteenName: base.canteenName,
        windowName: '',
        tags: [],
        ingredients: [],
        allergens: [],
        availableMealTime: [],
        images: [first.url],
      },
    });
    const input = {
      targetDishId: target.id,
      changedFields: ['description', 'images'],
      description: '补充说明',
      images: [first.url],
      clientRequestId: randomUUID(),
    };
    const dishes = app.get(DishesService),
      profile = app.get(UserProfileService),
      uploads = app.get(AdminUploadsService);
    const created = await dishes.uploadDish(input, otherId);
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);
    let freshFirst: string, freshSecond: string;
    try {
      freshFirst = assets.preview(assets.assetId(first.url)!);
      freshSecond = assets.preview(assets.assetId(second.url)!);
    } finally {
      clock.mockRestore();
    }
    expect(
      (await dishes.uploadDish({ ...input, images: [freshFirst] }, otherId))
        .data.id,
    ).toBe(created.data.id);
    const scope = {
      scope: 'GLOBAL',
      canteenIds: [],
      role: 'superadmin',
    } as const;
    await uploads.editUpload(
      created.data.id,
      { revision: 1, images: [freshSecond, freshFirst] },
      { ...scope, canteenIds: [] },
    );
    await profile.updateMyUpload(otherId, created.data.id, {
      revision: 2,
      targetDishId: target.id,
      changedFields: ['description', 'images'],
      description: '补充说明',
      images: [freshFirst, freshSecond, second.url],
    });
    await decide((await next(created.data.id)).id).expect(200);
    await uploads.approveUpload(
      created.data.id,
      { ...scope, canteenIds: [] },
      { revision: 3 },
    );
    const canonical = (url: string) =>
      new URL(url).origin + new URL(url).pathname;
    expect(
      (await db.dish.findUniqueOrThrow({ where: { id: target.id } })).images,
    ).toEqual([canonical(first.url), canonical(second.url)]);
  });
  it('protects staged images and handles callbacks that arrive before submit responses', async () => {
    await settings.update({
      enabled: true,
      provider: 'wechat',
      mode: 'machine',
    });
    const buffer = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#884488' },
    })
      .png()
      .toBuffer();
    const image = (
      await app.get(UploadService).uploadFile(
        {
          buffer,
          size: buffer.length,
          originalname: 'fixture.png',
          mimetype: 'image/png',
        } as never,
        undefined,
        userId,
      )
    ).data;
    const path = new URL(image.url).pathname;
    await request(app.getHttpServer())
      .get(`/images/${image.filename}`)
      .expect(404);
    await request(app.getHttpServer()).get(path).expect(404);
    await request(app.getHttpServer())
      .get(new URL(image.url).pathname + new URL(image.url).search)
      .expect(200);
    const post = await createPost('图片内容', [image.url]);
    providers.checkImage.mockImplementationOnce(async () => {
      await worker.receive(`${prefix}-early-callback`, 'pass');
      return { decision: 'pending', requestId: `${prefix}-early-callback` };
    });
    await worker.process(await next(post.id));
    expect((await next(post.id)).status).toBe('approved');
    await request(app.getHttpServer()).get(path).expect(200);
    await worker.receive(`${prefix}-early-callback`, 'block');
    expect(
      (
        await db.contentModerationReceipt.findUniqueOrThrow({
          where: { traceId: `${prefix}-early-callback` },
        })
      ).decision,
    ).toBe('pass');
  });
  it('waits for every image and times out missing callbacks into the manual queue', async () => {
    const assets = app.get(ModerationAssetsService);
    const buffer = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#884488' },
    })
      .png()
      .toBuffer();
    const image = await assets.stage(
      {
        buffer,
        size: buffer.length,
        originalname: 'fixture.png',
        mimetype: 'image/png',
      } as never,
      userId,
    );
    await settings.update({
      enabled: true,
      provider: 'wechat',
      mode: 'machine',
    });
    providers.checkImage.mockResolvedValue({
      decision: 'pending',
      requestId: `${prefix}-late-callback`,
    });
    const post = await createPost('等待图片检测', [image.url]);
    await worker.process(await next(post.id));
    expect((await next(post.id)).status).toBe('waiting');
    await worker.receive(`${prefix}-late-callback`, 'review');
    await worker.process(await next(post.id));
    expect((await next(post.id)).status).toBe('manual');
    const another = await createPost('超时', [image.url]);
    providers.checkImage.mockResolvedValue({
      decision: 'pending',
      requestId: `${prefix}-missing-callback`,
    });
    await worker.process(await next(another.id));
    await db.contentModerationTask.update({
      where: { id: (await next(another.id)).id },
      data: { callbackDeadline: new Date(0) },
    });
    await worker.tick();
    expect((await next(another.id)).status).toBe('failed');
  });
  it('publishes reviews with consistent statistics and replies with notifications', async () => {
    const reviews = app.get(ReviewsService),
      comments = app.get(CommentsService);
    const review = await reviews.createReview(userId, {
      dishId,
      rating: 5,
      content: '味道很好',
      images: [],
    });
    expect(review.data.status).toBe('pending');
    await worker.process(await next(review.data.id));
    expect(
      (await db.dish.findUniqueOrThrow({ where: { id: dishId } })).reviewCount,
    ).toBe(1);
    const comment = await comments.createComment(otherId, {
      reviewId: review.data.id,
      content: '我也喜欢',
    });
    expect(comment.data.status).toBe('pending');
    await worker.process(await next(comment.data.id));
    expect(
      (await db.comment.findUniqueOrThrow({ where: { id: comment.data.id } }))
        .status,
    ).toBe('approved');
    expect(
      await db.notification.count({
        where: { targetId: comment.data.id, userId },
      }),
    ).toBe(1);
  });
  it('discards a provider response when content is edited during its request', async () => {
    const post = await createPost('修改前');
    const old = await next(post.id);
    let started!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    providers.checkText.mockImplementationOnce(async () => {
      started();
      await delayed;
      return { decision: 'pass' };
    });
    const running = worker.process(old);
    await entered;
    await social.updatePost(userId, post.id, {
      expectedUpdatedAt: post.updatedAt,
      content: '修改后',
      images: [],
    });
    release();
    await running;
    expect(
      (
        await db.contentModerationTask.findUniqueOrThrow({
          where: { id: old.id },
        })
      ).status,
    ).toBe('superseded');
    expect(
      await db.post.findUniqueOrThrow({ where: { id: post.id } }),
    ).toMatchObject({ content: '修改后', status: 'pending' });
  });
  it('keeps contribution media alive across regenerated URLs and other UGC entry points', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#448844' },
    })
      .png()
      .toBuffer();
    const file = {
      buffer,
      size: buffer.length,
      originalname: 'fixture.png',
      mimetype: 'image/png',
    } as never;
    const image = (
      await app.get(UploadService).uploadFile(file, userId, userId)
    ).data;
    const canonical = new URL(image.url);
    canonical.search = '';
    const ledger = await db.contributionImage.findUniqueOrThrow({
      where: { url: canonical.toString() },
    });
    expect(ledger.expiresAt).not.toBeNull();
    // Another entry point submits the canonical URL after preview regeneration.
    const post = await createPost('复用贡献图片', [canonical.toString()]);
    expect(
      (
        await db.contributionImage.findUniqueOrThrow({
          where: { id: ledger.id },
        })
      ).expiresAt,
    ).toBeNull();
    await worker.process(await next(post.id));
    await request(app.getHttpServer()).get(canonical.pathname).expect(200);
  });
  it('publishes already staged media when unified moderation is disabled before submission', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#448844' },
    })
      .png()
      .toBuffer();
    const image = (
      await app.get(UploadService).uploadFile(
        {
          buffer,
          size: buffer.length,
          originalname: 'fixture.png',
          mimetype: 'image/png',
        } as never,
        undefined,
        userId,
      )
    ).data;
    await settings.update({
      enabled: false,
      provider: 'aliyun',
      mode: 'machine',
    });
    const post = await createPost('直接发布', [image.url]);
    expect(post.status).toBe('approved');
    await request(app.getHttpServer())
      .get(new URL(image.url).pathname)
      .expect(200);
  });
  it('keeps dish business confirmation and rejects duplicate content decisions', async () => {
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
    });
    const dish = await db.dish.findUniqueOrThrow({ where: { id: dishId } });
    const created = await app.get(DishesService).uploadDish(
      {
        name: '新菜品',
        canteenId: dish.canteenId,
        canteenName: dish.canteenName,
        price: 5,
        availableMealTime: [],
      },
      userId,
    );
    const task = await next(created.data.id);
    const results = await Promise.all([
      decide(task.id),
      decide(task.id, false),
    ]);
    expect(results.map((value) => value.status).sort()).toEqual([200, 409]);
    const current = await db.dishUpload.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    const state = await db.contentModerationTask.findUniqueOrThrow({
      where: { id: task.id },
    });
    if (state.status === 'approved') expect(current.status).toBe('pending');
    else {
      expect(current.status).toBe('rejected');
      expect(current.revision).toBe(2);
      expect(
        await db.notification.count({
          where: { targetId: current.id, type: 'upload_rejected' },
        }),
      ).toBe(1);
    }
  });
  it('preserves contribution rejection revisions and contributor notifications', async () => {
    providers.checkText.mockResolvedValue({ decision: 'block' });
    const dish = await db.dish.findUniqueOrThrow({ where: { id: dishId } });
    const created = await app.get(DishesService).uploadDish(
      {
        name: '待检测菜品',
        canteenId: dish.canteenId,
        canteenName: dish.canteenName,
        price: 5,
        availableMealTime: [],
      },
      userId,
    );
    await worker.process(await next(created.data.id));
    expect(
      await db.dishUpload.findUniqueOrThrow({ where: { id: created.data.id } }),
    ).toMatchObject({ status: 'rejected', revision: 2 });
    expect(
      await db.notification.count({
        where: { targetId: created.data.id, type: 'upload_rejected' },
      }),
    ).toBe(1);
  });
  it('resubmits revoked contributions and blocks approval until the new check finishes', async () => {
    providers.checkText.mockResolvedValue({ decision: 'block' });
    const dish = await db.dish.findUniqueOrThrow({ where: { id: dishId } });
    const created = await app.get(DishesService).uploadDish(
      {
        name: '需重新检测的菜品',
        canteenId: dish.canteenId,
        canteenName: dish.canteenName,
        price: 5,
        availableMealTime: [],
      },
      userId,
    );
    await worker.process(await next(created.data.id));
    const uploads = app.get(AdminUploadsService);
    const scope = { scope: 'GLOBAL', canteenIds: [], role: 'superadmin' };
    await uploads.revokeUpload(created.data.id, scope, 2);
    expect((await next(created.data.id)).status).toBe('queued');
    await expect(
      uploads.approveUpload(created.data.id, scope, { revision: 3 }),
    ).rejects.toThrow('内容安全检测进行中');
    await worker.process(await next(created.data.id));
    expect(
      await db.dishUpload.findUniqueOrThrow({ where: { id: created.data.id } }),
    ).toMatchObject({ status: 'rejected', revision: 4 });
  });
  it('clears moderation tasks when existing business review or deletion handles content', async () => {
    const post = await createPost();
    await worker.process(await next(post.id));
    await settings.update({
      enabled: true,
      provider: 'aliyun',
      mode: 'manual',
    });
    const reply = (
      await social.createComment(otherId, post.id, { content: '待审核的回复' })
    ).data as { id: string };
    await social.adminDelete('post', post.id, {
      scope: 'GLOBAL',
      canteenIds: [],
    });
    expect((await next(reply.id)).status).toBe('superseded');
    const dish = await db.dish.findUniqueOrThrow({ where: { id: dishId } });
    const created = await app.get(DishesService).uploadDish(
      {
        name: '人工确认菜品',
        canteenId: dish.canteenId,
        canteenName: dish.canteenName,
        price: 5,
        availableMealTime: [],
      },
      userId,
    );
    await app
      .get(AdminUploadsService)
      .rejectUpload(
        created.data.id,
        '资料需要补充',
        { scope: 'GLOBAL', canteenIds: [] },
        1,
      );
    expect((await next(created.data.id)).status).toBe('rejected');
  });
  it('sends multi-frame images to human review instead of clearing only their first frame', async () => {
    const buffer = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .gif({ delay: [50, 100], loop: 0 })
      .toBuffer();
    const image = (
      await app.get(UploadService).uploadFile(
        {
          buffer,
          size: buffer.length,
          originalname: 'motion.gif',
          mimetype: 'image/gif',
        } as never,
        undefined,
        userId,
      )
    ).data;
    const post = await createPost('动图', [image.url]);
    await worker.process(await next(post.id));
    expect((await next(post.id)).status).toBe('manual');
    expect(providers.checkImage).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get(new URL(image.url).pathname)
      .expect(404);
  });
  it('authenticates real JSON/XML callback HTTP requests before storing their receipts', async () => {
    const config = app.get(ConfigService);
    const token = 'callback-http-token';
    const key = Buffer.alloc(32, 9).toString('base64').replace(/=$/, '');
    const appid = 'wxcallbackhttp';
    config.set('MODERATION_WECHAT_TOKEN', token);
    config.set('MODERATION_WECHAT_AES_KEY', key);
    config.set('WECHAT_APPID', appid);
    const crypto = new WechatCrypto(token, key, appid);
    const traceId = `${prefix}-http-callback`;
    const encrypt = crypto.encrypt(
      JSON.stringify({
        MsgType: 'event',
        Event: 'wxa_media_check',
        appid,
        trace_id: traceId,
        version: 2,
        errcode: 0,
        result: { suggest: 'pass' },
      }),
    );
    const timestamp = String(Math.floor(Date.now() / 1000)),
      nonce = 'http-nonce';
    const query = {
      timestamp,
      nonce,
      msg_signature: crypto.getSignature(timestamp, nonce, encrypt),
    };
    await request(app.getHttpServer())
      .post('/content-moderation/wechat/callback')
      .query(query)
      .send({ Encrypt: encrypt })
      .expect(200, 'success');
    await request(app.getHttpServer())
      .post('/content-moderation/wechat/callback')
      .query(query)
      .type('application/xml')
      .send(`<xml><Encrypt><![CDATA[${encrypt}]]></Encrypt></xml>`)
      .expect(200, 'success');
    expect(
      (
        await db.contentModerationReceipt.findUniqueOrThrow({
          where: { traceId },
        })
      ).decision,
    ).toBe('pass');
    await request(app.getHttpServer())
      .post('/content-moderation/wechat/callback')
      .query({ ...query, msg_signature: '0'.repeat(40) })
      .send({ Encrypt: encrypt })
      .expect(401);
  });
});
