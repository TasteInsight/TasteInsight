import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModulesContainer } from '@nestjs/core';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import { AuthService } from '@/auth/auth.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { AdminUploadsService } from '@/admin-uploads/admin-uploads.service';
import { UploadService } from '@/upload/upload.service';
import { LocalStorageStrategy } from '@/upload/strategies/local-storage.strategy';
import { OssStorageStrategy } from '@/upload/strategies/oss-storage.strategy';
import { RecommendationCacheService } from '@/recommendation/services/cache.service';
import { EmbeddingService } from '@/recommendation/services/embedding.service';
import { DISH_SYNC_QUEUE } from '@/dish-sync-queue/dish-sync.constants';
import { DISH_REVIEW_STATS_QUEUE } from '@/dish-review-stats-queue/dish-review-stats.constants';
import { EMBEDDING_QUEUE } from '@/embedding-queue/embedding-queue.constants';
import { PublicHttpModule } from './public-http.module';
import { AdminHttpModule } from './admin-http.module';
import { DevelopmentHttpModule } from './development-http.module';

const accessSecret = 'http-boundary-access-secret';
const refreshSecret = 'http-boundary-refresh-secret';
const jwt = new JwtService();
const token = (type: 'user' | 'admin', tokenUse = 'access') =>
  `Bearer ${jwt.sign(
    { sub: `${type}-account`, type, tokenUse },
    { secret: tokenUse === 'refresh' ? refreshSecret : accessSecret },
  )}`;

const publicControllers = [
  'AIChatController',
  'CampusIdentityController',
  'CanteensController',
  'CommentsController',
  'DiningInvitesController',
  'DishesController',
  'IdentityController',
  'MealPlansController',
  'ModerationPublicController',
  'NewsController',
  'NotificationsController',
  'PublicMealPlansController',
  'RecommendationController',
  'ReviewsController',
  'SocialController',
  'UserProfileController',
];
const adminControllers = [
  'AdminAdminsController',
  'AdminCanteensController',
  'AdminCommentsController',
  'AdminConfigController',
  'AdminDishesController',
  'AdminLogsController',
  'AdminNewsController',
  'AdminRecommendationController',
  'AdminReportsController',
  'AdminReviewsController',
  'AdminSocialController',
  'AdminStudentVerificationController',
  'AdminUploadsController',
  'AdminWindowsController',
  'ModerationAdminController',
];

async function createHttpApplication(root: Type<unknown>) {
  const dishDetails = {
    getAdminDishById: jest.fn(async (id: string) => ({ id })),
  };
  const dishUploads = {
    getUploads: jest.fn(async () => ({ items: [], total: 0 })),
  };
  const auth = {
    refreshToken: jest.fn(async (sub, type) => ({ sub, type })),
    phoneLogin: jest.fn(async () => ({ code: 200 })),
    wechatLogin: jest.fn(async () => ({ code: 200 })),
    adminLogin: jest.fn(async () => ({ code: 200 })),
  };
  const upload = {
    uploadFile: jest.fn(async () => ({
      code: 200,
      data: { url: '/images/test' },
    })),
  };
  const prisma = {
    experiment: { findMany: jest.fn(async () => []) },
    admin: {
      findUnique: jest.fn(async () => ({
        id: 'admin-account',
        username: 'admin',
        role: 'superadmin',
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        permissions: [],
      })),
    },
  };
  const builder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [
          () => ({
            JWT_SECRET: accessSecret,
            JWT_REFRESH_SECRET: refreshSecret,
          }),
        ],
      }),
      PrismaModule,
      BullModule.forRoot({
        connection: { host: '127.0.0.1', port: 1 },
        extraOptions: { manualRegistration: true },
      }),
      root,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(AuthService)
    .useValue(auth)
    .overrideProvider(AdminDishesService)
    .useValue(dishDetails)
    .overrideProvider(AdminUploadsService)
    .useValue(dishUploads)
    .overrideProvider(UploadService)
    .useValue(upload)
    .overrideProvider(LocalStorageStrategy)
    .useValue({})
    .overrideProvider(OssStorageStrategy)
    .useValue({})
    .overrideProvider(RecommendationCacheService)
    .useValue({})
    .overrideProvider(EmbeddingService)
    .useValue({});

  for (const name of [
    DISH_SYNC_QUEUE,
    DISH_REVIEW_STATS_QUEUE,
    EMBEDDING_QUEUE,
  ]) {
    builder.overrideProvider(getQueueToken(name)).useValue({});
  }
  const module = await builder.compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  return {
    app,
    auth,
    upload,
    prisma,
    dishDetails,
    dishUploads,
    modules: module.get(ModulesContainer),
  };
}

