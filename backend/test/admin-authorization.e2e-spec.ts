import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma.service';
import { AuthService } from '@/auth/auth.service';
import { AdminAuthController } from '@/auth/admin-auth.controller';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { RefreshAuthGuard } from '@/auth/guards/refresh-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { UserIdentityService } from '@/auth/user-identity.service';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { VerificationChallengeService } from '@/auth/verification-challenge.service';
import { CampusOAuthService } from '@/campus-identity/campus-oauth.service';
import { AdminAdminsController } from '@/admin-admins/admin-admins.controller';
import { AdminAdminsService } from '@/admin-admins/admin-admins.service';
import { AdminLogsController } from '@/admin-logs/admin-logs.controller';
import { AdminLogsService } from '@/admin-logs/admin-logs.service';
import { AdminOperationLogInterceptor } from '@/admin-logs/admin-operation-log.interceptor';
import { AdminAuditExceptionFilter } from '@/admin-logs/admin-audit-exception.filter';
import { AdminRecommendationController } from '@/admin-recommendation/admin-recommendation.controller';
import { ExperimentsService } from '@/admin-recommendation/services/experiments.service';
import { RecallQualityService } from '@/admin-recommendation/services/recall-quality.service';
import { ExperimentService } from '@/recommendation/services/experiment.service';

jest.setTimeout(30000);

