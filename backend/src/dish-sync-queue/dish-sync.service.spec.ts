import { Test, TestingModule } from '@nestjs/testing';
import { DishSyncService } from './dish-sync.service';
import { PrismaService } from '@/prisma.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { DISH_SYNC_QUEUE } from './dish-sync.constants';

const mockPrismaService = {
  dish: {
    updateMany: jest.fn(),
  },
  floor: {
    findUnique: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test'),
};

const mockQueue = {
  add: jest.fn(),
  getWaitingCount: jest.fn().mockResolvedValue(1),
  getActiveCount: jest.fn().mockResolvedValue(2),
  getCompletedCount: jest.fn().mockResolvedValue(3),
  getFailedCount: jest.fn().mockResolvedValue(4),
  getDelayedCount: jest.fn().mockResolvedValue(5),
};

describe('DishSyncService', () => {
  let service: DishSyncService;
  let prisma: typeof mockPrismaService;
  let queue: typeof mockQueue;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('test');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishSyncService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken(DISH_SYNC_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<DishSyncService>(DishSyncService);
    prisma = mockPrismaService;
    queue = mockQueue;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncCanteenName', () => {
    it('should sync synchronously in test mode', async () => {
      await service.syncCanteenName('c1', 'New Name');

      expect(prisma.dish.updateMany).toHaveBeenCalledWith({
        where: { canteenId: 'c1' },
        data: { canteenName: 'New Name' },
      });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should use queue in async mode', async () => {
      mockConfigService.get.mockReturnValue('production');
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DishSyncService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: getQueueToken(DISH_SYNC_QUEUE), useValue: mockQueue },
        ],
      }).compile();
      const asyncService = module.get<DishSyncService>(DishSyncService);

      await asyncService.syncCanteenName('c1', 'New Name');

      expect(queue.add).toHaveBeenCalled();
      expect(prisma.dish.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('syncWindowInfo', () => {
    it('should sync synchronously in test mode (basic)', async () => {
      await service.syncWindowInfo('w1', 'Win Name', 'W101');

      expect(prisma.dish.updateMany).toHaveBeenCalledWith({
        where: { windowId: 'w1' },
        data: { windowName: 'Win Name', windowNumber: 'W101' },
      });
    });

    it('should sync synchronously with floor update', async () => {
      prisma.floor.findUnique.mockResolvedValue({
        id: 'f1',
        name: 'Floor 1',
        level: '1F',
      });

      await service.syncWindowInfo('w1', 'Win Name', undefined, 'f1');

      expect(prisma.floor.findUnique).toHaveBeenCalledWith({
        where: { id: 'f1' },
      });
      expect(prisma.dish.updateMany).toHaveBeenCalledWith({
        where: { windowId: 'w1' },
        data: {
          windowName: 'Win Name',
          floorId: 'f1',
          floorName: 'Floor 1',
          floorLevel: '1F',
        },
      });
    });

    it('should handle missing floor in synchronous mode', async () => {
      prisma.floor.findUnique.mockResolvedValue(null);

      await service.syncWindowInfo('w1', 'Win Name', undefined, 'f1');

      expect(prisma.dish.updateMany).toHaveBeenCalledWith({
        where: { windowId: 'w1' },
        data: { windowName: 'Win Name' }, // No floor update
      });
    });

    it('should use queue in async mode', async () => {
      mockConfigService.get.mockReturnValue('production');
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DishSyncService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: getQueueToken(DISH_SYNC_QUEUE), useValue: mockQueue },
        ],
      }).compile();
      const asyncService = module.get<DishSyncService>(DishSyncService);

      await asyncService.syncWindowInfo('w1', 'Win Name');

      expect(queue.add).toHaveBeenCalled();
    });
  });

  describe('syncFloorInfo', () => {
    it('should sync synchronously in test mode', async () => {
      await service.syncFloorInfo('f1', 'Floor 1', '1F');

      expect(prisma.dish.updateMany).toHaveBeenCalledWith({
        where: { floorId: 'f1' },
        data: { floorName: 'Floor 1', floorLevel: '1F' },
      });
    });

    it('should use queue in async mode', async () => {
      mockConfigService.get.mockReturnValue('production');
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DishSyncService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: getQueueToken(DISH_SYNC_QUEUE), useValue: mockQueue },
        ],
      }).compile();
      const asyncService = module.get<DishSyncService>(DishSyncService);

      await asyncService.syncFloorInfo('f1', 'Floor 1', '1F');

      expect(queue.add).toHaveBeenCalled();
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', async () => {
      const status = await service.getQueueStatus();

      expect(status).toEqual({
        waiting: 1,
        active: 2,
        completed: 3,
        failed: 4,
        delayed: 5,
      });
    });
  });
});
