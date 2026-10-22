import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AIConfig } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '@/prisma.service';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { AdminOperationLogInterceptor } from '@/admin-logs/admin-operation-log.interceptor';
import { AdminAuditExceptionFilter } from '@/admin-logs/admin-audit-exception.filter';
import { AIConfigService } from '@/ai-chat/services/ai-config.service';
import { ContentTranslationsController } from '@/content-translations/content-translations.controller';
import { ContentTranslationsService } from '@/content-translations/content-translations.service';
import { TranslationSettingsService } from '@/content-translations/translation-settings.service';

jest.setTimeout(30000);

describe('translation settings and drafts (PostgreSQL HTTP)', () => {
  const prefix = `translation-${randomUUID().slice(0, 8)}`;
  const configPrefix = 'ai.translation.';
  const ids: string[] = [];
  const jwt = new JwtService();
  const secret = `${prefix}-jwt`;
  const key = `${prefix}-translation-key`;
  const env: Record<string, string | undefined> = {};
  const draft = {
    kind: 'dish',
    name: '番茄炒蛋',
    description: '番茄与鸡蛋炒制',
  };
  const upstreamCalls: {
    authorization?: string;
    model: string;
    path?: string;
  }[] = [];
  let app: INestApplication;
  let db: PrismaService;
  let upstream: Server;
  let upstreamUrl: string;
  let original: AIConfig[] | undefined;
  let upstreamFailure = false;
  let root: string;
  let editor: string;
  let reader: string;
  let unrelated: string;
  let canteen: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const settingsRequest = (token = root) =>
    request(app.getHttpServer())
      .get('/admin/content-translations/settings')
      .set(auth(token));
  const update = (body: object, token = root) =>
    request(app.getHttpServer())
      .put('/admin/content-translations/settings')
      .set(auth(token))
      .send(body);
  const generate = (token = editor) =>
    request(app.getHttpServer())
      .post('/admin/content-translations')
      .set(auth(token))
      .send(draft);

  const account = async (
    name: string,
    permissions: string[],
    scope: 'GLOBAL' | 'CANTEENS' = 'GLOBAL',
  ) => {
    const admin = await db.admin.create({
      data: {
        username: `${prefix}-${name}`,
        password: 'test-only',
        scope,
        role: name === 'root' ? 'superadmin' : 'admin',
        permissions: {
          create: permissions.map((permission) => ({ permission })),
        },
      },
    });
    ids.push(admin.id);
    return jwt.sign(
      {
        sub: admin.id,
        type: 'admin',
        tokenUse: 'access',
        sessionVersion: admin.sessionVersion,
      },
      { secret },
    );
  };

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        upstreamCalls.push({
          authorization: req.headers.authorization,
          model: body.model,
          path: req.url,
        });
        res.setHeader('Content-Type', 'application/json');
        if (upstreamFailure) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: { message: `invalid key ${key}` } }));
          return;
        }
        res.end(
          JSON.stringify({
            id: 'translation-fixture',
            object: 'chat.completion',
            created: 0,
            model: body.model,
            choices: [
              {
                index: 0,
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    nameEn: 'Tomato and eggs',
                    descriptionEn: 'Stir-fried tomatoes and eggs',
                  }),
                },
              },
            ],
          }),
        );
      });
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve),
    );
    const address = upstream.address();
    if (!address || typeof address === 'string')
      throw new Error('HTTP mock requires a TCP address');
    upstreamUrl = `http://127.0.0.1:${address.port}/v1`;
    const module = await Test.createTestingModule({
      controllers: [ContentTranslationsController],
      providers: [
        PrismaService,
        ContentTranslationsService,
        TranslationSettingsService,
        AdminAuthGuard,
        PermissionsGuard,
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (name: string) => (name === 'JWT_SECRET' ? secret : env[name]),
          },
        },
        { provide: APP_INTERCEPTOR, useClass: AdminOperationLogInterceptor },
        { provide: APP_FILTER, useClass: AdminAuditExceptionFilter },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    original = await db.aIConfig.findMany({
      where: { key: { startsWith: configPrefix } },
    });
    root = await account('root', []);
    editor = await account('editor', ['dish:edit']);
    reader = await account('reader', ['config:view']);
    unrelated = await account('unrelated', ['dish:view']);
    canteen = await account(
      'canteen',
      ['config:view', 'config:edit'],
      'CANTEENS',
    );
  });

  beforeEach(async () => {
    for (const name of Object.keys(env)) delete env[name];
    env.AI_API_KEY = `${prefix}-chat-key`;
    env.AI_MODEL = 'chat-model';
    env.AI_BASE_URL = 'http://127.0.0.1:1/v1';
    upstreamCalls.length = 0;
    upstreamFailure = false;
    await db.aIConfig.deleteMany({
      where: { key: { startsWith: configPrefix } },
    });
  });

  afterAll(async () => {
    try {
      if (original) {
        const snapshot = original;
        await db.$transaction(async (tx) => {
          await tx.aIConfig.deleteMany({
            where: { key: { startsWith: configPrefix } },
          });
          if (snapshot.length) await tx.aIConfig.createMany({ data: snapshot });
        });
      }
      if (db) {
        await db.operationLog.deleteMany({ where: { adminId: { in: ids } } });
        await db.admin.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await app?.close();
      if (upstream)
        await new Promise<void>((resolve, reject) =>
          upstream.close((error) => (error ? reject(error) : resolve())),
        );
    }
  });

  it('defaults to disabled despite configured chat credentials, and exposes only status to an editor', async () => {
    const status = await request(app.getHttpServer())
      .get('/admin/content-translations/status')
      .set(auth(editor))
      .expect(200);
    expect(status.body).toEqual({
      code: 200,
      data: { enabled: false, available: false },
    });
    const settings = await settingsRequest().expect(200);
    expect(settings.body.data).toMatchObject({
      enabled: false,
      available: false,
      model: '',
      baseUrl: '',
      apiKeyConfigured: false,
    });
    const response = await generate().expect(503);
    expect(response.body.message).toContain('手工填写英文');
    expect(upstreamCalls).toHaveLength(0);
    await settingsRequest(editor).expect(403);
    await update({ enabled: true }, editor).expect(403);
    await request(app.getHttpServer())
      .get('/admin/content-translations/status')
      .set(auth(unrelated))
      .expect(403);
    await generate(unrelated).expect(403);
    await request(app.getHttpServer())
      .get('/admin/content-translations/status')
      .expect(401);
  });

  it('keeps global and canteen configuration authority separate', async () => {
    await settingsRequest(reader).expect(200);
    await update({ enabled: true }, reader).expect(403);
    await settingsRequest(canteen).expect(403);
    await update({ enabled: true }, canteen).expect(403);
    expect(
      await db.aIConfig.count({ where: { key: { startsWith: configPrefix } } }),
    ).toBe(0);
  });

  it('saves a dedicated configuration and sends editor drafts to its provider without changing chat', async () => {
    const result = await update({
      enabled: true,
      model: 'translation-model',
      apiKey: key,
      baseUrl: upstreamUrl,
    }).expect(200);
    expect(result.body.data).toMatchObject({
      enabled: true,
      available: true,
      apiKeyConfigured: true,
    });
    expect(JSON.stringify(result.body)).not.toContain(key);
    const response = await generate().expect(200);
    expect(response.body.data).toEqual({
      nameEn: 'Tomato and eggs',
      descriptionEn: 'Stir-fried tomatoes and eggs',
    });
    expect(upstreamCalls).toEqual([
      {
        authorization: `Bearer ${key}`,
        model: 'translation-model',
        path: '/v1/chat/completions',
      },
    ]);
    const chat = new AIConfigService(db, {
      get: (name: string) => env[name],
    } as ConfigService);
    await expect(chat.getProviderConfig()).resolves.toMatchObject({
      apiKey: `${prefix}-chat-key`,
      model: 'chat-model',
      baseUrl: 'http://127.0.0.1:1/v1',
    });
    expect(
      await db.aIConfig.findMany({
        where: { key: { startsWith: configPrefix } },
      }),
    ).toHaveLength(4);
    const logs = await db.operationLog.findMany({
      where: {
        adminId: { in: ids },
        details: {
          path: ['path'],
          equals: '/admin/content-translations/settings',
        },
      },
    });
    expect(
      logs.some((log) => log.result === 'success' && log.action === 'update'),
    ).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(key);
  });

  it('keeps blank or omitted keys and clears the database secret only for null', async () => {
    await update({
      enabled: true,
      model: 'translation-model',
      apiKey: key,
      baseUrl: upstreamUrl,
    }).expect(200);
    await update({ model: 'translation-v2' }).expect(200);
    await update({ apiKey: '  ' }).expect(200);
    await generate().expect(200);
    expect(upstreamCalls[0]).toMatchObject({
      authorization: `Bearer ${key}`,
      model: 'translation-v2',
    });
    await update({ apiKey: null }).expect(400);
    const cleared = await update({ enabled: false, apiKey: null }).expect(200);
    expect(cleared.body.data).toMatchObject({
      enabled: false,
      available: false,
      apiKeyConfigured: false,
    });
    expect(
      await db.aIConfig.findUnique({
        where: { key: configPrefix + 'api_key' },
      }),
    ).toBeNull();
    await generate().expect(503);
    expect(upstreamCalls).toHaveLength(1);
  });

  it('requires a translation model and stops provider calls when explicitly disabled', async () => {
    await update({ enabled: true, apiKey: key, baseUrl: upstreamUrl }).expect(
      400,
    );
    await generate().expect(503);
    expect(upstreamCalls).toHaveLength(0);
    await update({
      enabled: true,
      model: 'translation-model',
      apiKey: key,
      baseUrl: upstreamUrl,
    }).expect(200);
    await generate().expect(200);
    await update({ enabled: false }).expect(200);
    await generate().expect(503);
    expect(upstreamCalls).toHaveLength(1);
  });

  it('serializes concurrent enablement and key deletion', async () => {
    await update({
      model: 'translation-model',
      apiKey: key,
      baseUrl: upstreamUrl,
    }).expect(200);
    const [enabled, cleared] = await Promise.all([
      update({ enabled: true }),
      update({ apiKey: null }),
    ]);
    expect([enabled.status, cleared.status].sort()).toEqual([200, 400]);
    const result = await settingsRequest().expect(200);
    expect(!result.body.data.enabled || result.body.data.available).toBe(true);
  });

  it('uses environment settings before database values and rejects environment-managed updates atomically', async () => {
    await update({
      enabled: true,
      model: 'database-model',
      apiKey: key,
      baseUrl: upstreamUrl,
    }).expect(200);
    env.AI_TRANSLATION_ENABLED = 'false';
    env.AI_TRANSLATION_MODEL = 'environment-model';
    env.AI_TRANSLATION_API_KEY = 'environment-secret';
    env.AI_TRANSLATION_BASE_URL = upstreamUrl;
    const locked = await settingsRequest().expect(200);
    expect(locked.body.data).toMatchObject({
      enabled: false,
      available: false,
      model: 'environment-model',
      apiKeyConfigured: true,
      managedByEnv: { enabled: true, model: true, baseUrl: true, apiKey: true },
    });
    expect(JSON.stringify(locked.body)).not.toContain('environment-secret');
    await update({ enabled: true, apiKey: null }).expect(400);
    expect(
      (
        await db.aIConfig.findUniqueOrThrow({
          where: { key: configPrefix + 'api_key' },
        })
      ).value,
    ).toBe(key);
    await generate().expect(503);
    expect(upstreamCalls).toHaveLength(0);
    env.AI_TRANSLATION_ENABLED = 'true';
    await generate().expect(200);
    expect(upstreamCalls[0]).toMatchObject({
      authorization: 'Bearer environment-secret',
      model: 'environment-model',
    });
  });

  it('rejects invalid field values and endpoints before any writes', async () => {
    for (const body of [
      { enabled: null },
      { enabled: 'true' },
      { enabled: 'false' },
      { enabled: 1 },
      { model: 123 },
      { model: null },
      { baseUrl: null },
      { apiKey: 123 },
      { model: 'changed', baseUrl: 'https://user:private@provider.example/v1' },
      { enabled: true, baseUrl: 'https://provider.example/v1?api_key=private' },
      { baseUrl: 'file:///tmp/model' },
    ])
      await update(body).expect(400);
    expect(
      await db.aIConfig.count({ where: { key: { startsWith: configPrefix } } }),
    ).toBe(0);
  });

  it('returns a redacted actionable error and never stores provider secrets in audit logs', async () => {
    await update({
      enabled: true,
      model: 'translation-model',
      apiKey: key,
      baseUrl: upstreamUrl,
    }).expect(200);
    upstreamFailure = true;
    const response = await generate().expect(502);
    expect(response.body.message).toContain('手工填写英文');
    expect(response.body.message).toContain('全局配置管理员');
    expect(JSON.stringify(response.body)).not.toContain(key);
    expect(upstreamCalls).toHaveLength(1);
    const logs = await db.operationLog.findMany({
      where: { adminId: { in: ids } },
    });
    expect(JSON.stringify(logs)).not.toContain(key);
  });
});
