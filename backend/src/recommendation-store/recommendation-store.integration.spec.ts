import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { migrateRecommendationStore } from '../../scripts/recommendation-store-migrate';
import { PrismaService } from '../prisma.service';
import { ModelRuntimeService } from '../recommendation-platform/model-runtime.service';
import { RecommendationCatalogService } from '../recommendation-platform/catalog.service';
import { RecommendationIndexSyncService } from './recommendation-index-sync.service';
import {
  indexTable,
  RecommendationStoreService,
} from './recommendation-store.service';

const businessUrl = process.env.RECOMMENDATION_TEST_BUSINESS_URL;
const storeUrl = process.env.RECOMMENDATION_TEST_STORE_URL;
const integration = businessUrl && storeUrl ? describe : describe.skip;

// Explicit isolated URLs are required; business migrations must be deployed before running.
integration('Recommendation projection and pgvector integration', () => {
  let business: PrismaClient;
  let vectors: PrismaClient;
  let store: RecommendationStoreService;
  let sync: RecommendationIndexSyncService;
  let catalog: RecommendationCatalogService;
  const prefix = `rec-test-${randomUUID()}`;
  const modelId = `${prefix}-model`;
  const canteenId = `${prefix}-canteen`;
  const windowId = `${prefix}-window`;
  let sequence = 0;
  const runtime = {
    generateDish: jest.fn<
      Promise<number[]>,
      [unknown, Record<string, unknown>]
    >(() => Promise.resolve([1, 0, 0])),
  };
  const indexes: string[] = [];

  async function newIndex() {
    const id = `${prefix}-index-${sequence++}`;
    indexes.push(id);
    await business.recommendationIndex.create({
      data: { id, name: id, modelVersionId: modelId },
    });
    return id;
  }
  async function newDish() {
    return business.dish.create({
      data: {
        id: `${prefix}-dish-${sequence++}`,
        name: 'Test dish',
        price: 10,
        tags: [],
        images: [],
        ingredients: [],
        allergens: [],
        availableMealTime: ['lunch'],
        canteenId,
        canteenName: 'Cached canteen',
        windowId,
        windowName: 'Cached window',
      },
    });
  }

  beforeAll(async () => {
    if (businessUrl === storeUrl)
      throw new Error('The integration suite requires separate databases');
    business = new PrismaClient({ datasourceUrl: businessUrl });
    vectors = new PrismaClient({ datasourceUrl: storeUrl });
    await migrateRecommendationStore(storeUrl!);
    await migrateRecommendationStore(storeUrl!);
    store = new RecommendationStoreService(
      new ConfigService({ RECOMMENDATION_DATABASE_URL: storeUrl }),
    );
    sync = new RecommendationIndexSyncService(
      business as PrismaService,
      runtime as unknown as ModelRuntimeService,
      store,
    );
    catalog = new RecommendationCatalogService(
      business as PrismaService,
      new ConfigService(),
      store,
      sync,
      runtime as unknown as ModelRuntimeService,
    );
    await business.recommendationModel.create({
      data: {
        id: modelId,
        name: modelId,
        kind: 'embedding',
        provider: 'local',
        serviceVersion: 'test-v1',
        artifactDigest: 'test-v1',
        featureSchemaVersion: 'test-v1',
        dimension: 3,
        status: 'ready',
      },
    });
    await business.canteen.create({
      data: {
        id: canteenId,
        name: 'Actual canteen',
        images: [],
        openingHours: {},
      },
    });
    await business.window.create({
      data: {
        id: windowId,
        canteenId,
        name: 'Actual window',
        number: '1',
        tags: [],
      },
    });
  }, 30000);

  afterAll(async () => {
    if (!business) return;
    await business.dish.deleteMany({ where: { id: { startsWith: prefix } } });
    await business.window.deleteMany({ where: { id: { startsWith: prefix } } });
    await business.canteen.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    await business.recommendationIndex.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    await business.recommendationProjection.deleteMany({
      where: { dishId: { startsWith: prefix } },
    });
    await business.recommendationModel.deleteMany({ where: { id: modelId } });
    for (const id of indexes) await store.dropIndex(id);
    await Promise.all([
      store.onApplicationShutdown(),
      business.$disconnect(),
      vectors.$disconnect(),
    ]);
  }, 30000);

  it('isolates dimensions, preserves tombstones, parameterizes filters and uses HNSW', async () => {
    const a = `${prefix}-vector-a`,
      b = `${prefix}-vector-b`;
    indexes.push(a, b);
    await store.createIndex(a, 3);
    await store.createIndex(b, 4);
    await expect(store.createIndex(a, 4)).rejects.toThrow('immutable');
    await store.upsert(a, {
      dishId: 'same',
      sourceRevision: 2n,
      embedding: [1, 0, 0],
      filterPayload: { canteenId: "x' OR true --" },
    });
    await store.upsert(b, {
      dishId: 'same',
      sourceRevision: 1n,
      embedding: [1, 0, 0, 0],
    });
    expect(
      (
        await store.search(a, [1, 0, 0], 10, { canteenIds: ["x' OR true --"] })
      ).map((x) => x.dishId),
    ).toEqual(['same']);
    expect(
      await store.search(a, [1, 0, 0], 10, { canteenIds: ['other'] }),
    ).toEqual([]);
    expect(
      await store.search(a, [1, 0, 0], 10, { excludeDishIds: ['same'] }),
    ).toEqual([]);
    await store.upsert(a, {
      dishId: 'same',
      sourceRevision: 3n,
      deleted: true,
    });
    await store.upsert(a, {
      dishId: 'same',
      sourceRevision: 2n,
      embedding: [1, 0, 0],
    });
    expect(await store.count(a)).toBe(0);
    expect(await store.count(b)).toBe(1);
    await expect(store.search(b, [1, 0, 0], 10)).rejects.toThrow('dimension');
    const plan = await vectors.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
      return tx.$queryRawUnsafe(
        `EXPLAIN SELECT dish_id FROM ${indexTable(b)} WHERE NOT deleted ORDER BY embedding <=> '[1,0,0,0]'::vector LIMIT 10`,
      );
    });
    expect(JSON.stringify(plan)).toContain('_hnsw');
    const [isolation] = await business.$queryRaw<
      { present: string | null }[]
    >`SELECT to_regclass('recommendation_store.indexes')::text AS present`;
    expect(isolation.present).toBeNull();
  });

  it('captures complete dish snapshots, related renames and transactional rollback', async () => {
    const dish = await newDish();
    const before = await business.recommendationProjection.findUniqueOrThrow({
      where: { dishId: dish.id },
    });
    expect(before.payload).toMatchObject({
      name: 'Test dish',
      canteenName: 'Actual canteen',
      windowName: 'Actual window',
    });
    await business.canteen.update({
      where: { id: canteenId },
      data: { name: 'Renamed canteen' },
    });
    await business.window.update({
      where: { id: windowId },
      data: { name: 'Renamed window' },
    });
    const renamed = await business.recommendationProjection.findUniqueOrThrow({
      where: { dishId: dish.id },
    });
    expect(renamed.revision).toBe(before.revision + 2n);
    expect(renamed.payload).toMatchObject({
      canteenName: 'Renamed canteen',
      windowName: 'Renamed window',
    });
    await expect(
      business.$transaction(async (tx) => {
        await tx.dish.update({
          where: { id: dish.id },
          data: { name: 'Rolled back' },
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      await business.recommendationProjection.findUnique({
        where: { dishId: dish.id },
      }),
    ).toEqual(renamed);
  });

  it('blocks ready on failures, retries and keeps ready indexes synchronized', async () => {
    const dish = await newDish();
    const id = await newIndex();
    runtime.generateDish.mockRejectedValueOnce(
      new Error('model temporarily unavailable'),
    );
    const failed = await sync.syncIndex(id);
    expect(failed.failed).toBe(1);
    expect(
      (await business.recommendationIndex.findUniqueOrThrow({ where: { id } }))
        .status,
    ).toBe('building');
    await sync.syncIndex(id);
    expect(
      (await business.recommendationIndex.findUniqueOrThrow({ where: { id } }))
        .status,
    ).toBe('ready');
    await business.dish.delete({ where: { id: dish.id } });
    const tombstone = await business.recommendationProjection.findUniqueOrThrow(
      { where: { dishId: dish.id } },
    );
    expect(tombstone.deleted).toBe(true);
    await sync.syncIndex(id);
    const [row] = await vectors.$queryRaw<
      { deleted: boolean; source_revision: bigint }[]
    >(
      Prisma.sql`SELECT deleted, source_revision FROM ${Prisma.raw(indexTable(id))} WHERE dish_id = ${dish.id}`,
    );
    expect(row).toEqual({ deleted: true, source_revision: tombstone.revision });
  });

  it('continues capturing a transaction that commits after the ready snapshot', async () => {
    const id = await newIndex();
    let release!: () => void;
    let inserted!: () => void;
    const insertedPromise = new Promise<void>((resolve) => {
      inserted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lateId = `${prefix}-late-${sequence++}`;
    const pendingTransaction = business.$transaction(
      async (tx) => {
        await tx.dish.create({
          data: {
            id: lateId,
            name: 'Late commit',
            price: 10,
            tags: [],
            images: [],
            ingredients: [],
            allergens: [],
            availableMealTime: [],
            canteenId,
            canteenName: '',
            windowName: '',
          },
        });
        inserted();
        await gate;
      },
      { timeout: 20000 },
    );
    await insertedPromise;
    try {
      await sync.syncIndex(id);
      expect(
        (
          await business.recommendationIndex.findUniqueOrThrow({
            where: { id },
          })
        ).status,
      ).toBe('ready');
    } finally {
      release();
    }
    await pendingTransaction;
    expect((await sync.progress(id)).pending).toBe(1);
    await sync.syncIndex(id);
    expect((await sync.progress(id)).pending).toBe(0);
  });

  it('does not acknowledge a newer projection when an in-flight older embedding finishes', async () => {
    const dish = await newDish();
    const id = await newIndex();
    let edited = false;
    runtime.generateDish.mockImplementation(async (_model, payload) => {
      if (payload.id === dish.id && !edited) {
        edited = true;
        await business.dish.update({
          where: { id: dish.id },
          data: { name: 'Edited during build' },
        });
      }
      return [1, 0, 0];
    });
    await sync.syncIndex(id);
    expect((await sync.progress(id)).pending).toBe(1);
    expect(
      (await business.recommendationIndex.findUniqueOrThrow({ where: { id } }))
        .status,
    ).toBe('building');
    await sync.syncIndex(id);
    expect((await sync.progress(id)).pending).toBe(0);
    runtime.generateDish.mockImplementation(() => Promise.resolve([1, 0, 0]));
  });
  it('keeps the latest acknowledgement when an old worker finishes after deletion', async () => {
    const dish = await newDish();
    const id = await newIndex();
    await sync.syncIndex(id);
    await business.dish.update({
      where: { id: dish.id },
      data: { name: 'Delayed embedding' },
    });
    let started!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let blocked = false;
    runtime.generateDish.mockImplementation(async (_model, payload) => {
      if (payload.id === dish.id && !blocked) {
        blocked = true;
        started();
        await gate;
      }
      return [1, 0, 0];
    });
    const oldWorker = sync.syncIndex(id);
    await entered;
    try {
      await business.dish.update({
        where: { id: dish.id },
        data: { name: 'New embedding' },
      });
      await sync.syncIndex(id);
      await business.dish.delete({ where: { id: dish.id } });
      await sync.syncIndex(id);
    } finally {
      release();
    }
    await oldWorker;
    runtime.generateDish.mockImplementation(() => Promise.resolve([1, 0, 0]));
    const projection =
      await business.recommendationProjection.findUniqueOrThrow({
        where: { dishId: dish.id },
      });
    const ack = await business.recommendationIndexTask.findUniqueOrThrow({
      where: { indexId_dishId: { indexId: id, dishId: dish.id } },
    });
    const [stored] = await vectors.$queryRaw<
      { source_revision: bigint; deleted: boolean }[]
    >(
      Prisma.sql`SELECT source_revision, deleted FROM ${Prisma.raw(indexTable(id))} WHERE dish_id = ${dish.id}`,
    );
    expect(ack.revision).toBe(projection.revision);
    expect(stored).toEqual({
      source_revision: projection.revision,
      deleted: true,
    });
    expect((await sync.progress(id)).pending).toBe(0);
  });

  it('serializes overlapping dish and canteen transactions into a complete latest snapshot', async () => {
    const dish = await newDish();
    let release!: () => void;
    let changed!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const change = new Promise<void>((resolve) => {
      changed = resolve;
    });
    const first = business.$transaction(
      async (tx) => {
        await tx.dish.update({
          where: { id: dish.id },
          data: { name: 'Concurrent dish' },
        });
        changed();
        await gate;
      },
      { timeout: 20000 },
    );
    await change;
    let secondPid!: number;
    let pidReady!: () => void;
    const pidPromise = new Promise<void>((resolve) => {
      pidReady = resolve;
    });
    const second = business.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;
        secondPid = row.pid;
        pidReady();
        await tx.canteen.update({
          where: { id: canteenId },
          data: { name: 'Concurrent canteen' },
        });
      },
      { timeout: 20000 },
    );
    await pidPromise;
    try {
      const deadline = Date.now() + 5000;
      let waiting = false;
      while (Date.now() < deadline) {
        const [activity] = await business.$queryRaw<
          { wait_event: string }[]
        >`SELECT wait_event FROM pg_stat_activity WHERE pid = ${secondPid}`;
        if (activity.wait_event === 'advisory') {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
    } finally {
      release();
    }
    await Promise.all([first, second]);
    const latest = await business.recommendationProjection.findUniqueOrThrow({
      where: { dishId: dish.id },
    });
    expect(latest.payload).toMatchObject({
      name: 'Concurrent dish',
      canteenName: 'Concurrent canteen',
    });
  });
  async function raceParents() {
    const suffix = sequence++;
    const canteen = await business.canteen.create({
      data: {
        id: `${prefix}-race-canteen-${suffix}`,
        name: 'Before canteen',
        images: [],
        openingHours: {},
      },
    });
    const window = await business.window.create({
      data: {
        id: `${prefix}-race-window-${suffix}`,
        canteenId: canteen.id,
        name: 'Before window',
        number: '1',
        tags: [],
      },
    });
    return { canteen, window };
  }

  async function overlapTransactions(
    firstWork: (tx: Prisma.TransactionClient) => Promise<unknown>,
    secondWork: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const firstEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = business.$transaction(
      async (tx) => {
        await firstWork(tx);
        entered();
        await gate;
      },
      { timeout: 20000 },
    );
    await firstEntered;
    let secondPid!: number;
    let signalPid!: () => void;
    const pidReady = new Promise<void>((resolve) => {
      signalPid = resolve;
    });
    let secondFinished = false;
    const second = business
      .$transaction(
        async (tx) => {
          const [row] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          secondPid = row.pid;
          signalPid();
          return secondWork(tx);
        },
        { timeout: 20000 },
      )
      .finally(() => {
        secondFinished = true;
      });
    // A transaction can fail while the other remains open; collect it immediately.
    const results = Promise.allSettled([first, second]);
    await pidReady;
    let blocked = false;
    try {
      const deadline = Date.now() + 5000;
      while (!secondFinished && Date.now() < deadline) {
        const [activity] = await business.$queryRaw<
          { wait_event_type: string }[]
        >`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${secondPid}`;
        if (activity?.wait_event_type === 'Lock') {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      if (!secondFinished && !blocked)
        throw new Error(
          'Concurrent transaction neither completed nor reached its lock',
        );
    } finally {
      release();
    }
    return { blocked, results: await results };
  }

  it.each([
    ['canteen', 'insert', 'membership-first'],
    ['window', 'insert', 'membership-first'],
    ['canteen', 'move', 'membership-first'],
    ['window', 'move', 'membership-first'],
    ['canteen', 'insert', 'rename-first'],
    ['window', 'insert', 'rename-first'],
    ['canteen', 'move', 'rename-first'],
    ['window', 'move', 'rename-first'],
  ] as const)(
    'captures %s rename concurrent with %s (%s)',
    async (entity, mutation, order) => {
      const { canteen, window } = await raceParents();
      const dishId =
        mutation === 'move'
          ? (await newDish()).id
          : `${prefix}-race-dish-${sequence++}`;
      const changeMembership = (tx: Prisma.TransactionClient) =>
        mutation === 'insert'
          ? tx.dish.create({
              data: {
                id: dishId,
                name: 'Concurrent member',
                price: 10,
                tags: [],
                images: [],
                ingredients: [],
                allergens: [],
                availableMealTime: [],
                canteenId: canteen.id,
                canteenName: 'Cached name',
                windowId: window.id,
                windowName: 'Cached window',
              },
            })
          : tx.dish.update({
              where: { id: dishId },
              data: { canteenId: canteen.id, windowId: window.id },
            });
      const rename = (tx: Prisma.TransactionClient) =>
        entity === 'canteen'
          ? tx.canteen.update({
              where: { id: canteen.id },
              data: { name: 'After canteen' },
            })
          : tx.window.update({
              where: { id: window.id },
              data: { name: 'After window' },
            });
      const { results, blocked } = await overlapTransactions(
        order === 'membership-first' ? changeMembership : rename,
        order === 'membership-first' ? rename : changeMembership,
      );
      expect(results.map((result) => result.status)).toEqual([
        'fulfilled',
        'fulfilled',
      ]);
      const projection =
        await business.recommendationProjection.findUniqueOrThrow({
          where: { dishId },
        });
      expect(projection.payload).toMatchObject({
        canteenId: canteen.id,
        windowId: window.id,
        [entity === 'canteen' ? 'canteenName' : 'windowName']:
          entity === 'canteen' ? 'After canteen' : 'After window',
      });
      expect(blocked).toBe(true);
    },
  );
  it.each([
    ['canteen', 'insert', 'membership-first'],
    ['window', 'insert', 'membership-first'],
    ['canteen', 'move', 'membership-first'],
    ['window', 'move', 'membership-first'],
    ['canteen', 'insert', 'delete-first'],
    ['window', 'insert', 'delete-first'],
    ['canteen', 'move', 'delete-first'],
    ['window', 'move', 'delete-first'],
  ] as const)(
    'preserves FK and projection consistency for %s deletion with %s (%s)',
    async (entity, mutation, order) => {
      const target = await raceParents();
      const dishId =
        mutation === 'move'
          ? (await newDish()).id
          : `${prefix}-delete-race-dish-${sequence++}`;
      const original = await business.recommendationProjection.findUnique({
        where: { dishId },
      });
      const membership = (tx: Prisma.TransactionClient, parents = target) =>
        mutation === 'insert'
          ? tx.dish.create({
              data: {
                id: dishId,
                name: 'Concurrent member',
                price: 10,
                tags: [],
                images: [],
                ingredients: [],
                allergens: [],
                availableMealTime: [],
                canteenId: parents.canteen.id,
                canteenName: 'Cached name',
                windowId: parents.window.id,
                windowName: 'Cached window',
              },
            })
          : tx.dish.update({
              where: { id: dishId },
              data: {
                canteenId: parents.canteen.id,
                windowId: parents.window.id,
              },
            });
      const remove = (tx: Prisma.TransactionClient) =>
        entity === 'canteen'
          ? tx.canteen.delete({ where: { id: target.canteen.id } })
          : tx.window.delete({ where: { id: target.window.id } });
      const { results, blocked } = await overlapTransactions(
        order === 'membership-first' ? (tx) => membership(tx) : remove,
        order === 'membership-first' ? remove : (tx) => membership(tx),
      );
      expect(blocked).toBe(true);
      expect(results[0].status).toBe('fulfilled');
      if (order === 'membership-first' && entity === 'canteen') {
        expect(results[1].status).toBe('fulfilled');
        expect(
          await business.dish.findUnique({ where: { id: dishId } }),
        ).toBeNull();
        expect(
          await business.recommendationProjection.findUniqueOrThrow({
            where: { dishId },
          }),
        ).toMatchObject({ deleted: true, payload: null });
      } else if (order === 'membership-first') {
        expect(results[1].status).toBe('fulfilled');
        expect(
          await business.window.findUnique({ where: { id: target.window.id } }),
        ).toBeNull();
        expect(
          await business.dish.findUniqueOrThrow({ where: { id: dishId } }),
        ).toMatchObject({ windowId: null });
        expect(
          await business.recommendationProjection.findUniqueOrThrow({
            where: { dishId },
          }),
        ).toMatchObject({
          deleted: false,
          payload: { windowId: null, canteenId: target.canteen.id },
        });
      } else {
        expect(results[1]).toMatchObject({
          status: 'rejected',
          reason: { code: 'P2003' },
        });
        expect(
          await business.recommendationProjection.findUnique({
            where: { dishId },
          }),
        ).toEqual(original);
        const liveParents = await raceParents();
        await business.$transaction((tx) => membership(tx, liveParents));
        expect(
          (
            await business.recommendationProjection.findUniqueOrThrow({
              where: { dishId },
            })
          ).payload,
        ).toMatchObject({
          canteenId: liveParents.canteen.id,
          windowId: liveParents.window.id,
        });
      }
    },
  );

  it('locks opposite parent moves in the same order', async () => {
    const a = await raceParents(),
      b = await raceParents();
    const first = await newDish(),
      second = await newDish();
    await business.dish.update({
      where: { id: first.id },
      data: { canteenId: a.canteen.id, windowId: a.window.id },
    });
    await business.dish.update({
      where: { id: second.id },
      data: { canteenId: b.canteen.id, windowId: b.window.id },
    });
    const { results, blocked } = await overlapTransactions(
      (tx) =>
        tx.dish.update({
          where: { id: first.id },
          data: { canteenId: b.canteen.id, windowId: b.window.id },
        }),
      (tx) =>
        tx.dish.update({
          where: { id: second.id },
          data: { canteenId: a.canteen.id, windowId: a.window.id },
        }),
    );
    expect(blocked).toBe(true);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ]);
    expect(
      (
        await business.recommendationProjection.findUniqueOrThrow({
          where: { dishId: first.id },
        })
      ).payload,
    ).toMatchObject({ canteenId: b.canteen.id, windowId: b.window.id });
    expect(
      (
        await business.recommendationProjection.findUniqueOrThrow({
          where: { dishId: second.id },
        })
      ).payload,
    ).toMatchObject({ canteenId: a.canteen.id, windowId: a.window.id });
  });
  it.each(['empty', 'older'] as const)(
    'replays every projection after restoring an %s vector store',
    async (restore) => {
      const id = await newIndex();
      const changed = await newDish(),
        deleted = await newDish();
      await sync.syncIndex(id);
      const table = indexTable(id),
        backup = `${table}_backup`;
      await vectors.$executeRawUnsafe(
        `CREATE TABLE ${backup} AS SELECT * FROM ${table}`,
      );
      try {
        await business.dish.update({
          where: { id: changed.id },
          data: { name: 'Post-backup update' },
        });
        await business.dish.delete({ where: { id: deleted.id } });
        const added = await newDish();
        await sync.syncIndex(id);
        expect((await sync.progress(id)).pending).toBe(0);
        await vectors.$executeRawUnsafe(`TRUNCATE TABLE ${table}`);
        if (restore === 'older')
          await vectors.$executeRawUnsafe(
            `INSERT INTO ${table} SELECT * FROM ${backup}`,
          );
        else expect(await store.count(id)).toBe(0);
        const before = await business.recommendationIndex.findUniqueOrThrow({
          where: { id },
        });
        const rebuilding = await catalog.rebuildIndex(id);
        expect(rebuilding).toMatchObject({
          status: 'building',
          generation: before.generation + 1,
        });
        expect(
          await business.recommendationIndexTask.count({
            where: { indexId: id },
          }),
        ).toBe(0);
        expect((await sync.progress(id)).pending).toBeGreaterThan(0);
        await sync.syncIndex(id);
        expect((await sync.progress(id)).pending).toBe(0);
        expect(
          (
            await business.recommendationIndex.findUniqueOrThrow({
              where: { id },
            })
          ).status,
        ).toBe('ready');
        for (const dishId of [changed.id, deleted.id, added.id]) {
          const projection =
            await business.recommendationProjection.findUniqueOrThrow({
              where: { dishId },
            });
          const [record] = await vectors.$queryRaw<
            { source_revision: bigint; deleted: boolean }[]
          >(
            Prisma.sql`SELECT source_revision, deleted FROM ${Prisma.raw(table)} WHERE dish_id = ${dishId}`,
          );
          expect(record).toEqual({
            source_revision: projection.revision,
            deleted: projection.deleted,
          });
        }
      } finally {
        await vectors.$executeRawUnsafe(`DROP TABLE ${backup}`);
      }
    },
  );

  it.each(['success', 'failure'] as const)(
    'fences a late %s from the previous index generation',
    async (outcome) => {
      const dish = await newDish();
      const id = await newIndex();
      await sync.syncIndex(id);
      await business.dish.update({
        where: { id: dish.id },
        data: { name: 'Old worker input' },
      });
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      runtime.generateDish.mockImplementation(async (_model, payload) => {
        if (payload.id === dish.id) {
          entered();
          await gate;
          if (outcome === 'failure')
            throw new Error('obsolete generation failure');
        }
        return [1, 0, 0];
      });
      const oldWorker = sync.syncIndex(id);
      await started;
      let rebuilding;
      try {
        await store.dropIndex(id);
        rebuilding = await catalog.rebuildIndex(id);
        await store.createIndex(id, 3);
      } finally {
        release();
      }
      await oldWorker;
      runtime.generateDish.mockImplementation(() => Promise.resolve([1, 0, 0]));
      expect(
        await business.recommendationIndexTask.count({
          where: { indexId: id },
        }),
      ).toBe(0);
      expect(
        await business.recommendationIndex.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        generation: rebuilding!.generation,
        status: 'building',
        lastError: null,
        lastSyncedAt: rebuilding!.lastSyncedAt,
      });
      await sync.syncIndex(id);
      expect((await sync.progress(id)).pending).toBe(0);
      expect(
        (
          await business.recommendationIndex.findUniqueOrThrow({
            where: { id },
          })
        ).status,
      ).toBe('ready');
    },
  );
  it('retries a Serializable rebuild that races an acknowledgement without retaining its old task', async () => {
    const id = await newIndex(),
      dish = await newDish();
    await sync.syncIndex(id);
    await business.dish.update({
      where: { id: dish.id },
      data: { name: 'Concurrent rebuild input' },
    });
    const workerUrl = new URL(businessUrl!),
      rebuildUrl = new URL(businessUrl!);
    workerUrl.searchParams.set('application_name', `${prefix}-epoch-worker`);
    rebuildUrl.searchParams.set('application_name', `${prefix}-epoch-rebuild`);
    workerUrl.searchParams.set('connection_limit', '1');
    rebuildUrl.searchParams.set('connection_limit', '1');
    const workerDatabase = new PrismaClient({
      datasourceUrl: workerUrl.toString(),
    });
    const rebuildDatabase = new PrismaClient({
      datasourceUrl: rebuildUrl.toString(),
    });
    const worker = new RecommendationIndexSyncService(
      workerDatabase as PrismaService,
      runtime as unknown as ModelRuntimeService,
      store,
    );
    const rebuildingCatalog = new RecommendationCatalogService(
      rebuildDatabase as PrismaService,
      new ConfigService(),
      store,
      sync,
      runtime as unknown as ModelRuntimeService,
    );
    const transactions = jest.spyOn(rebuildDatabase, '$transaction');
    let locked!: () => void, release!: () => void;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocker = business.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM recommendation_indexes WHERE id = ${id} FOR UPDATE`;
        locked();
        await gate;
      },
      { timeout: 20000 },
    );
    async function waitForLock(application: string) {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const rows = await business.$queryRaw<
          { waiting: boolean }[]
        >`SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE application_name = ${application}`;
        if (rows.some((row) => row.waiting)) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`Expected ${application} to wait for the index row lock`);
    }
    await acquired;
    let oldWorker: Promise<unknown> | undefined,
      rebuild: Promise<unknown> | undefined;
    try {
      oldWorker = worker.syncIndex(id);
      await waitForLock(`${prefix}-epoch-worker`);
      rebuild = rebuildingCatalog.rebuildIndex(id);
      await waitForLock(`${prefix}-epoch-rebuild`);
      release();
      await Promise.all([blocker, oldWorker, rebuild]);
      expect(transactions.mock.calls.length).toBeGreaterThan(1);
      expect(
        await business.recommendationIndex.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({ generation: 1, status: 'building' });
      expect(
        await business.recommendationIndexTask.count({
          where: { indexId: id },
        }),
      ).toBe(0);
      await sync.syncIndex(id);
      expect((await sync.progress(id)).pending).toBe(0);
    } finally {
      release();
      await Promise.allSettled(
        [blocker, oldWorker, rebuild].filter(
          (operation): operation is Promise<unknown> => operation !== undefined,
        ),
      );
      transactions.mockRestore();
      await Promise.all([
        workerDatabase.$disconnect(),
        rebuildDatabase.$disconnect(),
      ]);
    }
  }, 20000);
});
