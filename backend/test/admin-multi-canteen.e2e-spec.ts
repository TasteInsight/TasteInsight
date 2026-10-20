import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import {
  ALL_PERMISSIONS,
  GLOBAL_ONLY_PERMISSIONS,
} from '@/auth/permissions.constants';

jest.setTimeout(30000);

describe('multi-canteen administrator boundaries (PostgreSQL)', () => {
  const prefix = `scope-${randomUUID().slice(0, 8)}`;
  let app: INestApplication;
  let db: PrismaService;
  let globalToken: string;
  let managerToken: string;
  let managerId: string;
  let rootId: string;
  const canteens: string[] = [];
  const windows: string[] = [];
  const dishes: string[] = [];
  const admins: string[] = [];
  const news: string[] = [];
  const permissions = ALL_PERMISSIONS.filter(
    (permission) => !GLOBAL_ONLY_PERMISSIONS.includes(permission),
  );
  const auth = (
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    token = managerToken,
  ) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`);
  const grant = (
    scope: 'GLOBAL' | 'CANTEENS',
    canteenIds: string[],
    extra = {},
  ) => ({ scope, canteenIds, permissions: ['dish:view'], ...extra });

  async function waitForGrantLock(expected = 1) {
    for (let i = 0; i < 100; i++) {
      const rows = await db.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND (query LIKE '%FROM admins WHERE id%FOR UPDATE%' OR query LIKE '%tasteinsight.admin-hierarchy%')`;
      if (Number(rows[0].count) >= expected) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Authorization request did not reach its transaction lock');
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
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
    db = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const secret = app.get(ConfigService).get<string>('JWT_SECRET');
    for (let i = 0; i < 3; i++) {
      const canteen = await db.canteen.create({
        data: { name: `${prefix}-${i}`, openingHours: [] },
      });
      canteens.push(canteen.id);
      const window = await db.window.create({
        data: { canteenId: canteen.id, name: '窗口', number: '1' },
      });
      windows.push(window.id);
      const dish = await db.dish.create({
        data: {
          name: prefix,
          price: 10,
          canteenId: canteen.id,
          canteenName: canteen.name,
          windowId: window.id,
          windowName: '窗口',
        },
      });
      dishes.push(dish.id);
    }
    const root = await db.admin.create({
      data: {
        username: `${prefix}-root`,
        password: 'unused',
        role: 'superadmin',
        scope: 'GLOBAL',
      },
    });
    rootId = root.id;
    admins.push(root.id);
    const manager = await db.admin.create({
      data: {
        username: `${prefix}-manager`,
        password: 'unused',
        role: 'admin',
        scope: 'CANTEENS',
        createdBy: root.id,
        managerId: root.id,
        canteens: {
          create: canteens.slice(0, 2).map((canteenId) => ({ canteenId })),
        },
        permissions: {
          create: permissions.map((permission) => ({ permission })),
        },
      },
    });
    managerId = manager.id;
    admins.push(manager.id);
    globalToken = jwt.sign(
      { sub: rootId, type: 'admin', sessionVersion: 0, tokenUse: 'access' },
      { secret },
    );
    managerToken = jwt.sign(
      {
        sub: managerId,
        type: 'admin',
        sessionVersion: 0,
        tokenUse: 'access',
        scope: 'GLOBAL',
      },
      { secret },
    );
    for (const canteenId of canteens) {
      const row = await db.news.create({
        data: {
          title: prefix,
          content: prefix,
          canteenId,
          createdBy: rootId,
          status: 'draft',
        },
      });
      news.push(row.id);
    }
  });

  afterAll(async () => {
    if (db) {
      await db.operationLog.deleteMany({ where: { adminId: { in: admins } } });
      await db.news.deleteMany({ where: { createdBy: { in: admins } } });
      await db.dishUpload.deleteMany({
        where: { canteenId: { in: canteens } },
      });
      await db.dish.deleteMany({ where: { canteenId: { in: canteens } } });
      await db.adminConfig.deleteMany({
        where: { canteenId: { in: canteens } },
      });
      await db.admin.updateMany({
        where: { id: { in: admins } },
        data: { createdBy: null },
      });
      await db.admin.deleteMany({ where: { id: { in: admins } } });
      await db.canteen.deleteMany({ where: { id: { in: canteens } } });
    }
    await app?.close();
  });

  it('migrates legacy global and single-canteen accounts and keeps new empty scopes closed', async () => {
    await db.$transaction(async (tx) => {
      const schema = `scope_migration_${randomUUID().replaceAll('-', '')}`;
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE canteens (id TEXT PRIMARY KEY)');
      await tx.$executeRawUnsafe(
        'CREATE TABLE admins (id TEXT PRIMARY KEY, "canteenId" TEXT, CONSTRAINT "admins_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES canteens(id) ON DELETE RESTRICT)',
      );
      await tx.$executeRawUnsafe("INSERT INTO canteens VALUES ('c1')");
      await tx.$executeRawUnsafe(
        "INSERT INTO admins VALUES ('root', NULL), ('single', 'c1')",
      );
      const sql = readFileSync(
        resolve(
          __dirname,
          '../prisma/migrations/20261017000100_admin_multi_canteen_scope/migration.sql',
        ),
        'utf8',
      );
      for (const statement of sql
        .split(';')
        .map((value) => value.trim())
        .filter(Boolean))
        await tx.$executeRawUnsafe(statement);
      const rows = await tx.$queryRaw<
        { id: string; scope: string }[]
      >`SELECT id, scope::text FROM admins ORDER BY id`;
      expect(rows).toEqual([
        { id: 'root', scope: 'GLOBAL' },
        { id: 'single', scope: 'CANTEENS' },
      ]);
      expect(await tx.$queryRaw`SELECT * FROM "_AdminCanteens"`).toEqual([
        { A: 'single', B: 'c1' },
      ]);
      await tx.$executeRawUnsafe("INSERT INTO admins (id) VALUES ('empty')");
      expect(
        await tx.$queryRaw`SELECT scope::text FROM admins WHERE id = 'empty'`,
      ).toEqual([{ scope: 'CANTEENS' }]);
      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    });
  });

  it('provides only authorized selector metadata without granting canteen detail access', async () => {
    for (const scope of ['GLOBAL', 'CANTEENS'] as const) {
      const actor = await db.admin.create({
        data: {
          username: `${prefix}-${scope}`,
          password: 'unused',
          scope,
          canteens: {
            create:
              scope === 'CANTEENS'
                ? canteens.slice(0, 2).map((canteenId) => ({ canteenId }))
                : [],
          },
          permissions: {
            create: [
              'config:view',
              'config:edit',
              'admin:view',
              'admin:edit',
            ].map((permission) => ({ permission })),
          },
        },
      });
      admins.push(actor.id);
      const token = app.get(JwtService).sign(
        {
          sub: actor.id,
          type: 'admin',
          sessionVersion: 0,
          tokenUse: 'access',
        },
        { secret: app.get(ConfigService).get<string>('JWT_SECRET') },
      );
      await auth('get', '/admin/canteens', token).expect(403);
      const response = await auth(
        'get',
        '/admin/canteens/options',
        token,
      ).expect(200);
      expect(
        response.body.data.items.every(
          (item) => Object.keys(item).sort().join(',') === 'id,name',
        ),
      ).toBe(true);
      const actual = response.body.data.items.map((item) => item.id);
      if (scope === 'CANTEENS')
        expect(actual.sort()).toEqual(canteens.slice(0, 2).sort());
      else for (const id of canteens) expect(actual).toContain(id);
    }
    await request(app.getHttpServer())
      .get('/admin/canteens/options')
      .expect(401);
  });

  it('lists both assigned canteens and keeps explicit filters inside scope', async () => {
    const canteenList = await auth(
      'get',
      '/admin/canteens?pageSize=100',
    ).expect(200);
    expect(canteenList.body.data.items.map((row) => row.id).sort()).toEqual(
      canteens.slice(0, 2).sort(),
    );
    const dishList = await auth('get', '/admin/dishes?pageSize=100').expect(
      200,
    );
    expect(dishList.body.data.items.map((row) => row.id).sort()).toEqual(
      dishes.slice(0, 2).sort(),
    );
    expect(dishList.body.data.meta.total).toBe(2);
    await auth('get', `/admin/dishes?canteenId=${canteens[1]}`).expect(200);
    await auth('get', `/admin/dishes?canteenId=${canteens[2]}`).expect(403);
    await auth('get', `/admin/dishes?windowId=${windows[2]}`).expect(403);
  });

  it('checks details, updates and new targets for both selected canteens', async () => {
    for (const i of [0, 1]) {
      await auth('get', `/admin/canteens/${canteens[i]}`).expect(200);
      await auth('get', `/admin/windows/${windows[i]}`).expect(200);
      await auth('get', `/admin/dishes/${dishes[i]}`).expect(200);
      await auth('put', `/admin/canteens/${canteens[i]}`)
        .send({ description: '范围内更新' })
        .expect(200);
    }
    await auth('get', `/admin/canteens/${canteens[2]}`).expect(403);
    await auth('get', `/admin/windows/${windows[2]}`).expect(403);
    await auth('get', `/admin/dishes/${dishes[2]}`).expect(403);
    await auth('put', `/admin/dishes/${dishes[0]}`)
      .send({ windowId: windows[2] })
      .expect(403);
  });

  it('validates the complete batch before any deletion', async () => {
    await auth('post', '/admin/news/batch-delete')
      .send({ ids: [news[0], news[2]] })
      .expect(403);
    expect(await db.news.count({ where: { id: { in: news } } })).toBe(3);
    await auth('post', '/admin/news/batch-delete')
      .send({ ids: news.slice(0, 2) })
      .expect(200);
    expect(await db.news.count({ where: { id: { in: news } } })).toBe(1);
  });

  it('requires an explicit in-scope news publisher for multi-canteen accounts', async () => {
    const body = { title: prefix, content: prefix };
    await auth('post', '/admin/news').send(body).expect(403);
    await auth('post', '/admin/news')
      .send({ ...body, canteenId: null })
      .expect(403);
    await auth('post', '/admin/news')
      .send({ ...body, canteenId: canteens[2] })
      .expect(403);
    for (const canteenId of canteens.slice(0, 2)) {
      const row = await auth('post', '/admin/news')
        .send({ ...body, canteenId })
        .expect(201);
      expect(row.body.data.canteenId).toBe(canteenId);
    }
    const list = await auth('get', '/admin/news').expect(200);
    expect(
      list.body.data.items.every((row) =>
        canteens.slice(0, 2).includes(row.canteenId),
      ),
    ).toBe(true);
  });

  it('allows each assigned canteen configuration and rejects global or unrelated writes', async () => {
    for (const canteenId of canteens.slice(0, 2)) {
      await auth('get', `/admin/config/canteen/${canteenId}/effective`).expect(
        200,
      );
      await auth('put', `/admin/config/canteen/${canteenId}`)
        .send({ key: 'review.autoApprove', value: 'false' })
        .expect(200);
    }
    await auth('get', `/admin/config/canteen/${canteens[2]}/effective`).expect(
      403,
    );
    await auth('put', `/admin/config/canteen/${canteens[2]}`)
      .send({ key: 'review.autoApprove', value: 'false' })
      .expect(403);
    await auth('put', '/admin/config/global')
      .send({ key: 'review.autoApprove', value: 'false' })
      .expect(403);
    await auth('get', '/admin/posts').expect(403);
    await auth('get', '/admin/student-verifications').expect(403);
  });

  it('grants multiple canteens to children and prevents expansion, duplicate or empty grants', async () => {
    const body = {
      username: `${prefix}-child`,
      password: 'Password123!',
      ...grant('CANTEENS', canteens.slice(0, 2)),
    };
    const response = await auth('post', '/admin/admins').send(body).expect(201);
    admins.push(response.body.data.id);
    expect(response.body.data.canteenIds.sort()).toEqual(
      canteens.slice(0, 2).sort(),
    );
    for (const requestBody of [
      grant('GLOBAL', []),
      grant('CANTEENS', [canteens[2]]),
    ]) {
      await auth('post', '/admin/admins')
        .send({ ...body, ...requestBody })
        .expect(403);
    }
    for (const ids of [[], [canteens[0], canteens[0]]]) {
      await auth('post', '/admin/admins')
        .send({ ...body, ...grant('CANTEENS', ids) })
        .expect(400);
    }
    await auth('put', `/admin/admins/${response.body.data.id}/permissions`)
      .send(grant('CANTEENS', [canteens[2]]))
      .expect(403);
    await auth('put', `/admin/admins/${response.body.data.id}/permissions`)
      .send(
        grant('CANTEENS', [canteens[0]], {
          permissions: ['unknown:permission'],
        }),
      )
      .expect(400);
  });

  it('rejects legacy scalar scope requests', async () => {
    await auth('post', '/admin/admins')
      .send({
        username: `${prefix}-legacy`,
        password: 'Password123!',
        canteenId: canteens[0],
        permissions: ['dish:view'],
      })
      .expect(400);
  });

  it('rechecks a creator scope after a concurrent revocation releases its row lock', async () => {
    const actor = await db.admin.create({
      data: {
        username: `${prefix}-race`,
        password: 'unused',
        role: 'admin',
        scope: 'CANTEENS',
        createdBy: rootId,
        managerId: rootId,
        canteens: {
          create: canteens.slice(0, 2).map((canteenId) => ({ canteenId })),
        },
        permissions: {
          create: permissions.map((permission) => ({ permission })),
        },
      },
    });
    admins.push(actor.id);
    const token = app
      .get(JwtService)
      .sign(
        { sub: actor.id, type: 'admin', sessionVersion: 0, tokenUse: 'access' },
        { secret: app.get(ConfigService).get<string>('JWT_SECRET') },
      );
    let pending!: Promise<request.Response>;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM admins WHERE id = ${actor.id} FOR UPDATE`;
      pending = auth('post', '/admin/admins', token)
        .send({
          username: `${prefix}-race2`,
          password: 'Password123!',
          ...grant('CANTEENS', [canteens[1]]),
        })
        .then((response) => response);
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const rows = await db.$queryRaw<
          { count: bigint }[]
        >`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM admins WHERE id%FOR UPDATE%'`;
        if (Number(rows[0].count)) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      await tx.admin.update({
        where: { id: actor.id },
        data: {
          canteens: { deleteMany: {}, create: [{ canteenId: canteens[0] }] },
        },
      });
    });
    expect((await pending).status).toBe(403);
    expect(
      await db.admin.count({ where: { username: `${prefix}-race2` } }),
    ).toBe(0);
  });

  it.each(['admin:create', 'admin:edit'])(
    'rechecks %s after concurrent action revocation',
    async (action) => {
      const actor = await db.admin.create({
        data: {
          username: `${prefix}-op-${admins.length}`,
          password: 'unused',
          role: 'admin',
          scope: 'CANTEENS',
          createdBy: rootId,
          managerId: rootId,
          canteens: { create: [{ canteenId: canteens[0] }] },
          permissions: {
            create: [
              'admin:view',
              'admin:create',
              'admin:edit',
              'canteen:view',
              'dish:view',
            ].map((permission) => ({ permission })),
          },
        },
      });
      admins.push(actor.id);
      const target = await db.admin.create({
        data: {
          username: `${prefix}-t-${admins.length}`,
          password: 'unused',
          role: 'admin',
          scope: 'CANTEENS',
          createdBy: actor.id,
          managerId: actor.id,
          canteens: { create: [{ canteenId: canteens[0] }] },
          permissions: { create: [{ permission: 'dish:view' }] },
        },
      });
      admins.push(target.id);
      const token = app.get(JwtService).sign(
        {
          sub: actor.id,
          type: 'admin',
          sessionVersion: 0,
          tokenUse: 'access',
        },
        { secret: app.get(ConfigService).get<string>('JWT_SECRET') },
      );
      const username = `${prefix}-n-${admins.length}`;
      let pending!: Promise<request.Response>;
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM admins WHERE id = ${actor.id} FOR UPDATE`;
        pending =
          action === 'admin:create'
            ? auth('post', '/admin/admins', token)
                .send({
                  username,
                  password: 'Password123!',
                  ...grant('CANTEENS', [canteens[0]]),
                })
                .then((response) => response)
            : auth('put', `/admin/admins/${target.id}/permissions`, token)
                .send(grant('CANTEENS', [canteens[0]]))
                .then((response) => response);
        await waitForGrantLock();
        await tx.adminPermission.deleteMany({
          where: { adminId: actor.id, permission: action },
        });
      });
      expect((await pending).status).toBe(403);
      if (action === 'admin:create')
        expect(await db.admin.count({ where: { username } })).toBe(0);
      else
        expect(
          (await db.admin.findUniqueOrThrow({ where: { id: target.id } }))
            .updatedAt,
        ).toEqual(target.updatedAt);
    },
  );

  it('completes concurrent cross-creator grants by two superadmins', async () => {
    const superadmins: { id: string }[] = [];
    const targets: { id: string }[] = [];
    for (const suffix of ['a', 'b']) {
      const admin = await db.admin.create({
        data: {
          id: `${prefix}-super-${suffix}`,
          username: `${prefix}-s${suffix}`,
          password: 'unused',
          role: 'superadmin',
          scope: 'GLOBAL',
        },
      });
      admins.push(admin.id);
      superadmins.push(admin);
      const child = await db.admin.create({
        data: {
          username: `${prefix}-c${suffix}`,
          password: 'unused',
          scope: 'GLOBAL',
          createdBy: admin.id,
          managerId: admin.id,
          permissions: { create: [{ permission: 'dish:view' }] },
        },
      });
      admins.push(child.id);
      targets.push(child);
    }
    const tokens = superadmins.map((admin) =>
      app.get(JwtService).sign(
        {
          sub: admin.id,
          type: 'admin',
          sessionVersion: 0,
          tokenUse: 'access',
        },
        { secret: app.get(ConfigService).get<string>('JWT_SECRET') },
      ),
    );
    const pending: Promise<request.Response>[] = [];
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM admins WHERE id = ${superadmins[0].id} FOR UPDATE`;
      pending.push(
        auth('put', `/admin/admins/${targets[1].id}/permissions`, tokens[0])
          .send(grant('GLOBAL', []))
          .then((response) => response),
      );
      await waitForGrantLock();
      pending.push(
        auth('put', `/admin/admins/${targets[0].id}/permissions`, tokens[1])
          .send(grant('GLOBAL', []))
          .then((response) => response),
      );
      await waitForGrantLock(2);
    });
    const responses = await Promise.all(pending);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    for (const target of targets) {
      expect(
        await db.adminPermission.findMany({
          where: { adminId: target.id },
          select: { permission: true },
        }),
      ).toEqual([{ permission: 'dish:view' }]);
    }
  });

  it('revokes descendant scopes atomically and applies changes to existing tokens', async () => {
    const response = await auth('post', '/admin/admins')
      .send({
        username: `${prefix}-b`,
        password: 'Password123!',
        ...grant('CANTEENS', canteens.slice(0, 2), {
          permissions: [
            'admin:view',
            'admin:create',
            'canteen:view',
            'dish:view',
          ],
        }),
      })
      .expect(201);
    const childId = response.body.data.id;
    admins.push(childId);
    await db.admin.update({
      where: { id: childId },
      data: { mustChangePassword: false },
    });
    const jwt = app.get(JwtService),
      secret = app.get(ConfigService).get<string>('JWT_SECRET');
    const childToken = jwt.sign(
      { sub: childId, type: 'admin', sessionVersion: 0, tokenUse: 'access' },
      { secret },
    );
    const grandchild = await auth('post', '/admin/admins', childToken)
      .send({
        username: `${prefix}-leaf`,
        password: 'Password123!',
        ...grant('CANTEENS', [canteens[1]]),
      })
      .expect(201);
    admins.push(grandchild.body.data.id);
    await db.admin.update({
      where: { id: grandchild.body.data.id },
      data: { mustChangePassword: false },
    });
    await auth(
      'put',
      `/admin/admins/${grandchild.body.data.id}/permissions`,
      globalToken,
    )
      .send(grant('CANTEENS', [canteens[2]]))
      .expect(403);
    const grandchildToken = jwt.sign(
      {
        sub: grandchild.body.data.id,
        type: 'admin',
        sessionVersion: 0,
        tokenUse: 'access',
      },
      { secret },
    );
    await auth('get', `/admin/dishes/${dishes[1]}`, grandchildToken).expect(
      200,
    );
    await auth('put', `/admin/admins/${managerId}/permissions`, globalToken)
      .send(grant('CANTEENS', [canteens[0]], { permissions }))
      .expect(200);
    await auth('get', `/admin/dishes/${dishes[1]}`).expect(403);
    await auth('get', `/admin/dishes/${dishes[1]}`, childToken).expect(403);
    const empty = await auth('get', '/admin/dishes', grandchildToken).expect(
      200,
    );
    expect(empty.body.data.items).toEqual([]);
    expect(empty.body.data.meta.total).toBe(0);
    await auth('get', `/admin/dishes/${dishes[0]}`, grandchildToken).expect(
      403,
    );
    await auth('get', '/admin/posts', grandchildToken).expect(403);
    const row = await db.admin.findUniqueOrThrow({
      where: { id: grandchild.body.data.id },
      include: { canteens: true },
    });
    expect(row.scope).toBe('CANTEENS');
    expect(row.canteens).toEqual([]);
    await auth('put', `/admin/admins/${managerId}/permissions`, globalToken)
      .send(grant('CANTEENS', [canteens[0]]))
      .expect(200);
    await auth('post', '/admin/admins', childToken)
      .send({
        username: `${prefix}-new`,
        password: 'Password123!',
        ...grant('CANTEENS', [canteens[0]]),
      })
      .expect(403);
  });
});
