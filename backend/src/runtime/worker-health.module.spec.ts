import { ServiceUnavailableException } from '@nestjs/common';
import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  WorkerHealthController,
  WorkerHealthModule,
} from './worker-health.module';

describe('internal worker readiness', () => {
  let prisma: { $queryRaw: jest.Mock };
  let cache: { isConnected: jest.Mock; getRedisClient: jest.Mock };
  let processors: any[];
  let controller: WorkerHealthController;
  let ping: jest.Mock;

  beforeEach(() => {
    ping = jest.fn().mockResolvedValue('PONG');
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    cache = {
      isConnected: jest.fn().mockReturnValue(true),
      getRedisClient: jest.fn().mockReturnValue({ ping }),
    };
    processors = Array.from({ length: 5 }, () => ({
      worker: {
        isRunning: jest.fn().mockReturnValue(true),
        isPaused: jest.fn().mockReturnValue(false),
        client: Promise.resolve({ ping }),
      },
    }));
    controller = new WorkerHealthController(
      prisma as any,
      cache as any,
      processors[0],
      processors[1],
      processors[2],
      processors[3],
      processors[4],
    );
  });

  it('exposes health only', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, WorkerHealthModule),
    ).toEqual([WorkerHealthController]);
    expect(Reflect.getMetadata(PATH_METADATA, WorkerHealthController)).toBe(
      'health',
    );
  });

  it('checks database, cache Redis and all five consumer Redis clients', async () => {
    await expect(controller.getHealth()).resolves.toEqual({ status: 'ok' });
    expect(prisma.$queryRaw.mock.calls[0][0].join('')).toBe('SELECT 1');
    expect(ping).toHaveBeenCalledTimes(6);
  });

  it.each([
    'stopped',
    'paused',
    'recommendation-stopped',
    'closing',
    'cache-disconnected',
    'redis-failure',
    'db-failure',
  ])('is unavailable when a dependency is %s', async (failure) => {
    if (failure === 'stopped')
      processors[0].worker.isRunning.mockReturnValue(false);
    if (failure === 'recommendation-stopped') processors[4].worker.isRunning.mockReturnValue(false);
    if (failure === 'paused')
      processors[1].worker.isPaused.mockReturnValue(true);
    if (failure === 'closing') processors[2].worker.closing = Promise.resolve();
    if (failure === 'cache-disconnected')
      cache.isConnected.mockReturnValue(false);
    if (failure === 'redis-failure')
      ping.mockRejectedValue(new Error('Redis unavailable'));
    if (failure === 'db-failure')
      prisma.$queryRaw.mockRejectedValue(new Error('DB unavailable'));
    await expect(controller.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('bounds stalled dependency checks and clears the deadline', async () => {
    jest.useFakeTimers();
    try {
      prisma.$queryRaw.mockReturnValue(new Promise(() => undefined));
      const readiness = expect(controller.getHealth()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await jest.advanceTimersByTimeAsync(2000);
      await readiness;
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
