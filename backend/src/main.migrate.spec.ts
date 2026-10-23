import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { migrateRecommendationStore } from '../scripts/recommendation-store-migrate';
jest.mock('../scripts/recommendation-store-migrate', () => ({
  migrateRecommendationStore: jest.fn(),
}));
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
  const configGet = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue({
      get: (token: unknown) => {
        if (token === ConfigService) return { get: configGet };
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
  it('migrates the configured recommendation database after business migration and before initialization', async () => {
    jest
      .mocked(spawnSync)
      .mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);
    configGet.mockReturnValue(
      'postgresql://user:password@recommendation-db/vectors',
    );
    await migrateAndInitialize();
    expect(migrateRecommendationStore).toHaveBeenCalledWith(
      'postgresql://user:password@recommendation-db/vectors',
    );
    expect(jest.mocked(spawnSync).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(migrateRecommendationStore).mock.invocationCallOrder[0],
    );
    expect(
      jest.mocked(migrateRecommendationStore).mock.invocationCallOrder[0],
    ).toBeLessThan(initialize.mock.invocationCallOrder[0]);
  });

  it('skips recommendation migration when no URL is configured', async () => {
    jest
      .mocked(spawnSync)
      .mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);
    await migrateAndInitialize();
    expect(migrateRecommendationStore).not.toHaveBeenCalled();
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('skips initialization and closes resources if recommendation migration fails', async () => {
    jest
      .mocked(spawnSync)
      .mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);
    configGet.mockReturnValue(
      'postgresql://user:password@recommendation-db/vectors',
    );
    jest
      .mocked(migrateRecommendationStore)
      .mockRejectedValue(new Error('vector migration failed'));
    await expect(migrateAndInitialize()).rejects.toThrow(
      'vector migration failed',
    );
    expect(initialize).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
