import { NestFactory } from '@nestjs/core';
import { spawnSync } from 'node:child_process';
import { migrateAndInitialize } from './main.migrate';
import { DatabaseInitializer } from './runtime/database-initializer.service';
import { MigrationAppModule } from './runtime/migration-app.module';

jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  spawnSync: jest.fn(),
}));

describe('one-off migration runner', () => {
  const initialize = jest.fn();
  const close = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue({
      get: (token: unknown) => {
        expect(token).toBe(DatabaseInitializer);
        return { initialize };
      },
      close,
    } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('runs migrations before initialization and closes the database', async () => {
    jest.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
    await migrateAndInitialize();
    expect(spawnSync).toHaveBeenCalledWith(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      { stdio: 'inherit', env: process.env },
    );
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(NestFactory.createApplicationContext).toHaveBeenCalledWith(
      MigrationAppModule,
    );
    expect(jest.mocked(spawnSync).mock.invocationCallOrder[0]).toBeLessThan(
      initialize.mock.invocationCallOrder[0],
    );
    expect(close).toHaveBeenCalledTimes(1);
    expect(initialize.mock.invocationCallOrder[0]).toBeLessThan(
      close.mock.invocationCallOrder[0],
    );
  });

  it.each([1, null])('fails closed for migration status %s', async (status) => {
    jest.mocked(spawnSync).mockReturnValue({ status } as any);
    await expect(migrateAndInitialize()).rejects.toThrow(
      'Database migrations failed',
    );
    expect(initialize).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the connection when initialization fails', async () => {
    jest.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
    initialize.mockRejectedValue(new Error('Initialization failure'));
    await expect(migrateAndInitialize()).rejects.toThrow(
      'Initialization failure',
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('skips initialization and closes the connection when migration cannot start', async () => {
    const error = new Error('Migration process unavailable');
    jest
      .mocked(spawnSync)
      .mockReturnValue({ status: null, error } as ReturnType<typeof spawnSync>);
    await expect(migrateAndInitialize()).rejects.toBe(error);
    expect(initialize).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
