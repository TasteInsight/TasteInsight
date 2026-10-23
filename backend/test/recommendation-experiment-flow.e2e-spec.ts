import {
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { PrismaService } from '@/prisma.service';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { RecommendationController } from '@/recommendation/recommendation.controller';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { RecommendationCacheService } from '@/recommendation/services/cache.service';
import { AdminRecommendationModule } from '@/admin-recommendation/admin-recommendation.module';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
class TestDatabaseModule {}

describe('recommendation experiment lifecycle (PostgreSQL and Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: RecommendationService;
  let cache: RecommendationCacheService;
  let userId: string;
  let evaluationUserId: string;
  let canteenId: string;
  let adminId: string;
  let userToken: string;
  let adminToken: string;
  const experimentIds: string[] = [];
  const dishIds: string[] = [];
  const requestIds = new Set<string>();
  const seenKey = (requestId: string) =>
    `rec:seen:${createHash('sha256').update(requestId).digest('hex')}`;
  const body = () => ({
    filter: { canteenId: [canteenId] },
    pagination: { page: 1, pageSize: 2 },
    includeScoreBreakdown: true,
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        JwtModule.register({ secret: process.env.JWT_SECRET }),
        TestDatabaseModule,
        RecommendationModule,
        AdminRecommendationModule,
      ],
      controllers: [RecommendationController],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    service = app.get(RecommendationService);
    cache = app.get(RecommendationCacheService);
    userId = (await prisma.user.create({ data: { nickname: '推荐契约测试' } }))
      .id;
    evaluationUserId = (
      await prisma.user.create({ data: { nickname: '评估契约测试' } })
    ).id;
    const admin = await prisma.admin.create({
      data: {
        username: `rec-${userId}`,
        password: 'test-only-no-login',
        role: 'superadmin',
        scope: 'GLOBAL',
      },
    });
    adminId = admin.id;
    const jwt = app.get(JwtService);
    userToken = jwt.sign(
      { sub: userId, type: 'user', tokenUse: 'access' },
      { secret: process.env.JWT_SECRET },
    );
    adminToken = jwt.sign(
      {
        sub: adminId,
        type: 'admin',
        tokenUse: 'access',
        sessionVersion: admin.sessionVersion,
      },
      { secret: process.env.JWT_SECRET },
    );
    canteenId = (
      await prisma.canteen.create({
        data: { name: '推荐测试食堂', images: [], openingHours: [] },
      })
    ).id;
    await prisma.dish.createMany({
      data: Array.from({ length: 4 }, (_, index) => ({
        name: `推荐测试菜品${index}`,
        price: 10,
        tags: [],
        images: [],
        ingredients: [],
        allergens: [],
        canteenId,
        canteenName: '推荐测试食堂',
        windowName: '测试窗口',
        availableMealTime: ['lunch'],
        averageRating: 4,
      })),
    });
    dishIds.push(
      ...(
        await prisma.dish.findMany({
          where: { canteenId },
          select: { id: true },
        })
      ).map((dish) => dish.id),
    );
  });

  afterEach(async () => {
    await prisma.experiment.deleteMany({
      where: { id: { in: experimentIds } },
    });
    await prisma.userExperimentAssignment.deleteMany({
      where: { experimentId: { in: experimentIds } },
    });
    experimentIds.length = 0;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.recommendationDelivery.deleteMany({
        where: { userId: { in: [userId, evaluationUserId].filter(Boolean) } },
      });
      await prisma.recommendationEvent.deleteMany({
        where: { userId: { in: [userId, evaluationUserId].filter(Boolean) } },
      });
      if (canteenId) await prisma.canteen.delete({ where: { id: canteenId } });
      await prisma.recommendationProjection.deleteMany({
        where: { dishId: { in: dishIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userId, evaluationUserId].filter(Boolean) } },
      });
      if (adminId) await prisma.admin.delete({ where: { id: adminId } });
    }
    if (cache && requestIds.size)
      await cache.getRedisClient().del(...[...requestIds].map(seenKey));
    await app?.close();
  });

  async function createExperiment(name: string, enable = true) {
    const response = await request(app.getHttpServer())
      .post('/admin/experiments')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name,
        priority: 1000,
        trafficRatio: 1,
        startTime: '2020-01-01T00:00:00.000Z',
        groups: [
          {
            name: 'variant',
            ratio: 1,
            config: {
              weights: { preferenceMatch: 0, dishQuality: 80 },
              recallQuota: {
                vectorQuota: 0,
                ruleQuota: 1,
                collaborativeQuota: 0,
              },
            },
          },
        ],
      })
      .expect(201);
    const id = response.body.data as string;
    experimentIds.push(id);
    if (enable)
      await request(app.getHttpServer())
        .post(`/admin/experiments/${id}/enable`)
        .auth(adminToken, { type: 'bearer' })
        .expect(201);
    return id;
  }

  it('automatically applies and persists one experiment then exits it after pause', async () => {
    const id = await createExperiment('自动分组测试');
    const response = await request(app.getHttpServer())
      .post('/recommend')
      .auth(userToken, { type: 'bearer' })
      .send(body())
      .expect(200);
    const data = response.body.data;
    expect(data.items).toHaveLength(2);
    expect(data.experimentId).toBe(id);
    expect(data.debug.weightsUsed).toMatchObject({
      preferenceMatch: 0,
      dishQuality: 80,
    });
    expect(
      await prisma.userExperimentAssignment.findUnique({
        where: { userId_experimentId: { userId, experimentId: id } },
      }),
    ).toMatchObject({ groupItemId: data.groupItemId });
    requestIds.add(data.requestId);
    expect(data.deliveryId).toEqual(expect.any(String));
    const delivery = await prisma.recommendationDelivery.findUniqueOrThrow({
      where: { id: data.deliveryId },
    });
    expect(delivery).toMatchObject({
      userId,
      requestId: data.requestId,
      experimentId: id,
      groupItemId: data.groupItemId,
      configDigest: data.configDigest,
      scene: 'home',
      fallbackReason: null,
    });
    expect(delivery.items).toEqual(
      data.items.map((item, position) => ({ ...item, position })),
    );
    expect(
      await prisma.recommendationEvent.count({
        where: { requestId: data.requestId },
      }),
    ).toBe(0);
    expect(
      await prisma.recommendationFeedback.count({
        where: { deliveryId: data.deliveryId },
      }),
    ).toBe(0);
    await request(app.getHttpServer())
      .post(`/admin/experiments/${id}/disable`)
      .auth(adminToken, { type: 'bearer' })
      .expect(201);
    const paused = await request(app.getHttpServer())
      .post('/recommend')
      .auth(userToken, { type: 'bearer' })
      .send(body())
      .expect(200);
    requestIds.add(paused.body.data.requestId);
    expect(paused.body.data.groupItemId).toBeUndefined();
    expect(paused.body.data.debug.weightsUsed.dishQuality).toBe(18);
  });

  it('honors an explicitly selected second experiment and attributes its real group', async () => {
    await createExperiment('首个实验');
    const selected = await createExperiment('指定实验');
    const response = await request(app.getHttpServer())
      .post('/recommend')
      .auth(userToken, { type: 'bearer' })
      .send({ ...body(), experimentId: selected })
      .expect(200);
    requestIds.add(response.body.data.requestId);
    expect(response.body.data.experimentId).toBe(selected);
    const group = await prisma.experimentGroupItem.findUnique({
      where: { id: response.body.data.groupItemId },
    });
    expect(group?.experimentId).toBe(selected);
  });

  it('clears a persisted group configuration with an explicit empty object', async () => {
    const id = await createExperiment('清空配置', false);
    const group = await prisma.experimentGroupItem.findFirstOrThrow({
      where: { experimentId: id },
    });
    await request(app.getHttpServer())
      .put(`/admin/experiments/${id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        groups: [{ id: group.id, name: group.name, ratio: 1, config: {} }],
      })
      .expect(200);
    const read = await request(app.getHttpServer())
      .get(`/admin/experiments/${id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(read.body.data.status).toBe('draft');
    expect(read.body.data.groups[0]).toMatchObject({
      id: group.id,
      config: {},
    });
    expect(
      (
        await prisma.experimentGroupItem.findUniqueOrThrow({
          where: { id: group.id },
        })
      ).config,
    ).toEqual({});
    await request(app.getHttpServer())
      .post(`/admin/experiments/${id}/enable`)
      .auth(adminToken, { type: 'bearer' })
      .expect(201);
    const result = await request(app.getHttpServer())
      .post('/recommend')
      .auth(userToken, { type: 'bearer' })
      .send(body())
      .expect(200);
    requestIds.add(result.body.data.requestId);
    expect(result.body.data.experimentId).toBe(id);
    expect(result.body.data.debug.weightsUsed.dishQuality).toBe(18);
  });

  it('rejects group edits after start and preserves the persisted configuration', async () => {
    const id = await createExperiment('已启动配置锁定');
    const original = await prisma.experimentGroupItem.findFirstOrThrow({
      where: { experimentId: id },
    });
    await request(app.getHttpServer())
      .put(`/admin/experiments/${id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        groups: [
          { id: original.id, name: original.name, ratio: 1, config: {} },
        ],
      })
      .expect(409);
    const read = await request(app.getHttpServer())
      .get(`/admin/experiments/${id}`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(read.body.data.status).toBe('running');
    expect(read.body.data.groups[0]).toMatchObject({
      id: original.id,
      config: original.config,
    });
    expect(
      await prisma.experimentGroupItem.findUniqueOrThrow({
        where: { id: original.id },
      }),
    ).toEqual(original);
  });

  it('rejects unknown configuration fields at the HTTP write boundary', async () => {
    await request(app.getHttpServer())
      .post('/admin/experiments')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: 'unsupported',
        trafficRatio: 1,
        startTime: '2020-01-01T00:00:00.000Z',
        groups: [
          { name: 'group', ratio: 1, config: { algorithm: 'not-implemented' } },
        ],
      })
      .expect(400);
  });

  it('isolates evaluation from online events, assignments and seen state', async () => {
    await createExperiment('评估隔离');
    const online = await request(app.getHttpServer())
      .post('/recommend')
      .auth(userToken, { type: 'bearer' })
      .send(body())
      .expect(200);
    const beforeEvents = await prisma.recommendationEvent.count({
      where: { userId: evaluationUserId },
    });
    requestIds.add(online.body.data.requestId);
    const onlineSeenKey = seenKey(online.body.data.requestId);
    const beforeSeen = (
      await cache.getRedisClient().smembers(onlineSeenKey)
    ).sort();
    expect(beforeSeen).toHaveLength(2);
    const beforeDeliveries = await prisma.recommendationDelivery.count({
      where: { userId: evaluationUserId },
    });
    const result = await service.getRecommendations(
      evaluationUserId,
      { ...body(), requestId: online.body.data.requestId },
      { mode: 'evaluation' },
    );
    expect(result.data.requestId).toEqual(expect.any(String));
    const evaluationRequestId = result.data.requestId!;
    requestIds.add(evaluationRequestId);
    expect(result.data.requestId).not.toBe(online.body.data.requestId);
    expect(result.data.deliveryId).toBeUndefined();
    expect(
      await prisma.recommendationDelivery.count({
        where: { userId: evaluationUserId },
      }),
    ).toBe(beforeDeliveries);
    expect(result.data.groupItemId).toBeUndefined();
    expect(result.data.debug?.weightsUsed?.dishQuality).toBe(18);
    expect(
      await prisma.recommendationEvent.count({
        where: { userId: evaluationUserId },
      }),
    ).toBe(beforeEvents);
    expect(
      await prisma.userExperimentAssignment.count({
        where: { userId: evaluationUserId },
      }),
    ).toBe(0);
    expect(
      (await cache.getRedisClient().smembers(onlineSeenKey)).sort(),
    ).toEqual(beforeSeen);
    expect(
      await cache.getRedisClient().exists(seenKey(evaluationRequestId)),
    ).toBe(0);
  });
});