describe.each([
  { name: 'public', root: PublicHttpModule, realm: 'user' },
  { name: 'admin', root: AdminHttpModule, realm: 'admin' },
  { name: 'development', root: DevelopmentHttpModule, realm: 'combined' },
] as const)('$name HTTP composition', ({ root, realm }) => {
  let fixture: Awaited<ReturnType<typeof createHttpApplication>>;
  let app: INestApplication;

  beforeAll(async () => {
    fixture = await createHttpApplication(root);
    app = fixture.app;
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => jest.clearAllMocks());

  it('registers only its own controllers through the resolved Nest module graph', () => {
    const actual = [...fixture.modules.values()].flatMap((module) =>
      [...module.controllers.values()].map((controller) => controller.name),
    );
    const expected =
      realm === 'user'
        ? [
            ...publicControllers,
            'PublicAuthController',
            'PublicUploadController',
          ]
        : realm === 'admin'
          ? [
              ...adminControllers,
              'AdminAuthController',
              'AdminUploadController',
            ]
          : [
              ...publicControllers,
              ...adminControllers,
              'AuthController',
              'UploadController',
            ];
    expect(actual.sort()).toEqual(expected.sort());
  });

  it('has no queue processors or notification schedulers in its provider graph', () => {
    const providers = [...fixture.modules.values()].flatMap((module) =>
      [...module.providers.values()].map((provider) => provider.metatype?.name),
    );
    expect(providers).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^(?:DishSyncProcessor|DishReviewStatsProcessor|EmbeddingQueueProcessor|NotificationDispatcher|NotificationCampaignService|ModerationDispatcher)$/,
        ),
      ]),
    );
  });

  it('routes the upload collection before the parameterized dish detail', async () => {
    const enabled = realm !== 'user';
    const response = await request(app.getHttpServer())
      .get('/admin/dishes/uploads')
      .set('Authorization', token('admin'))
      .expect(enabled ? 200 : 404);
    if (enabled) {
      expect(response.body).toEqual({ items: [], total: 0 });
    }
    expect(fixture.dishUploads.getUploads).toHaveBeenCalledTimes(
      enabled ? 1 : 0,
    );
    expect(fixture.dishDetails.getAdminDishById).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get('/admin/dishes/example-dish')
      .set('Authorization', token('admin'))
      .expect(enabled ? 200 : 404);
    expect(fixture.dishDetails.getAdminDishById).toHaveBeenCalledTimes(
      enabled ? 1 : 0,
    );
  });

  it('preserves realm-specific login paths without exposing the other login realm', async () => {
    await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'admin', password: 'password123' })
      .expect(realm === 'user' ? 404 : 200);
    await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'code', platform: 'mp-weixin' })
      .expect(realm === 'admin' ? 404 : 200);
    expect(fixture.auth.adminLogin).toHaveBeenCalledTimes(
      realm === 'user' ? 0 : 1,
    );
    expect(fixture.auth.wechatLogin).toHaveBeenCalledTimes(
      realm === 'admin' ? 0 : 1,
    );
  });

  it.each(['user', 'admin'] as const)(
    'restricts %s refresh tokens before token issuance',
    async (type) => {
      const accepted = realm === 'combined' || realm === type;
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', token(type, 'refresh'))
        .expect(accepted ? 200 : 401);
      if (accepted) {
        expect(fixture.auth.refreshToken).toHaveBeenCalledWith(
          `${type}-account`,
          type,
        );
      } else {
        expect(fixture.auth.refreshToken).not.toHaveBeenCalled();
      }
    },
  );

  it.each(['user', 'admin'] as const)(
    'never refreshes an %s access token',
    async (type) => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', token(type))
        .expect(401);
      expect(fixture.auth.refreshToken).not.toHaveBeenCalled();
    },
  );

  it.each(['user', 'admin'] as const)(
    'restricts %s uploads before reading/storing a file',
    async (type) => {
      const accepted = realm === 'combined' || realm === type;
      await request(app.getHttpServer())
        .post('/upload/image')
        .set('Authorization', token(type))
        .attach('file', Buffer.from('validated-by-upload-service'), 'image.png')
        .expect(accepted ? 201 : realm === 'admin' ? 403 : 401);
      expect(fixture.upload.uploadFile).toHaveBeenCalledTimes(accepted ? 1 : 0);
      expect(fixture.prisma.admin.findUnique).toHaveBeenCalledTimes(
        type === 'admin' && accepted ? 1 : 0,
      );
    },
  );

  it.each(['user', 'admin'] as const)(
    'never accepts a %s refresh token for upload',
    async (type) => {
      await request(app.getHttpServer())
        .post('/upload/image')
        .set('Authorization', token(type, 'refresh'))
        .attach('file', Buffer.from('not-stored'), 'image.png')
        .expect(401);
      expect(fixture.upload.uploadFile).not.toHaveBeenCalled();
    },
  );

  it('does not mount routes from the opposite business realm', async () => {
    for (const path of [
      '/admin/config/templates',
      '/admin/posts',
      '/admin/student-verifications',
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .expect(realm === 'user' ? 404 : 401);
    }
    for (const path of [
      '/user/profile',
      '/notifications',
      '/user/student-verification',
      '/recommend/health',
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .expect(realm === 'admin' ? 404 : 401);
    }
  });
});