describe('administrator authorization lifecycle (PostgreSQL)', () => {
  const prefix = `rb-${randomUUID().slice(0, 5)}`;
  const password = 'Audit-Original123!';
  let app: INestApplication;
  let db: PrismaService;
  let root: { id: string; token: string };
  const ids: string[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, pass = password) => {
    const response = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username, password: pass })
      .expect(200);
    return response.body.data.token;
  };
  const account = async (
    name: string,
    permissions: string[],
    parent?: string,
    scope: 'GLOBAL' | 'CANTEENS' = 'GLOBAL',
  ) => {
    const admin = await db.admin.create({
      data: {
        username: `${prefix}-${name}`,
        password: await bcrypt.hash(password, 4),
        role: name === 'root' ? 'superadmin' : 'admin',
        scope,
        createdBy: parent,
        managerId: parent,
        permissions: {
          create: permissions.map((permission) => ({ permission })),
        },
      },
    });
    ids.push(admin.id);
    return { ...admin, token: (await login(admin.username)).accessToken };
  };

  const waitForHierarchyWaiters = async (count: number) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const [row] = await db.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%tasteinsight.admin-hierarchy%'`;
      if (Number(row.count) >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Hierarchy mutation did not reach its transaction lock');
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AdminAuthController,
        AdminAdminsController,
        AdminLogsController,
        AdminRecommendationController,
      ],
      providers: [
        PrismaService,
        JwtService,
        AuthService,
        AdminAdminsService,
        AdminLogsService,
        ExperimentsService,
        AdminAuthGuard,
        RefreshAuthGuard,
        PermissionsGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              ({
                JWT_SECRET: 'rbac-audit-access',
                JWT_REFRESH_SECRET: 'rbac-audit-refresh',
              })[key] || fallback,
          },
        },
        ...[
          UserIdentityService,
          UserProfileService,
          VerificationChallengeService,
          CampusOAuthService,
          RecallQualityService,
        ].map((provide) => ({ provide, useValue: {} })),
        {
          provide: ExperimentService,
          useValue: { refreshActiveExperiments: jest.fn() },
        },
        { provide: APP_INTERCEPTOR, useClass: AdminOperationLogInterceptor },
        { provide: APP_FILTER, useClass: AdminAuditExceptionFilter },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    root = await account('root', []);
  });
  afterAll(async () => {
    if (db) {
      await db.operationLog.deleteMany({ where: { adminId: { in: ids } } });
      await db.admin.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('allows log-only readers to see their full tree through retired nodes and excludes unrelated admins', async () => {
    const manager = await account('logs', ['log:view'], root.id);
    const child = await account('child', [], manager.id);
    const grandchild = await account('grandchild', [], child.id);
    const unrelated = await account('unrelated', [], root.id);
    await db.admin.update({
      where: { id: child.id },
      data: { deletedAt: new Date() },
    });
    await db.operationLog.createMany({
      data: [manager, child, grandchild, unrelated].map((a) => ({
        adminId: a.id,
        action: 'create',
        targetType: 'fixture',
        targetId: prefix,
        result: 'success',
      })),
    });
    const response = await request(app.getHttpServer())
      .get('/admin/logs')
      .set(auth(manager.token))
      .expect(200);
    const actual = response.body.data.items
      .filter((log) => log.targetId === prefix)
      .map((log) => log.adminId);
    expect(actual.sort()).toEqual([manager.id, child.id, grandchild.id].sort());
    const filtered = await request(app.getHttpServer())
      .get(`/admin/logs?adminId=${unrelated.id}`)
      .set(auth(manager.token))
      .expect(200);
    expect(filtered.body.data.items).toEqual([]);
    await request(app.getHttpServer())
      .get('/admin/admins')
      .set(auth(manager.token))
      .expect(403);
    const adminOnly = await account('admin-only', ['admin:view'], root.id);
    await request(app.getHttpServer())
      .get('/admin/logs')
      .set(auth(adminOnly.token))
      .expect(403);
  });

  it('retires only the selected account and preserves descendant sessions and history', async () => {
    const manager = await account('retire', ['admin:view'], root.id);
    const child = await account('retire-child', ['log:view'], manager.id);
    const grandchild = await account(
      'retire-grandchild',
      ['log:view'],
      child.id,
    );
    const oldRefresh = (await login(manager.username)).refreshToken;
    const childRefresh = (await login(child.username)).refreshToken;
    const grandchildRefresh = (await login(grandchild.username)).refreshToken;
    const replacement = await account(
      'replacement',
      ['admin:view', 'log:view'],
      root.id,
    );
    await request(app.getHttpServer())
      .delete(`/admin/admins/${manager.id}`)
      .set(auth(root.token))
      .expect(400);
    await request(app.getHttpServer())
      .post(`/admin/admins/${manager.id}/handover`)
      .set(auth(root.token))
      .send({ newManagerId: replacement.id, retireSource: true })
      .expect(200);
    expect(
      await db.admin.count({
        where: {
          id: { in: [manager.id, child.id, grandchild.id] },
          deletedAt: { not: null },
        },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .get('/auth/admin/session')
      .set(auth(manager.token))
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set(auth(oldRefresh))
      .expect(401);
    for (const descendant of [child, grandchild]) {
      await request(app.getHttpServer())
        .get('/auth/admin/session')
        .set(auth(descendant.token))
        .expect(200);
    }
    for (const refresh of [childRefresh, grandchildRefresh]) {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set(auth(refresh))
        .expect(200);
    }
    expect(
      await db.admin.findUniqueOrThrow({ where: { id: child.id } }),
    ).toMatchObject({
      createdBy: manager.id,
      managerId: replacement.id,
      deletedAt: null,
      sessionVersion: child.sessionVersion,
    });
    expect(
      await db.operationLog.count({
        where: { action: 'admin:retire', targetId: manager.id },
      }),
    ).toBe(1);
  });

  it('hands over reporting authority and log visibility while preserving creation history and grants', async () => {
    const grants = ['admin:view', 'admin:edit', 'log:view', 'dish:view'];
    const previous = await account('previous', grants, root.id);
    const replacement = await account('next', grants, root.id);
    const child = await account('move-child', ['log:view'], previous.id);
    const leaf = await account('move-leaf', ['log:view'], child.id);
    const hierarchyVersions = await db.admin.findMany({
      where: { id: { in: [previous.id, replacement.id, root.id] } },
    });
    for (const admin of [child, leaf]) {
      await db.operationLog.create({
        data: {
          adminId: admin.id,
          action: 'handover-fixture',
          targetType: 'fixture',
          targetId: admin.id,
          result: 'success',
        },
      });
    }
    await request(app.getHttpServer())
      .post(`/admin/admins/${previous.id}/handover`)
      .set(auth(root.token))
      .send({ newManagerId: replacement.id })
      .expect(200);
    for (const before of hierarchyVersions) {
      const after = await db.admin.findUniqueOrThrow({
        where: { id: before.id },
      });
      expect(after.hierarchyVersion).toBe(before.hierarchyVersion + 1);
    }
    expect(
      await db.admin.findUniqueOrThrow({
        where: { id: child.id },
        include: { permissions: true },
      }),
    ).toMatchObject({
      createdBy: previous.id,
      managerId: replacement.id,
      deletedAt: null,
      sessionVersion: 0,
      permissions: [{ permission: 'log:view' }],
    });
    expect(
      await db.admin.findUniqueOrThrow({ where: { id: leaf.id } }),
    ).toMatchObject({ managerId: child.id });
    const oldLogs = await request(app.getHttpServer())
      .get('/admin/logs?action=handover-fixture')
      .set(auth(previous.token))
      .expect(200);
    expect(oldLogs.body.data.items).toEqual([]);
    const newLogs = await request(app.getHttpServer())
      .get('/admin/logs?action=handover-fixture')
      .set(auth(replacement.token))
      .expect(200);
    expect(
      newLogs.body.data.items
        .map((log: { adminId: string }) => log.adminId)
        .sort(),
    ).toEqual([child.id, leaf.id].sort());
    await request(app.getHttpServer())
      .put(`/admin/admins/${child.id}/permissions`)
      .set(auth(previous.token))
      .send({ scope: 'GLOBAL', canteenIds: [], permissions: ['dish:view'] })
      .expect(403);
    await request(app.getHttpServer())
      .put(`/admin/admins/${child.id}/password`)
      .set(auth(previous.token))
      .send({ newPassword: 'New-Personal123!' })
      .expect(403);
    await request(app.getHttpServer())
      .put(`/admin/admins/${child.id}/permissions`)
      .set(auth(replacement.token))
      .send({
        scope: 'GLOBAL',
        canteenIds: [],
        permissions: ['log:view', 'dish:view'],
      })
      .expect(200);
    const log = await db.operationLog.findFirstOrThrow({
      where: { action: 'admin:handover', targetId: previous.id },
    });
    expect(log.details).toMatchObject({
      previousManagerId: previous.id,
      newManagerId: replacement.id,
      directReportIds: [child.id],
      affectedAdminIds: expect.arrayContaining([child.id, leaf.id]),
      retireSource: false,
    });
  });

  it('rejects cycles, insufficient grants, unrelated operators and unauthorized retirement atomically', async () => {
    const manager = await account(
      'invalid-move',
      ['admin:view', 'log:view'],
      root.id,
    );
    const child = await account('invalid-child', ['log:view'], manager.id);
    const weak = await account('weak', ['dish:view'], root.id);
    const scoped = await account(
      'scoped-move',
      ['log:view'],
      root.id,
      'CANTEENS',
    );
    const outsider = await account(
      'outsider',
      ['admin:view', 'admin:edit'],
      root.id,
    );
    for (const [recipient, status] of [
      [child, 400],
      [manager, 400],
      [weak, 400],
      [scoped, 403],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/admin/admins/${manager.id}/handover`)
        .set(auth(root.token))
        .send({ newManagerId: recipient.id, retireSource: true })
        .expect(status);
    }
    await request(app.getHttpServer())
      .post(`/admin/admins/${manager.id}/handover`)
      .set(auth(outsider.token))
      .send({ newManagerId: outsider.id })
      .expect(403);
    const owner = await account(
      'move-owner',
      ['admin:view', 'admin:edit', 'log:view'],
      root.id,
    );
    const source = await account('owned-source', ['log:view'], owner.id);
    const ownedChild = await account('owned-child', ['log:view'], source.id);
    await request(app.getHttpServer())
      .post(`/admin/admins/${source.id}/handover`)
      .set(auth(owner.token))
      .send({ newManagerId: owner.id, retireSource: true })
      .expect(403);
    expect(
      await db.admin.findUniqueOrThrow({ where: { id: ownedChild.id } }),
    ).toMatchObject({ managerId: source.id, deletedAt: null });
    expect(
      await db.admin.findUniqueOrThrow({ where: { id: child.id } }),
    ).toMatchObject({ managerId: manager.id, deletedAt: null });
    expect(
      await db.admin.findUniqueOrThrow({ where: { id: manager.id } }),
    ).toMatchObject({ deletedAt: null });
    expect(
      await db.operationLog.count({
        where: {
          action: 'admin:handover',
          targetId: { in: [manager.id, source.id] },
        },
      }),
    ).toBe(0);
    await request(app.getHttpServer())
      .post(`/admin/admins/${source.id}/handover`)
      .set(auth(owner.token))
      .send({ newManagerId: owner.id })
      .expect(200);
    expect(
      await db.admin.findUniqueOrThrow({ where: { id: ownedChild.id } }),
    ).toMatchObject({ managerId: owner.id, createdBy: source.id });
  });

  it('keeps retired managers with outstanding reports available for handover', async () => {
    const retired = await account('archived', ['log:view'], root.id);
    const child = await account('archived-child', ['log:view'], retired.id);
    await db.admin.update({
      where: { id: retired.id },
      data: { deletedAt: new Date() },
    });
    const before = await request(app.getHttpServer())
      .get('/admin/admins?pageSize=100')
      .set(auth(root.token))
      .expect(200);
    expect(
      before.body.data.items.find(
        (item: { id: string }) => item.id === retired.id,
      ),
    ).toMatchObject({ directReportCount: 1, deletedAt: expect.any(String) });
    await request(app.getHttpServer())
      .post(`/admin/admins/${retired.id}/handover`)
      .set(auth(root.token))
      .send({ newManagerId: root.id })
      .expect(200);
    expect(
      await db.admin.findUniqueOrThrow({ where: { id: child.id } }),
    ).toMatchObject({
      createdBy: retired.id,
      managerId: root.id,
      deletedAt: null,
    });
    await request(app.getHttpServer())
      .get('/auth/admin/session')
      .set(auth(child.token))
      .expect(200);
    const after = await request(app.getHttpServer())
      .get('/admin/admins?pageSize=100')
      .set(auth(root.token))
      .expect(200);
    expect(
      after.body.data.items.some(
        (item: { id: string }) => item.id === retired.id,
      ),
    ).toBe(false);
  });

  it('reads the reporting hierarchy and logs from one snapshot during a concurrent handover', async () => {
    const previous = await account('snap-prev', ['log:view'], root.id);
    const replacement = await account('snap-next', ['log:view'], root.id);
    const child = await account('snap-child', ['log:view'], previous.id);
    const action = `snapshot-${child.id}`;
    const facade = new Proxy(db, {
      get(target, key) {
        if (key === '$transaction')
          return (callback, options) =>
            db.$transaction(
              async (tx) =>
                callback(
                  new Proxy(tx, {
                    get(client, field) {
                      if (field === '$queryRaw')
                        return async (...args) => {
                          const rows = await Reflect.apply(
                            client.$queryRaw,
                            client,
                            args,
                          );
                          await app.get(AdminAdminsService).handover(
                            root.id,
                            previous.id,
                            {
                              newManagerId: replacement.id,
                            },
                            0,
                          );
                          await db.operationLog.create({
                            data: {
                              adminId: child.id,
                              action,
                              targetType: 'fixture',
                              targetId: child.id,
                              result: 'success',
                            },
                          });
                          return rows;
                        };
                      const value = Reflect.get(client, field);
                      return typeof value === 'function'
                        ? value.bind(client)
                        : value;
                    },
                  }),
                ),
              options,
            );
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const reader = {
      id: previous.id,
      username: previous.username,
      role: 'admin',
      scope: 'GLOBAL' as const,
      canteenIds: [],
      permissions: ['log:view'],
    };
    const raced = await new AdminLogsService(facade).findAll(
      { action, page: 1, pageSize: 20 },
      reader,
    );
    expect(raced.data.items).toEqual([]);
    const newOwner = await request(app.getHttpServer())
      .get(`/admin/logs?action=${action}`)
      .set(auth(replacement.token))
      .expect(200);
    expect(newOwner.body.data.items).toHaveLength(1);
  });

  it('requires a personal password for new and reset accounts and invalidates both old token types', async () => {
    const username = `${prefix}-new`;
    const created = await request(app.getHttpServer())
      .post('/admin/admins')
      .set(auth(root.token))
      .send({
        username,
        password,
        scope: 'GLOBAL',
        canteenIds: [],
        permissions: ['log:view'],
      })
      .expect(201);
    const id = created.body.data.id;
    ids.push(id);
    const original = await login(username);
    await request(app.getHttpServer())
      .get('/admin/logs')
      .set(auth(original.accessToken))
      .expect(403);
    const session = await request(app.getHttpServer())
      .get('/auth/admin/session')
      .set(auth(original.accessToken))
      .expect(200);
    expect(session.body.data.admin.mustChangePassword).toBe(true);
    expect(session.body.data).not.toHaveProperty('admin.password');
    expect(session.body.data).not.toHaveProperty('admin.sessionVersion');
    await request(app.getHttpServer())
      .put('/admin/admins/me/password')
      .set(auth(original.accessToken))
      .send({ currentPassword: password, newPassword: 'Audit-Personal123!' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/admin/session')
      .set(auth(original.accessToken))
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set(auth(original.refreshToken))
      .expect(401);
    const current = await login(username, 'Audit-Personal123!');
    await request(app.getHttpServer())
      .get('/admin/logs')
      .set(auth(current.accessToken))
      .expect(200);
    await request(app.getHttpServer())
      .put(`/admin/admins/${id}/password`)
      .set(auth(root.token))
      .send({ newPassword: 'Audit-Reset123!' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set(auth(current.refreshToken))
      .expect(401);
    const reset = await login(username, 'Audit-Reset123!');
    await request(app.getHttpServer())
      .get('/admin/logs')
      .set(auth(reset.accessToken))
      .expect(403);
    const details = await db.operationLog.findMany({ where: { targetId: id } });
    expect(JSON.stringify(details)).not.toContain(password);
    expect(JSON.stringify(details)).not.toContain('Audit-Reset');
  });

  it('shrinks grants and scope throughout the tree and audits the complete change', async () => {
    const manager = await account(
      'grant-manager',
      ['admin:view', 'admin:create', 'canteen:view', 'dish:view', 'dish:edit'],
      root.id,
    );
    const child = await account(
      'grant-child',
      ['admin:view', 'canteen:view', 'dish:view', 'dish:edit'],
      manager.id,
    );
    const grandchild = await account(
      'grant-grandchild',
      ['canteen:view', 'dish:view', 'dish:edit'],
      child.id,
    );
    const canteen = await db.canteen.create({
      data: { name: prefix, openingHours: [] },
    });
    try {
      await request(app.getHttpServer())
        .put(`/admin/admins/${manager.id}/permissions`)
        .set(auth(root.token))
        .send({
          scope: 'CANTEENS',
          canteenIds: [canteen.id],
          permissions: ['dish:view'],
        })
        .expect(200);
      for (const id of [manager.id, child.id, grandchild.id]) {
        const current = await db.admin.findUniqueOrThrow({
          where: { id },
          include: { canteens: true, permissions: true },
        });
        expect(current.scope).toBe('CANTEENS');
        expect(current.canteens.map((item) => item.canteenId)).toEqual([
          canteen.id,
        ]);
        expect(current.permissions.map((item) => item.permission)).toEqual([
          'dish:view',
        ]);
      }
      await request(app.getHttpServer())
        .get('/admin/admins')
        .set(auth(child.token))
        .expect(403);
      const log = await db.operationLog.findFirstOrThrow({
        where: { targetId: manager.id, action: 'admin:permissions' },
      });
      expect(log.details).toMatchObject({
        before: { scope: 'GLOBAL' },
        after: { scope: 'CANTEENS', permissions: ['dish:view'] },
        affectedAdminIds: expect.arrayContaining([
          manager.id,
          child.id,
          grandchild.id,
        ]),
      });
      await request(app.getHttpServer())
        .post('/admin/admins')
        .set(auth(root.token))
        .send({
          username: `${prefix}-scope`,
          password,
          scope: 'CANTEENS',
          canteenIds: [canteen.id],
          permissions: ['student:review'],
        })
        .expect(400);
    } finally {
      await db.adminCanteen.deleteMany({ where: { canteenId: canteen.id } });
      await db.canteen.delete({ where: { id: canteen.id } });
    }
  });

  it('serializes retirement against creation that already passed its authentication guard', async () => {
    const manager = await account(
      'race-manager',
      ['admin:create', 'admin:view', 'canteen:view', 'dish:view'],
      root.id,
    );
    let release!: () => void;
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const held = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('tasteinsight.admin-hierarchy'))`;
      locked();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await ready;
    const retirement = request(app.getHttpServer())
      .delete(`/admin/admins/${manager.id}`)
      .set(auth(root.token))
      .then((response) => response);
    let creation: Promise<request.Response> | undefined;
    try {
      await waitForHierarchyWaiters(1);
      creation = request(app.getHttpServer())
        .post('/admin/admins')
        .set(auth(manager.token))
        .send({
          username: `${prefix}-race-new`,
          password,
          scope: 'GLOBAL',
          canteenIds: [],
          permissions: ['dish:view'],
        })
        .then((response) => response);
      await waitForHierarchyWaiters(2);
    } finally {
      release();
      await held;
    }
    expect((await retirement).status).toBe(200);
    expect((await creation).status).toBe(401);
    expect(
      await db.admin.count({ where: { username: `${prefix}-race-new` } }),
    ).toBe(0);
  });

  it('rejects a queued old-session write after a password reset commits', async () => {
    const manager = await account(
      'reset-race',
      ['admin:view', 'admin:create', 'canteen:view', 'dish:view'],
      root.id,
    );
    let release!: () => void;
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const held = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('tasteinsight.admin-hierarchy'))`;
      locked();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await ready;
    const reset = request(app.getHttpServer())
      .put(`/admin/admins/${manager.id}/password`)
      .set(auth(root.token))
      .send({ newPassword: 'After-Reset123!' })
      .then((response) => response);
    let creation: Promise<request.Response> | undefined;
    try {
      await waitForHierarchyWaiters(1);
      creation = request(app.getHttpServer())
        .post('/admin/admins')
        .set(auth(manager.token))
        .send({
          username: `${prefix}-revoked-new`,
          password,
          scope: 'GLOBAL',
          canteenIds: [],
          permissions: ['dish:view'],
        })
        .then((response) => response);
      await waitForHierarchyWaiters(2);
    } finally {
      release();
      await held;
    }
    expect((await reset).status).toBe(200);
    expect((await creation).status).toBe(401);
    expect(
      await db.admin.count({ where: { username: `${prefix}-revoked-new` } }),
    ).toBe(0);
  });

  it('blocks global experiments for canteen scope and records permission denials and business failures accurately', async () => {
    const scoped = await account(
      'scoped',
      ['experiment:edit'],
      root.id,
      'CANTEENS',
    );
    await request(app.getHttpServer())
      .post('/admin/experiments/foreign/enable')
      .set(auth(scoped.token))
      .expect(403);
    await new Promise((resolve) => setImmediate(resolve));
    expect(
      await db.operationLog.count({
        where: {
          adminId: scoped.id,
          action: 'access_denied',
          result: 'failure',
        },
      }),
    ).toBe(1);
    const response = await request(app.getHttpServer())
      .post('/admin/experiments')
      .set(auth(root.token))
      .send({
        name: 'Invalid ratio',
        trafficRatio: 1,
        startTime: new Date().toISOString(),
        groups: [
          { name: 'A', ratio: 0.2, config: {} },
          { name: 'B', ratio: 0.2, config: {} },
        ],
      });
    expect(response.status).toBe(400);
    await new Promise((resolve) => setImmediate(resolve));
    const log = await db.operationLog.findFirst({
      where: {
        adminId: root.id,
        targetType: 'AdminRecommendationController',
        action: 'create',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(log?.result).toBe('failure');
  });
});
