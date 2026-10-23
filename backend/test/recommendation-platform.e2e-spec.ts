import {
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { PrismaService } from '@/prisma.service';
import { PrismaClient } from '@prisma/client';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { RecommendationController } from '@/recommendation/recommendation.controller';
import { RecommendationCacheService } from '@/recommendation/services/cache.service';
import { AdminRecommendationModule } from '@/admin-recommendation/admin-recommendation.module';
import { RecommendationIndexSyncService } from '@/recommendation-store/recommendation-index-sync.service';
import {
  indexTable,
  RecommendationStoreService,
} from '@/recommendation-store/recommendation-store.service';
import { digest } from '@/recommendation-platform/strategy-config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  RecommendationIndexDispatcher,
  RecommendationIndexWorkerModule,
} from '@/recommendation-platform/index-worker.module';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
class PlatformTestDatabaseModule {}

/** PostgreSQL/pgvector and Redis are real; the HTTP models are synthetic protocol fixtures. */
describe('recommendation platform lifecycle (two PostgreSQL databases and Redis)', () => {
  jest.setTimeout(90000);
  const prefix = `platform-e2e-${randomUUID()}`;
  let app: INestApplication;
  let workerApp: INestApplication | undefined;
  let prisma: PrismaService;
  let cache: RecommendationCacheService;
  let sync: RecommendationIndexSyncService;
  let store: RecommendationStoreService;
  let server: Server;
  let userId: string;
  let otherUserId: string;
  let adminId: string;
  let canteenId: string;
  let userToken: string;
  let otherToken: string;
  let adminToken: string;
  const previousDefaults = new Map<
    string,
    { strategyRevisionId: string } | null
  >();
  let rankFailure = false;
  const models: any[] = [];
  const indexes: any[] = [];
  const strategies: any[] = [];
  const experimentIds: string[] = [];
  const sessions = new Set<string>();
  const calls = new Map<string, number>();
  const parameterCalls: { path: string; payload: any }[] = [];
  let parameterEmbedding: any;
  let parameterRanker: any;
  const parameterIndexes: any[] = [];
  const fixtureModels = new Map<string, any>([
    [
      'synthetic-3',
      {
        ready: true,
        version: 'synthetic-3',
        kind: 'embedding',
        dimension: 3,
        artifactDigest: `${prefix}-3`,
        featureSchemaVersion: 'dish-user-v1',
      },
    ],
    [
      'synthetic-5',
      {
        ready: true,
        version: 'synthetic-5',
        kind: 'embedding',
        dimension: 5,
        artifactDigest: `${prefix}-5`,
        featureSchemaVersion: 'dish-user-v1',
      },
    ],
    [
      'synthetic-rank',
      {
        ready: true,
        version: 'synthetic-rank',
        kind: 'ranking',
        artifactDigest: `${prefix}-rank`,
        featureSchemaVersion: 'ranking-numeric-v1',
      },
    ],
  ]);
  const body = () => ({
    filter: { canteenId: [canteenId] },
    pagination: { page: 1, pageSize: 3 },
    includeScoreBreakdown: true,
  });
  const weights = {
    preferenceMatch: 25,
    favoriteSimilarity: 20,
    browseRelevance: 12,
    dishQuality: 18,
    diversity: 10,
    searchRelevance: 15,
  };
  const config = (
    indexId?: string,
    rankerId?: string,
    fallbackId?: string,
  ) => ({
    schemaVersion: 1,
    recall: {
      sources: {
        vectorQuota: indexId ? 1 : 0,
        ruleQuota: indexId ? 0 : 1,
        collaborativeQuota: 0,
      },
      candidateLimit: 30,
      ...(indexId ? { indexId } : {}),
    },
    ranking: rankerId
      ? { type: 'model_endpoint', modelVersionId: rankerId, timeoutMs: 1000 }
      : { type: 'weighted_rules', weights },
    rerank: { diversityEnabled: false },
    ...(fallbackId ? { fallbackStrategyRevisionId: fallbackId } : {}),
  });

  async function admin(
    method: 'get' | 'post' | 'put',
    path: string,
    payload?: unknown,
    status = method === 'post' && path.startsWith('/admin/experiments')
      ? 201
      : 200,
  ) {
    const call = request(app.getHttpServer())
      [method](path)
      .auth(adminToken, { type: 'bearer' });
    const response = await (payload === undefined
      ? call
      : call.send(payload as object));
    expect({
      status: response.status,
      body: response.status === status ? undefined : response.body,
    }).toEqual({ status, body: undefined });
    return response.body.data;
  }
  async function recommend(extra: object = {}, token = userToken) {
    const response = await request(app.getHttpServer())
      .post('/recommend')
      .auth(token, { type: 'bearer' })
      .send({ ...body(), ...extra })
      .expect(200);
    sessions.add(response.body.data.requestId);
    expect(response.body.data.items).toHaveLength(
      (extra as any).pagination?.pageSize ?? 3,
    );
    return response.body.data;
  }
  async function publish(name: string, value: any) {
    const draft = await admin('post', '/admin/recommendation/strategies', {
      name: `${prefix}-${name}`,
      scene: 'home',
      config: value,
    });
    strategies.push(draft);
    expect(draft.status).toBe('draft');
    const result = await admin(
      'post',
      `/admin/recommendation/strategies/${draft.id}/publish`,
    );
    expect(result.status).toBe('published');
    return result;
  }
  async function setDefault(strategy: any, scene = 'home') {
    const previous = await prisma.recommendationSceneDefault.findUnique({
      where: { scene },
    });
    if (!previousDefaults.has(scene)) previousDefaults.set(scene, previous);
    const count = await prisma.operationLog.count({
      where: { adminId, action: 'recommendation:default' },
    });
    await admin('put', `/admin/recommendation/defaults/${scene}`, {
      strategyRevisionId: strategy.id,
    });
    expect(
      await prisma.operationLog.count({
        where: { adminId, action: 'recommendation:default' },
      }),
    ).toBe(count + 1);
    const audit = await prisma.operationLog.findFirstOrThrow({
      where: { adminId, action: 'recommendation:default' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toMatchObject({
      targetId: strategy.id,
      result: 'success',
      details: {
        scene,
        before: previous?.strategyRevisionId ?? null,
        after: strategy.id,
      },
    });
  }
  async function createExperiment(
    name: string,
    strategy: any,
    priority: number,
    trafficRatio = 1,
  ) {
    const id = await admin('post', '/admin/experiments', {
      name: `${prefix}-${name}`,
      scene: 'home',
      priority,
      trafficRatio,
      startTime: '2020-01-01T00:00:00.000Z',
      groups: [{ name: 'version', ratio: 1, strategyRevisionId: strategy.id }],
    });
    experimentIds.push(id);
    await admin('post', `/admin/experiments/${id}/enable`);
    return id;
  }

  beforeAll(async () => {
    server = createServer((req, res) => {
      void (async () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.headers.authorization !== 'Bearer protocol-fixture-token') {
          res.writeHead(401).end('{}');
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const payload = chunks.length
          ? JSON.parse(Buffer.concat(chunks).toString())
          : {};
        const version = req.url?.startsWith('/model-info/')
          ? decodeURIComponent(req.url.slice('/model-info/'.length))
          : payload.version;
        const identity = fixtureModels.get(version);
        if (!identity) {
          res.writeHead(404).end('{}');
          return;
        }
        calls.set(
          `${req.url}:${version}`,
          (calls.get(`${req.url}:${version}`) ?? 0) + 1,
        );
        if (req.url?.startsWith('/model-info/')) {
          res.end(JSON.stringify(identity));
          return;
        }
        if (
          payload.artifactDigest !== identity.artifactDigest ||
          payload.featureSchemaVersion !== identity.featureSchemaVersion
        ) {
          res.writeHead(409).end('{}');
          return;
        }
        const appliedParameters = identity.parameterSchema
          ? Object.fromEntries(
              Object.entries(identity.parameterSchema.properties).map(
                ([name, definition]: [string, any]) => [
                  name,
                  payload.parameters?.[name] ?? definition.default,
                ],
              ),
            )
          : undefined;
        if (identity.parameterSchema)
          parameterCalls.push({ path: req.url!, payload });
        if (req.url === '/embed' && identity.kind === 'embedding') {
          res.end(
            JSON.stringify({
              ...identity,
              ...(appliedParameters ? { appliedParameters } : {}),
              embedding: appliedParameters
                ? [
                    1,
                    (Number(appliedParameters.numericWeight) *
                      payload.features.price) /
                      50,
                    0,
                  ]
                : Array(identity.dimension).fill(
                    1 / Math.sqrt(identity.dimension),
                  ),
            }),
          );
          return;
        }
        if (req.url === '/rank' && identity.kind === 'ranking') {
          if (rankFailure) {
            res.writeHead(503).end('{}');
            return;
          }
          res.end(
            JSON.stringify({
              ...identity,
              ...(appliedParameters ? { appliedParameters } : {}),
              scores: payload.candidates.map((candidate: any, i: number) => ({
                dishId: candidate.dishId,
                score: appliedParameters
                  ? 1 /
                    (1 +
                      Math.exp(
                        -(
                          ((1 - Number(appliedParameters.pricePenalty)) *
                            candidate.price) /
                          50
                        ) / Number(appliedParameters.temperature),
                      ))
                  : (i + 1) / payload.candidates.length,
              })),
            }),
          );
          return;
        }
        res.writeHead(400).end('{}');
      })().catch((error: Error) => {
        res.writeHead(500).end(JSON.stringify({ error: error.message }));
      });
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    process.env.RECOMMENDATION_MODEL_DEPLOYMENTS = JSON.stringify({
      synthetic: {
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        token: 'protocol-fixture-token',
        timeoutMs: 1000,
      },
    });
    process.env.EXTERNAL_EMBEDDING_SERVICE_ENABLED = 'false';
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        JwtModule.register({ secret: process.env.JWT_SECRET }),
        PlatformTestDatabaseModule,
        RecommendationModule,
        AdminRecommendationModule,
      ],
      controllers: [RecommendationController],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(['error', 'warn']);
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    cache = app.get(RecommendationCacheService);
    sync = app.get(RecommendationIndexSyncService);
    store = app.get(RecommendationStoreService);
    previousDefaults.set(
      'home',
      await prisma.recommendationSceneDefault.findUnique({
        where: { scene: 'home' },
      }),
    );
    userId = (
      await prisma.user.create({ data: { nickname: `${prefix}-user` } })
    ).id;
    otherUserId = (
      await prisma.user.create({ data: { nickname: `${prefix}-other` } })
    ).id;
    const administrator = await prisma.admin.create({
      data: {
        username: prefix,
        password: 'fixture-no-login',
        role: 'superadmin',
        scope: 'GLOBAL',
      },
    });
    adminId = administrator.id;
    const jwt = app.get(JwtService);
    userToken = jwt.sign(
      { sub: userId, type: 'user', tokenUse: 'access' },
      { secret: process.env.JWT_SECRET },
    );
    otherToken = jwt.sign(
      { sub: otherUserId, type: 'user', tokenUse: 'access' },
      { secret: process.env.JWT_SECRET },
    );
    adminToken = jwt.sign(
      {
        sub: adminId,
        type: 'admin',
        tokenUse: 'access',
        sessionVersion: administrator.sessionVersion,
      },
      { secret: process.env.JWT_SECRET },
    );
    canteenId = (
      await prisma.canteen.create({
        data: { name: prefix, images: [], openingHours: [] },
      })
    ).id;
    await prisma.dish.createMany({
      data: Array.from({ length: 12 }, (_, index) => ({
        name: `${prefix}-${index}`,
        price: 10 + index,
        tags: ['fixture'],
        images: [],
        ingredients: [],
        allergens: [],
        canteenId,
        canteenName: prefix,
        windowName: 'fixture',
        availableMealTime: ['lunch'],
        averageRating: 4,
      })),
    });
  });

  afterEach(async () => {
    rankFailure = false;
    if (prisma && experimentIds.length) {
      await prisma.experiment.updateMany({
        where: { id: { in: experimentIds } },
        data: { status: 'paused' },
      });
    }
  });

  afterAll(async () => {
    await workerApp?.close();
    workerApp = undefined;
    if (prisma) {
      const ownedModels = await prisma.recommendationModel.findMany({
        where: { name: { startsWith: prefix } },
      });
      const ownedIndexes = await prisma.recommendationIndex.findMany({
        where: { name: { startsWith: prefix } },
      });
      const ownedStrategies = (
        await prisma.recommendationStrategy.findMany({
          where: { name: { startsWith: prefix } },
        })
      ).map((item) => item.id);
      const currentDefaults = await prisma.recommendationSceneDefault.findMany({
        where: { strategyRevisionId: { in: ownedStrategies } },
      });
      for (const current of currentDefaults) {
        const previous = previousDefaults.get(current.scene);
        if (previous)
          await prisma.recommendationSceneDefault.update({
            where: { scene: current.scene },
            data: { strategyRevisionId: previous.strategyRevisionId },
          });
        else
          await prisma.recommendationSceneDefault.delete({
            where: { scene: current.scene },
          });
      }
      await prisma.userExperimentAssignment.deleteMany({
        where: { experimentId: { in: experimentIds } },
      });
      await prisma.experiment.deleteMany({
        where: { id: { in: experimentIds } },
      });
      const userIds = [userId, otherUserId].filter(Boolean);
      await prisma.recommendationDelivery.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.recommendationEvent.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.recommendationStrategy.deleteMany({
        where: { id: { in: ownedStrategies } },
      });
      for (const index of ownedIndexes) await store.dropIndex(index.id);
      await prisma.recommendationIndex.deleteMany({
        where: { id: { in: ownedIndexes.map((item) => item.id) } },
      });
      await prisma.recommendationModel.deleteMany({
        where: { id: { in: ownedModels.map((item) => item.id) } },
      });
      const dishes = canteenId
        ? await prisma.dish.findMany({
            where: { canteenId },
            select: { id: true },
          })
        : [];
      if (canteenId) await prisma.canteen.delete({ where: { id: canteenId } });
      await prisma.recommendationProjection.deleteMany({
        where: { dishId: { in: dishes.map((item) => item.id) } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (adminId) {
        await prisma.operationLog.deleteMany({ where: { adminId } });
        await prisma.admin.delete({ where: { id: adminId } });
      }
      if (cache) {
        const redis = cache.getRedisClient();
        const keys = new Set<string>();
        for (const id of [
          ...userIds,
          ...experimentIds,
          ...models.map((item) => item.id),
        ])
          for (const key of await redis.keys(`*${id}*`)) keys.add(key);
        for (const id of sessions) {
          keys.add(`rec:session-owner:${digest(id)}`);
          keys.add(`rec:seen:${createHash('sha256').update(id).digest('hex')}`);
        }
        if (keys.size) await redis.del(...keys);
      }
    }
    await app?.close();
    await new Promise<void>((done, reject) =>
      server
        ? server.close((error) => (error ? reject(error) : done()))
        : done(),
    );
  });

  it('registers, verifies and builds local 128D and two explicit HTTP vector spaces', async () => {
    await request(app.getHttpServer())
      .get('/admin/recommendation/catalog')
      .expect(401);
    const local = await admin('post', '/admin/recommendation/models', {
      name: `${prefix}-local`,
      kind: 'embedding',
      provider: 'local',
      serviceVersion: 'local-v1',
      artifactDigest: 'local-v1',
      featureSchemaVersion: 'dish-user-v1',
      dimension: 128,
    });
    models.push(local);
    for (const info of fixtureModels.values()) {
      models.push(
        await admin('post', '/admin/recommendation/models', {
          name: `${prefix}-${info.version}`,
          kind: info.kind,
          provider: 'http',
          serviceVersion: info.version,
          artifactDigest: info.artifactDigest,
          featureSchemaVersion: info.featureSchemaVersion,
          ...(info.dimension ? { dimension: info.dimension } : {}),
          deploymentId: 'synthetic',
        }),
      );
    }
    for (const model of models) {
      expect(
        (await admin('post', `/admin/recommendation/models/${model.id}/verify`))
          .status,
      ).toBe('ready');
      if (model.kind !== 'embedding') continue;
      const index = await admin('post', '/admin/recommendation/indexes', {
        name: `${prefix}-${model.dimension}`,
        modelVersionId: model.id,
      });
      indexes.push(index);
      for (let attempt = 0; attempt < 20; attempt++) {
        const progress = await sync.syncIndex(index.id, 1000);
        if (progress.pending === 0) break;
      }
      expect(
        await prisma.recommendationIndex.findUnique({
          where: { id: index.id },
        }),
      ).toMatchObject({ status: 'ready' });
      expect(await store.count(index.id)).toBeGreaterThanOrEqual(12);
    }
    const catalog = await admin('get', '/admin/recommendation/catalog');
    expect(catalog.storeConfigured).toBe(true);
    for (const index of indexes)
      expect(
        catalog.indexes.find((item: any) => item.id === index.id),
      ).toMatchObject({ pending: 0, failed: 0 });
    const baseline = await publish('baseline', config());
    await publish('local', config(indexes[0].id, undefined, baseline.id));
    await publish('three', config(indexes[1].id, models[3].id, baseline.id));
    await publish('five', config(indexes[2].id, models[3].id, baseline.id));
  });

  it('serves both HTTP dimensions, rolls back to a prior index and filters offline dishes immediately', async () => {
    for (const position of [2, 3, 2, 1]) {
      await setDefault(strategies[position]);
      const result = await recommend();
      expect(result).toMatchObject({
        strategyRevisionId: strategies[position].id,
        indexId: indexes[position - 1].id,
        modelVersionId: models[position - 1].id,
        mode: 'online',
      });
      expect(result.fallbackReason).toBeUndefined();
      const delivery = await prisma.recommendationDelivery.findUniqueOrThrow({
        where: { id: result.deliveryId },
      });
      expect(delivery.indexId).toBe(indexes[position - 1].id);
    }
    expect(calls.get('/embed:synthetic-3')).toBeGreaterThan(0);
    expect(calls.get('/embed:synthetic-5')).toBeGreaterThan(0);
    expect(calls.get('/rank:synthetic-rank')).toBeGreaterThan(0);
    await setDefault(strategies[2]);
    const before = await recommend();
    await setDefault(strategies[3]);
    const switched = await recommend({
      requestId: before.requestId,
      pagination: { page: 2, pageSize: 3 },
    });
    expect(switched.indexId).toBe(indexes[2].id);
    expect(switched.requestId).not.toBe(before.requestId);
    expect(switched.sessionReset).toBe(true);
    expect(switched.meta.page).toBe(1);
    const crossUser = await recommend(
      { requestId: switched.requestId },
      otherToken,
    );
    expect(crossUser.requestId).not.toBe(switched.requestId);
    const resized = await recommend({
      requestId: switched.requestId,
      pagination: { page: 2, pageSize: 4 },
    });
    expect(resized.requestId).not.toBe(switched.requestId);
    expect(resized.sessionReset).toBe(true);
    expect(resized.meta.page).toBe(1);
    await setDefault(strategies[2]);
    const removed = before.items[0].id;
    await prisma.dish.update({
      where: { id: removed },
      data: { status: 'offline' },
    });
    try {
      expect(
        (await recommend()).items.map((item: any) => item.id),
      ).not.toContain(removed);
    } finally {
      await prisma.dish.update({
        where: { id: removed },
        data: { status: 'online' },
      });
    }
  });

  it('keeps published configurations immutable and preview out of delivery and assignment tables', async () => {
    await admin(
      'put',
      `/admin/recommendation/strategies/${strategies[2].id}`,
      { config: config() },
      409,
    );
    const before = await prisma.recommendationDelivery.count({
      where: { userId },
    });
    const preview = await admin('post', '/admin/recommendation/preview', {
      userId,
      strategyRevisionId: strategies[3].id,
      filter: { canteenId: [canteenId] },
      pageSize: 3,
    });
    expect(preview.mode).toBe('preview');
    expect(preview.deliveryId).toBeUndefined();
    expect(preview.items).toHaveLength(3);
    expect(
      await prisma.recommendationDelivery.count({ where: { userId } }),
    ).toBe(before);
    expect(
      await prisma.userExperimentAssignment.count({ where: { userId } }),
    ).toBe(0);
  });

  it('captures comparable shadow runs through HTTP and the CLI without online side effects', async () => {
    const users = [userId, otherUserId];
    const counts = async () => ({
      deliveries: await prisma.recommendationDelivery.count({
        where: { userId: { in: users } },
      }),
      events: await prisma.recommendationEvent.count({
        where: { userId: { in: users } },
      }),
      assignments: await prisma.userExperimentAssignment.count({
        where: { userId: { in: users } },
      }),
      feedback: await prisma.recommendationFeedback.count({
        where: { delivery: { userId: { in: users } } },
      }),
    });
    const before = await counts();
    const payload = {
      userIds: users,
      strategyRevisionIds: [strategies[2].id, strategies[3].id],
      filter: { canteenId: [canteenId] },
      pageSize: 3,
    };
    const shadow = await admin('post', '/admin/recommendation/shadow', payload);
    expect(shadow.runs).toHaveLength(4);
    for (const user of users) {
      const runs = shadow.runs.filter((run: any) => run.userId === user);
      expect(new Set(runs.map((run: any) => run.queryId)).size).toBe(1);
      expect(new Set(runs.map((run: any) => run.featureAsOf)).size).toBe(1);
      expect(new Set(runs.map((run: any) => run.predictedAt)).size).toBe(1);
      expect(new Set(runs.map((run: any) => run.strategyRevisionId))).toEqual(
        new Set(payload.strategyRevisionIds),
      );
      for (const run of runs) {
        expect(Date.parse(run.featureAsOf)).toBeLessThanOrEqual(
          Date.parse(run.predictedAt),
        );
        expect(run.rankedIds).toHaveLength(3);
        expect(run.candidateIds.length).toBeGreaterThanOrEqual(3);
        expect(
          run.rankedIds.every((id: string) => run.candidateIds.includes(id)),
        ).toBe(true);
        expect(run.catalogSize).toBeGreaterThanOrEqual(run.candidateIds.length);
        expect(run.latencyMs).toBeGreaterThanOrEqual(0);
      }
    }
    const folder = await mkdtemp(join(tmpdir(), 'recommendation-shadow-'));
    try {
      const input = join(folder, 'request.json'),
        output = join(folder, 'runs.json');
      await writeFile(input, JSON.stringify(payload));
      const address = app.getHttpServer().address() as AddressInfo;
      const result = await promisify(execFile)(
        process.execPath,
        [
          resolve('scripts/recommendation-evaluate.cjs'),
          'collect',
          '--url',
          `http://127.0.0.1:${address.port}/admin/recommendation/shadow`,
          '--request',
          input,
          '--output',
          output,
        ],
        { env: { ...process.env, ADMIN_TOKEN: adminToken } },
      );
      expect(result.stdout).not.toContain(adminToken);
      expect(JSON.parse(await readFile(output, 'utf8')).data.runs).toHaveLength(
        4,
      );
      const emptyLabels = join(folder, 'labels.jsonl');
      await writeFile(emptyLabels, '');
      const premature = await promisify(execFile)(
        process.execPath,
        [
          resolve('scripts/recommendation-evaluate.cjs'),
          '--runs',
          output,
          '--labels',
          emptyLabels,
          '--train-until',
          '2020-01-01T00:00:00Z',
          '--validation-until',
          '2020-02-01T00:00:00Z',
          '--test-start',
          new Date(Date.now() - 86400000).toISOString(),
          '--test-end',
          new Date().toISOString(),
          '--label-window-hours',
          '24',
          '--k',
          '3',
        ],
        { env: process.env },
      ).then(
        () => null,
        (error) => error,
      );
      expect(premature?.code).toBe(1);
      expect(premature?.stderr).toContain('mature label window');
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
    expect(await counts()).toEqual(before);
  });

  it('uses experiment priority, preserves attribution, deduplicates feedback and exits after pause or zero traffic', async () => {
    await setDefault(strategies[1]);
    const lower = await createExperiment('lower', strategies[2], 10);
    const higher = await createExperiment('higher', strategies[3], 20);
    const result = await recommend();
    expect(result).toMatchObject({
      experimentId: higher,
      strategyRevisionId: strategies[3].id,
      indexId: indexes[2].id,
    });
    const dishId = result.items[0].id;
    const feedback = {
      deliveryId: result.deliveryId,
      dishId,
      eventType: 'click',
    };
    await request(app.getHttpServer())
      .post('/recommend/events/feedback')
      .auth(otherToken, { type: 'bearer' })
      .send(feedback)
      .expect(404);
    await request(app.getHttpServer())
      .post('/recommend/events/feedback')
      .auth(userToken, { type: 'bearer' })
      .send({ ...feedback, dishId: 'unknown' })
      .expect(404);
    for (const eventType of ['click', 'click'])
      await request(app.getHttpServer())
        .post('/recommend/events/feedback')
        .auth(userToken, { type: 'bearer' })
        .send({ ...feedback, eventType })
        .expect(200);
    const beforeImpression = await admin(
      'get',
      `/admin/experiments/${higher}/metrics?days=7`,
    );
    expect(
      beforeImpression.groups.find(
        (group: any) => group.groupItemId === result.groupItemId,
      ),
    ).toMatchObject({ deliveries: 1, impressions: 0, clicks: 0, ctr: 0 });
    for (const eventType of ['impression', 'impression'])
      await request(app.getHttpServer())
        .post('/recommend/events/feedback')
        .auth(userToken, { type: 'bearer' })
        .send({ ...feedback, eventType })
        .expect(200);
    expect(
      await prisma.recommendationFeedback.count({
        where: { deliveryId: result.deliveryId },
      }),
    ).toBe(2);
    const metrics = await admin(
      'get',
      `/admin/experiments/${higher}/metrics?days=7`,
    );
    expect(metrics.metricVersion).toBe(2);
    expect(
      metrics.groups.find(
        (group: any) => group.groupItemId === result.groupItemId,
      ),
    ).toMatchObject({ deliveries: 1, impressions: 1, clicks: 1, ctr: 1 });
    await prisma.recommendationIndex.update({
      where: { id: indexes[2].id },
      data: { status: 'building' },
    });
    try {
      await admin('post', `/admin/experiments/${higher}/disable`);
    } finally {
      await prisma.recommendationIndex.update({
        where: { id: indexes[2].id },
        data: { status: 'ready' },
      });
    }
    const paused = await recommend({
      requestId: result.requestId,
      pagination: { page: 2, pageSize: 3 },
    });
    expect(paused.experimentId).toBe(lower);
    expect(paused.requestId).not.toBe(result.requestId);
    expect(paused.sessionReset).toBe(true);
    expect(paused.meta.page).toBe(1);
    await prisma.recommendationIndex.update({
      where: { id: indexes[1].id },
      data: { status: 'building' },
    });
    try {
      await admin('put', `/admin/experiments/${lower}`, { trafficRatio: 0 });
    } finally {
      await prisma.recommendationIndex.update({
        where: { id: indexes[1].id },
        data: { status: 'ready' },
      });
    }
    const excluded = await recommend();
    expect(excluded.experimentId).toBeUndefined();
    expect(excluded.strategyRevisionId).toBe(strategies[1].id);
    await admin(
      'put',
      `/admin/experiments/${higher}`,
      {
        groups: [
          { name: 'changed', ratio: 1, strategyRevisionId: strategies[1].id },
        ],
      },
      409,
    );
  });

  it('keeps inline legacy experiments on the published model and index', async () => {
    await setDefault(strategies[2]);
    const experimentId = await admin('post', '/admin/experiments', {
      name: `${prefix}-inline`,
      scene: 'home',
      priority: 30,
      trafficRatio: 1,
      startTime: '2020-01-01T00:00:00.000Z',
      groups: [
        {
          name: 'inline',
          ratio: 1,
          config: {
            weights: { preferenceMatch: 0, dishQuality: 80 },
            recallQuota: {
              vectorQuota: 1,
              ruleQuota: 0,
              collaborativeQuota: 0,
            },
          },
        },
      ],
    });
    experimentIds.push(experimentId);
    await admin('post', `/admin/experiments/${experimentId}/enable`);
    const result = await recommend();
    expect(result).toMatchObject({
      experimentId,
      strategyRevisionId: strategies[2].id,
      indexId: indexes[1].id,
      modelVersionId: models[1].id,
    });
    expect(result.fallbackReason).toBeUndefined();
    expect(result.rankerVersionId).toBeUndefined();
    expect(result.debug.weightsUsed.dishQuality).toBe(80);
  });

  it('routes compatibility personal and similar HTTP endpoints through published versions with offset pagination', async () => {
    await setDefault(strategies[2]);
    const pages: string[][] = [];
    for (const page of [1, 2]) {
      const response = await request(app.getHttpServer())
        .post('/recommend/personal')
        .auth(userToken, { type: 'bearer' })
        .send({ canteenId, pagination: { page, pageSize: 3 } })
        .expect(200);
      const data = response.body.data;
      expect(data).toMatchObject({
        strategyRevisionId: strategies[2].id,
        indexId: indexes[1].id,
        modelVersionId: models[1].id,
        rankerVersionId: models[3].id,
      });
      expect(data.items).toHaveLength(3);
      expect(data.pagination.page).toBe(page);
      expect(data.total).toBeGreaterThanOrEqual(6);
      const delivery = await prisma.recommendationDelivery.findUniqueOrThrow({
        where: { id: data.deliveryId },
      });
      expect(delivery.indexId).toBe(indexes[1].id);
      expect((delivery.items as any[])[0].position).toBe((page - 1) * 3);
      pages.push(data.items.map((item: any) => item.id));
    }
    expect(pages[1].some((id: string) => pages[0].includes(id))).toBe(false);
    const baseline = await admin('post', '/admin/recommendation/strategies', {
      name: `${prefix}-similar-baseline`,
      scene: 'similar',
      config: config(),
    });
    strategies.push(baseline);
    await admin(
      'post',
      `/admin/recommendation/strategies/${baseline.id}/publish`,
    );
    const similar = await admin('post', '/admin/recommendation/strategies', {
      name: `${prefix}-similar-model`,
      scene: 'similar',
      config: config(indexes[0].id, undefined, baseline.id),
    });
    strategies.push(similar);
    await admin(
      'post',
      `/admin/recommendation/strategies/${similar.id}/publish`,
    );
    await setDefault(similar, 'similar');
    const trigger = await prisma.dish.findFirstOrThrow({
      where: { canteenId },
    });
    const response = await request(app.getHttpServer())
      .post(`/recommend/similar/${trigger.id}`)
      .auth(userToken, { type: 'bearer' })
      .send({ pagination: { page: 1, pageSize: 3 } })
      .expect(200);
    expect(response.body.data).toMatchObject({
      strategyRevisionId: similar.id,
      indexId: indexes[0].id,
      modelVersionId: models[0].id,
    });
    expect(response.body.data.items).toHaveLength(3);
    expect(response.body.data.items.map((item: any) => item.id)).not.toContain(
      trigger.id,
    );
    expect(
      (
        await prisma.recommendationDelivery.findUniqueOrThrow({
          where: { id: response.body.data.deliveryId },
        })
      ).scene,
    ).toBe('similar');
  });

  it('falls back as a whole policy when the ranker fails and records the actual baseline', async () => {
    await setDefault(strategies[2]);
    rankFailure = true;
    const result = await recommend();
    expect(result.strategyRevisionId).toBe(strategies[0].id);
    expect(result.fallbackReason).toBeTruthy();
    expect(result.indexId).toBeUndefined();
    expect(result.rankerVersionId).toBeUndefined();
    const delivery = await prisma.recommendationDelivery.findUniqueOrThrow({
      where: { id: result.deliveryId },
    });
    expect(delivery.strategyRevisionId).toBe(strategies[0].id);
    expect(delivery.indexId).toBeNull();
    expect(delivery.fallbackReason).toBeTruthy();
    const beforePreview = await prisma.recommendationDelivery.count({
      where: { userId },
    });
    const preview = await admin('post', '/admin/recommendation/preview', {
      userId,
      strategyRevisionId: strategies[2].id,
      filter: { canteenId: [canteenId] },
      pageSize: 3,
    });
    expect(preview.mode).toBe('preview');
    expect(preview.strategyRevisionId).toBe(strategies[0].id);
    expect(preview.fallbackReason).toBeTruthy();
    expect(preview.deliveryId).toBeUndefined();
    expect(
      await prisma.recommendationDelivery.count({ where: { userId } }),
    ).toBe(beforePreview);
    rankFailure = false;
    await prisma.recommendationModel.update({
      where: { id: models[1].id },
      data: { status: 'draft' },
    });
    try {
      const unready = await recommend();
      expect(unready.strategyRevisionId).toBe(strategies[0].id);
      expect(unready.fallbackReason).toBeTruthy();
    } finally {
      await prisma.recommendationModel.update({
        where: { id: models[1].id },
        data: { status: 'ready' },
      });
    }
    await prisma.recommendationIndex.update({
      where: { id: indexes[1].id },
      data: { status: 'building' },
    });
    try {
      const unready = await recommend();
      expect(unready.strategyRevisionId).toBe(strategies[0].id);
      expect(unready.fallbackReason).toBeTruthy();
    } finally {
      await prisma.recommendationIndex.update({
        where: { id: indexes[1].id },
        data: { status: 'ready' },
      });
    }
  });

  it('uses the published fallback during a physical vector-table outage and recovers without rebuilding', async () => {
    await setDefault(strategies[2]);
    const before = await recommend();
    expect(before.indexId).toBe(indexes[1].id);
    const taskCount = await prisma.recommendationIndexTask.count({
      where: { indexId: indexes[1].id },
    });
    const vectorDb = new PrismaClient({
      datasourceUrl: process.env.RECOMMENDATION_DATABASE_URL,
    });
    const table = indexTable(indexes[1].id);
    const originalName = table.split('.')[1];
    const unavailableName = `${originalName}_outage`;
    let renamed = false;
    try {
      await vectorDb.$executeRawUnsafe(
        `ALTER TABLE ${table} RENAME TO ${unavailableName}`,
      );
      renamed = true;
      const degraded = await recommend();
      expect(degraded.strategyRevisionId).toBe(strategies[0].id);
      expect(degraded.fallbackReason).toBeTruthy();
      expect(degraded.indexId).toBeUndefined();
      expect(degraded.modelVersionId).toBeUndefined();
      expect(degraded.rankerVersionId).toBeUndefined();
      const delivery = await prisma.recommendationDelivery.findUniqueOrThrow({
        where: { id: degraded.deliveryId },
      });
      expect(delivery).toMatchObject({
        strategyRevisionId: strategies[0].id,
        indexId: null,
        modelVersionId: null,
        rankerVersionId: null,
      });
      expect(delivery.fallbackReason).toBeTruthy();
    } finally {
      try {
        if (renamed)
          await vectorDb.$executeRawUnsafe(
            `ALTER TABLE recommendation_store.${unavailableName} RENAME TO ${originalName}`,
          );
      } finally {
        await vectorDb.$disconnect();
      }
    }
    const recovered = await recommend();
    expect(recovered).toMatchObject({
      strategyRevisionId: strategies[2].id,
      indexId: indexes[1].id,
      modelVersionId: models[1].id,
      rankerVersionId: models[3].id,
    });
    expect(recovered.fallbackReason).toBeUndefined();
    expect(
      await prisma.recommendationIndexTask.count({
        where: { indexId: indexes[1].id },
      }),
    ).toBe(taskCount);
    expect(
      (
        await prisma.recommendationIndex.findUniqueOrThrow({
          where: { id: indexes[1].id },
        })
      ).status,
    ).toBe('ready');
  });

  it('exports only mature observed snapshots through the actual Prisma export script', async () => {
    await setDefault(strategies[1]);
    const result = await recommend();
    const createdAt = new Date(Date.now() - 3 * 86400000);
    const eventAt = new Date(createdAt.getTime() + 3600000);
    await prisma.recommendationDelivery.update({
      where: { id: result.deliveryId },
      data: { createdAt },
    });
    await prisma.recommendationFeedback.createMany({
      data: [
        {
          deliveryId: result.deliveryId,
          dishId: result.items[0].id,
          eventType: 'impression',
          createdAt: eventAt,
        },
        {
          deliveryId: result.deliveryId,
          dishId: result.items[0].id,
          eventType: 'click',
          createdAt: eventAt,
        },
        {
          deliveryId: result.deliveryId,
          dishId: result.items[1].id,
          eventType: 'impression',
          createdAt: eventAt,
        },
        {
          deliveryId: result.deliveryId,
          dishId: result.items[2].id,
          eventType: 'click',
          createdAt: eventAt,
        },
      ],
    });
    const folder = await mkdtemp(join(tmpdir(), 'recommendation-export-'));
    try {
      const output = join(folder, 'samples.jsonl');
      await promisify(execFile)(
        process.execPath,
        [
          resolve('python-embedding-service/train/export_ranking_samples.cjs'),
          output,
          new Date().toISOString(),
        ],
        { env: process.env },
      );
      const text = await readFile(output, 'utf8');
      const samples = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((row) => row.deliveryId === result.deliveryId);
      expect(samples).toHaveLength(2);
      expect(
        samples.find((row) => row.candidate.dishId === result.items[0].id)
          .label,
      ).toBe(1);
      expect(
        samples.find((row) => row.candidate.dishId === result.items[1].id)
          .label,
      ).toBe(0);
      expect(
        samples.every(
          (row) => row.user && row.labelWindowEnd && row.candidate.price > 0,
        ),
      ).toBe(true);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
  it('persists queue work without a consumer and catches up after restarting the real index worker', async () => {
    const createWorker = async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
          PlatformTestDatabaseModule,
          BullModule.forRoot({
            connection: {
              host: process.env.REDIS_HOST || '127.0.0.1',
              port: Number(process.env.REDIS_PORT),
              password: process.env.REDIS_PASSWORD,
              db: 0,
            },
          }),
          RecommendationIndexWorkerModule,
        ],
      }).compile();
      const application = module.createNestApplication();
      application.useLogger(['error', 'warn']);
      return application;
    };
    const waitFor = async (condition: () => Promise<boolean>) => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (await condition()) return;
        await new Promise((done) => setTimeout(done, 30));
      }
      throw new Error(
        'Index worker did not acknowledge the target revision within 15 seconds',
      );
    };
    const index = await admin('post', '/admin/recommendation/indexes', {
      name: `${prefix}-queued`,
      modelVersionId: models[0].id,
    });
    indexes.push(index);
    workerApp = await createWorker();
    await workerApp.get(RecommendationIndexDispatcher).dispatch();
    let queue = workerApp.get<Queue>(getQueueToken('recommendation-index'));
    expect(await (await queue.getJob(`index-${index.id}`))?.getState()).toBe(
      'waiting',
    );
    expect(
      await prisma.recommendationIndexTask.count({
        where: { indexId: index.id },
      }),
    ).toBe(0);
    await workerApp.init();
    await waitFor(
      async () =>
        (
          await prisma.recommendationIndex.findUnique({
            where: { id: index.id },
          })
        )?.status === 'ready',
    );
    expect(await store.count(index.id)).toBeGreaterThanOrEqual(12);
    await workerApp.close();
    workerApp = undefined;

    const dish = await prisma.dish.findFirstOrThrow({ where: { canteenId } });
    const before = await prisma.recommendationIndexTask.findUniqueOrThrow({
      where: { indexId_dishId: { indexId: index.id, dishId: dish.id } },
    });
    await prisma.dish.update({
      where: { id: dish.id },
      data: { price: dish.price + 1 },
    });
    const projection = await prisma.recommendationProjection.findUniqueOrThrow({
      where: { dishId: dish.id },
    });
    expect(projection.revision).toBeGreaterThan(before.revision);
    workerApp = await createWorker();
    await workerApp.get(RecommendationIndexDispatcher).dispatch();
    queue = workerApp.get<Queue>(getQueueToken('recommendation-index'));
    expect(await (await queue.getJob(`index-${index.id}`))?.getState()).toBe(
      'waiting',
    );
    expect(
      (
        await prisma.recommendationIndexTask.findUniqueOrThrow({
          where: { indexId_dishId: { indexId: index.id, dishId: dish.id } },
        })
      ).revision,
    ).toBe(before.revision);
    await workerApp.init();
    await waitFor(
      async () =>
        (
          await prisma.recommendationIndexTask.findUnique({
            where: { indexId_dishId: { indexId: index.id, dishId: dish.id } },
          })
        )?.revision === projection.revision,
    );
    expect((await sync.progress(index.id)).pending).toBe(0);
    await workerApp.close();
    workerApp = undefined;
  });

  it('persists model-owned parameter declarations after verification and rejects malformed declarations', async () => {
    const declarations = [
      {
        ready: true,
        version: 'parameter-embedding',
        kind: 'embedding',
        dimension: 3,
        artifactDigest: `${prefix}-parameter-embedding`,
        featureSchemaVersion: 'dish-user-v1',
        parameterSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            numericWeight: {
              type: 'number',
              title: '数值权重',
              default: 1,
              minimum: 0,
              maximum: 5,
            },
          },
        },
      },
      {
        ready: true,
        version: 'parameter-ranking',
        kind: 'ranking',
        artifactDigest: `${prefix}-parameter-ranking`,
        featureSchemaVersion: 'ranking-numeric-v1',
        parameterSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pricePenalty: {
              type: 'number',
              title: '价格惩罚',
              default: 0,
              minimum: 0,
              maximum: 2,
            },
            temperature: {
              type: 'number',
              title: '温度',
              default: 1,
              minimum: 0.25,
              maximum: 4,
            },
          },
        },
      },
    ];
    for (const info of declarations) {
      fixtureModels.set(info.version, info);
      const registration = {
        name: `${prefix}-${info.version}`,
        kind: info.kind,
        provider: 'http',
        serviceVersion: info.version,
        artifactDigest: info.artifactDigest,
        featureSchemaVersion: info.featureSchemaVersion,
        ...('dimension' in info ? { dimension: info.dimension } : {}),
        deploymentId: 'synthetic',
      };
      await admin(
        'post',
        '/admin/recommendation/models',
        { ...registration, parameterSchema: info.parameterSchema },
        400,
      );
      const model = await admin(
        'post',
        '/admin/recommendation/models',
        registration,
      );
      models.push(model);
      const validSchema = info.parameterSchema;
      fixtureModels.set(info.version, {
        ...info,
        parameterSchema: { ...validSchema, additionalProperties: true },
      });
      await admin(
        'post',
        `/admin/recommendation/models/${model.id}/verify`,
        undefined,
        400,
      );
      expect(
        await prisma.recommendationModel.findUniqueOrThrow({
          where: { id: model.id },
        }),
      ).toMatchObject({ status: 'draft' });
      fixtureModels.set(info.version, info);
      await admin('post', `/admin/recommendation/models/${model.id}/verify`);
      const persisted = await prisma.recommendationModel.findUniqueOrThrow({
        where: { id: model.id },
      });
      expect(persisted).toMatchObject({
        status: 'ready',
        parameterSchema: validSchema,
      });
      if (info.kind === 'embedding') parameterEmbedding = persisted;
      else parameterRanker = persisted;
    }
    expect(
      (
        await prisma.recommendationModel.findUniqueOrThrow({
          where: { id: models[1].id },
        })
      ).parameterSchema,
    ).toEqual({ type: 'object', additionalProperties: false, properties: {} });
  });

  it('persists default and zero index parameters through vector construction, rebuild and query caching', async () => {
    for (const parameters of [
      { unknown: 1 },
      { numericWeight: -1 },
      { numericWeight: 6 },
      { numericWeight: false },
    ])
      await admin(
        'post',
        '/admin/recommendation/indexes',
        {
          name: `${prefix}-invalid-parameters`,
          modelVersionId: parameterEmbedding.id,
          parameters,
        },
        400,
      );
    const vectorDb = new PrismaClient({
      datasourceUrl: process.env.RECOMMENDATION_DATABASE_URL,
    });
    try {
      const dish = await prisma.dish.findFirstOrThrow({
        where: { canteenId },
        orderBy: { id: 'asc' },
      });
      const vectors: number[][] = [];
      for (const numericWeight of [1, 0]) {
        const index = await admin('post', '/admin/recommendation/indexes', {
          name: `${prefix}-weight-${numericWeight}`,
          modelVersionId: parameterEmbedding.id,
          ...(numericWeight === 0 ? { parameters: { numericWeight: 0 } } : {}),
        });
        indexes.push(index);
        parameterIndexes.push(index);
        expect(
          (
            await prisma.recommendationIndex.findUniqueOrThrow({
              where: { id: index.id },
            })
          ).parameters,
        ).toEqual({ numericWeight });
        const start = parameterCalls.length;
        for (let attempt = 0; attempt < 20; attempt++) {
          const progress = await sync.syncIndex(index.id, 1000);
          if (progress.pending === 0) break;
        }
        expect(
          await prisma.recommendationIndex.findUniqueOrThrow({
            where: { id: index.id },
          }),
        ).toMatchObject({ status: 'ready', parameters: { numericWeight } });
        const builds = parameterCalls
          .slice(start)
          .filter(
            (call) =>
              call.path === '/embed' &&
              call.payload.version === 'parameter-embedding',
          );
        expect(builds.length).toBeGreaterThanOrEqual(12);
        expect(
          builds.every(
            (call) => call.payload.parameters.numericWeight === numericWeight,
          ),
        ).toBe(true);
        const rows = await vectorDb.$queryRawUnsafe<{ embedding: string }[]>(
          `SELECT embedding::text AS embedding FROM ${indexTable(index.id)} WHERE dish_id = $1`,
          dish.id,
        );
        const vector = JSON.parse(rows[0].embedding);
        expect(vector[0]).toBe(1);
        expect(vector[1]).toBeCloseTo((numericWeight * dish.price) / 50);
        vectors.push(vector);
      }
      expect(vectors[0]).not.toEqual(vectors[1]);
      const queryStrategies = [] as any[];
      for (const index of parameterIndexes)
        queryStrategies.push(
          await publish(
            `query-${index.id}`,
            config(index.id, undefined, strategies[0].id),
          ),
        );
      const queryStart = parameterCalls.length;
      const preview = async (strategy: any) =>
        admin('post', '/admin/recommendation/preview', {
          userId,
          strategyRevisionId: strategy.id,
          filter: { canteenId: [canteenId] },
          pageSize: 3,
        });
      for (const strategy of queryStrategies) {
        const result = await preview(strategy);
        expect(result.strategyRevisionId).toBe(strategy.id);
        expect(result.fallbackReason).toBeUndefined();
        expect(result.items).toHaveLength(3);
      }
      const queries = parameterCalls
        .slice(queryStart)
        .filter((call) => call.path === '/embed');
      expect(queries.map((call) => call.payload.parameters)).toEqual([
        { numericWeight: 1 },
        { numericWeight: 0 },
      ]);
      const cachedCount = parameterCalls.filter(
        (call) => call.path === '/embed',
      ).length;
      await preview(queryStrategies[0]);
      expect(
        parameterCalls.filter((call) => call.path === '/embed'),
      ).toHaveLength(cachedCount);
      const rebuilt = await admin(
        'post',
        `/admin/recommendation/indexes/${parameterIndexes[1].id}/build`,
      );
      expect(rebuilt.parameters).toEqual({ numericWeight: 0 });
      const rebuildStart = parameterCalls.length;
      for (let attempt = 0; attempt < 20; attempt++) {
        const progress = await sync.syncIndex(parameterIndexes[1].id, 1000);
        if (progress.pending === 0) break;
      }
      expect(
        (
          await prisma.recommendationIndex.findUniqueOrThrow({
            where: { id: parameterIndexes[1].id },
          })
        ).parameters,
      ).toEqual({ numericWeight: 0 });
      const rebuiltCalls = parameterCalls
        .slice(rebuildStart)
        .filter((call) => call.path === '/embed');
      expect(rebuiltCalls.length).toBeGreaterThanOrEqual(12);
      expect(
        rebuiltCalls.every(
          (call) => call.payload.parameters.numericWeight === 0,
        ),
      ).toBe(true);
    } finally {
      await vectorDb.$disconnect();
    }
  });

  it('binds ranking parameters to immutable strategy digests and restores a previous published strategy', async () => {
    const rankConfig = (parameters?: object) => {
      const value = config(
        parameterIndexes[0].id,
        parameterRanker.id,
        strategies[0].id,
      );
      return {
        ...value,
        ranking: { ...value.ranking, ...(parameters ? { parameters } : {}) },
      };
    };
    for (const parameters of [
      { unknown: 1 },
      { pricePenalty: 3 },
      { pricePenalty: -1 },
      { temperature: 0 },
      { temperature: false },
    ])
      await admin(
        'post',
        '/admin/recommendation/strategies',
        {
          name: `${prefix}-invalid-ranker`,
          scene: 'home',
          config: rankConfig(parameters),
        },
        400,
      );
    const defaultRank = await publish('rank-default', rankConfig());
    const zeroRank = await publish(
      'rank-zero',
      rankConfig({ pricePenalty: 0 }),
    );
    const penalizedRank = await publish(
      'rank-penalized',
      rankConfig({ pricePenalty: 2 }),
    );
    for (const [strategy, pricePenalty] of [
      [defaultRank, 0],
      [zeroRank, 0],
      [penalizedRank, 2],
    ] as const) {
      const persisted = await prisma.recommendationStrategy.findUniqueOrThrow({
        where: { id: strategy.id },
      });
      expect((persisted.config as any).ranking.parameters).toEqual({
        temperature: 1,
        pricePenalty,
      });
      expect(persisted.digest).toBe(
        digest({ scene: 'home', config: persisted.config }),
      );
    }
    expect(defaultRank.digest).toBe(zeroRank.digest);
    expect(defaultRank.digest).not.toBe(penalizedRank.digest);
    await admin(
      'put',
      `/admin/recommendation/strategies/${defaultRank.id}`,
      { config: rankConfig({ pricePenalty: 2 }) },
      409,
    );
    const results: any[] = [];
    for (const [strategy, pricePenalty] of [
      [defaultRank, 0],
      [penalizedRank, 2],
      [defaultRank, 0],
    ] as const) {
      await setDefault(strategy);
      const start = parameterCalls.length;
      const result = await recommend();
      expect(result).toMatchObject({
        strategyRevisionId: strategy.id,
        rankerVersionId: parameterRanker.id,
      });
      expect(result.fallbackReason).toBeUndefined();
      const rankCalls = parameterCalls
        .slice(start)
        .filter((call) => call.path === '/rank');
      expect(rankCalls).toHaveLength(1);
      expect(rankCalls[0].payload.parameters).toEqual({
        pricePenalty,
        temperature: 1,
      });
      const prices = new Map(
        rankCalls[0].payload.candidates.map((candidate: any) => [
          candidate.dishId,
          candidate.price,
        ]),
      );
      const scores = result.items.map((item: any) => ({
        id: item.id,
        price: prices.get(item.id) as number,
      }));
      expect(scores[0].price).toBe(
        pricePenalty === 0
          ? Math.max(
              ...rankCalls[0].payload.candidates.map(
                (candidate: any) => candidate.price,
              ),
            )
          : Math.min(
              ...rankCalls[0].payload.candidates.map(
                (candidate: any) => candidate.price,
              ),
            ),
      );
      results.push(result);
    }
    expect(results[0].items.map((item: any) => item.id)).not.toEqual(
      results[1].items.map((item: any) => item.id),
    );
    expect(results[0].items.map((item: any) => item.id)).toEqual(
      results[2].items.map((item: any) => item.id),
    );
    await setDefault(strategies[2]);
    const legacy = await recommend();
    expect(legacy).toMatchObject({
      strategyRevisionId: strategies[2].id,
      rankerVersionId: models[3].id,
    });
    expect(legacy.fallbackReason).toBeUndefined();
  });
});
