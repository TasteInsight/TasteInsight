import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Test } from '@nestjs/testing';
import { AdminConfigService } from '../admin-config/admin-config.service';
import { PrismaService } from '../prisma.service';
import { DatabaseInitializer } from './database-initializer.service';
import { DevelopmentInitializationModule } from './development-initialization.module';
import { InitializationModule } from './initialization.module';

describe('database initialization ownership', () => {
  const prisma = {
    admin: { count: jest.fn(), create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const adminConfig = { syncConfigTemplates: jest.fn() };
  const settings = {
    INITIAL_ADMIN_USERNAME: 'initial-admin',
    INITIAL_ADMIN_PASSWORD: 'private-bootstrap-password',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.admin.count.mockResolvedValue(0);
  });

  function initializer(values = settings) {
    return new DatabaseInitializer(
      prisma as unknown as PrismaService,
      new ConfigService(values),
      adminConfig as unknown as AdminConfigService,
    );
  }

  it('creates a hashed administrator only for an empty database', async () => {
    await initializer().initialize();
    expect(adminConfig.syncConfigTemplates).toHaveBeenCalledTimes(1);
    expect(prisma.admin.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.admin.create.mock.calls[0][0];
    expect(data).toMatchObject({
      scope: 'GLOBAL',
      username: settings.INITIAL_ADMIN_USERNAME,
      role: 'superadmin',
      mustChangePassword: true,
    });
    expect(data.password).not.toBe(settings.INITIAL_ADMIN_PASSWORD);
    await expect(
      bcrypt.compare(settings.INITIAL_ADMIN_PASSWORD, data.password),
    ).resolves.toBe(true);
  });

  it('preserves existing administrators even if bootstrap credentials change', async () => {
    prisma.admin.count.mockResolvedValue(1);
    await initializer().initialize();
    await initializer({
      INITIAL_ADMIN_USERNAME: 'replacement',
      INITIAL_ADMIN_PASSWORD: 'replacement-password',
    }).initialize();
    expect(prisma.admin.create).not.toHaveBeenCalled();
    expect(adminConfig.syncConfigTemplates).toHaveBeenCalledTimes(2);
  });

  it('does not invent bootstrap credentials', async () => {
    await initializer({
      INITIAL_ADMIN_USERNAME: '',
      INITIAL_ADMIN_PASSWORD: '',
    }).initialize();
    expect(prisma.admin.create).not.toHaveBeenCalled();
  });

  it('does not initialize before the migration runner explicitly requests it', async () => {
    const app = await Test.createTestingModule({
      imports: [InitializationModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    const syncTemplates = jest
      .spyOn(app.get(AdminConfigService), 'syncConfigTemplates')
      .mockResolvedValue(undefined);
    try {
      await app.init();
      expect(syncTemplates).not.toHaveBeenCalled();
      expect(prisma.admin.count).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      await app.get(DatabaseInitializer).initialize();
      expect(syncTemplates).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
      syncTemplates.mockRestore();
    }
  });

  it('uses the same initializer for the explicit development bootstrap', async () => {
    const initialize = jest.fn();
    const app = await Test.createTestingModule({
      imports: [DevelopmentInitializationModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(DatabaseInitializer)
      .useValue({ initialize })
      .compile();
    try {
      expect(initialize).not.toHaveBeenCalled();
      await app.init();
      expect(initialize).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
