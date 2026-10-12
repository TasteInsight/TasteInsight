import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

describe('application readiness', () => {
  const prisma = { $queryRaw: jest.fn() };
  let service: AppService;

  beforeEach(() => {
    jest.useFakeTimers();
    prisma.$queryRaw.mockReset();
    service = new AppService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is ready after PostgreSQL answers and clears its deadline', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(service.getHealth()).resolves.toEqual({ status: 'ok' });
    expect(prisma.$queryRaw.mock.calls[0][0].join('')).toBe('SELECT 1');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('converts database failures into a generic 503 and clears its deadline', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('postgresql://private-user:private-password@private-db/app'),
    );
    await expect(service.getHealth()).rejects.toMatchObject({
      response: {
        statusCode: 503,
        message: 'Service unavailable',
        error: 'Service Unavailable',
      },
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('fails a stalled database probe after two seconds', async () => {
    prisma.$queryRaw.mockReturnValue(new Promise(() => {}));
    const probe = service.getHealth();
    const failure = expect(probe).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await jest.advanceTimersByTimeAsync(2000);
    await failure;
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('readiness HTTP contract', () => {
  let app: INestApplication;
  const service = { getHealth: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows an unauthenticated readiness probe without caching its result', async () => {
    service.getHealth.mockResolvedValue({ status: 'ok' });
    await request(app.getHttpServer())
      .get('/health')
      .expect('Cache-Control', 'no-store')
      .expect(200, { status: 'ok' });
  });

  it('returns an unavailable status without exposing dependency details', async () => {
    service.getHealth.mockRejectedValue(
      new ServiceUnavailableException('Service unavailable'),
    );
    await request(app.getHttpServer())
      .get('/health')
      .expect('Cache-Control', 'no-store')
      .expect(503, {
        message: 'Service unavailable',
        error: 'Service Unavailable',
        statusCode: 503,
      });
  });
});

it('starting a health endpoint does not initialize administrator data', async () => {
  const admin = {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({ id: 'bootstrap-admin' }),
  };
  const module = await Test.createTestingModule({
    controllers: [AppController],
    providers: [
      AppService,
      { provide: PrismaService, useValue: { admin, $queryRaw: jest.fn() } },
      {
        provide: ConfigService,
        useValue: new ConfigService({
          INITIAL_ADMIN_USERNAME: 'admin',
          INITIAL_ADMIN_PASSWORD: 'Bootstrap-configuration-fixture',
        }),
      },
    ],
  }).compile();
  const application = module.createNestApplication();
  try {
    await application.init();
    expect(admin.count).not.toHaveBeenCalled();
    expect(admin.create).not.toHaveBeenCalled();
  } finally {
    await application.close();
  }
});
