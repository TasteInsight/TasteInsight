import { Test, TestingModule } from '@nestjs/testing';
import { AdminWindowsService } from './admin-windows.service';
import { PrismaService } from '@/prisma.service';
import { DishSyncService } from '@/dish-sync-queue/dish-sync.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

const mockPrismaService = {
  window: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  canteen: {
    findUnique: jest.fn(),
  },
  floor: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

const mockDishSyncService = {
  syncWindowInfo: jest.fn(),
};

describe('AdminWindowsService', () => {
  let service: AdminWindowsService;
  let prisma: typeof mockPrismaService;
  let dishSyncService: typeof mockDishSyncService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminWindowsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: DishSyncService, useValue: mockDishSyncService },
      ],
    }).compile();

    service = module.get<AdminWindowsService>(AdminWindowsService);
    prisma = mockPrismaService;
    dishSyncService = mockDishSyncService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a window by id', async () => {
      const mockWindow = {
        id: 'w1',
        name: 'Window 1',
        number: '001',
        canteenId: 'c1',
        floorId: 'f1',
        floor: { id: 'f1', level: '1', name: 'Floor 1' },
        position: 'A1',
        description: 'Test',
        tags: ['tag1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.window.findUnique.mockResolvedValue(mockWindow);

      const result = await service.findOne('w1');

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('w1');
      expect(result.data.floor?.level).toBe('1');
    });

    it('should throw NotFoundException if window not found', async () => {
      prisma.window.findUnique.mockResolvedValue(null);

      await expect(service.findOne('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      prisma.window.findUnique.mockResolvedValue({
        id: 'w1',
        canteenId: 'c2',
        floor: null,
      });

      await expect(service.findOne('w1', { canteenId: 'c1' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAllByCanteen', () => {
    beforeEach(() => {
      prisma.canteen.findUnique.mockResolvedValue({ id: 'c1' });
    });

    it('should return list of windows for a canteen', async () => {
      const mockWindows = [
        {
          id: 'w1',
          name: 'Window 1',
          number: '001',
          canteenId: 'c1',
          floorId: 'f1',
          floor: { id: 'f1', level: '1', name: 'Floor 1' },
          position: null,
          description: null,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.window.findMany.mockResolvedValue(mockWindows);
      prisma.window.count.mockResolvedValue(1);

      const result = await service.findAllByCanteen('c1', 1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it('should throw NotFoundException if canteen not found', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(service.findAllByCanteen('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(
        service.findAllByCanteen('c1', 1, 20, { canteenId: 'c2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    const createDto = {
      canteenId: 'c1',
      name: 'New Window',
      number: '001',
      position: 'A1',
      description: 'Test',
      tags: ['tag1'],
    };

    beforeEach(() => {
      prisma.canteen.findUnique.mockResolvedValue({ id: 'c1' });
    });

    it('should create a new window', async () => {
      prisma.window.create.mockResolvedValue({
        id: 'new-id',
        name: 'New Window',
        number: '001',
        canteenId: 'c1',
        floorId: null,
        floor: null,
        position: 'A1',
        description: 'Test',
        tags: ['tag1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDto);

      expect(result.code).toBe(200);
      expect(result.data.name).toBe('New Window');
    });

    it('should throw NotFoundException if canteen not found', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(
        service.create(createDto, { canteenId: 'c2' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create window with floor', async () => {
      const createDtoWithFloor = {
        ...createDto,
        floor: { level: '1', name: 'Floor 1' },
      };
      prisma.floor.findFirst.mockResolvedValue(null);
      prisma.floor.create.mockResolvedValue({ id: 'new-floor-id' });
      prisma.window.create.mockResolvedValue({
        id: 'new-id',
        name: 'New Window',
        number: '001',
        canteenId: 'c1',
        floorId: 'new-floor-id',
        floor: { id: 'new-floor-id', level: '1', name: 'Floor 1' },
        position: 'A1',
        description: 'Test',
        tags: ['tag1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDtoWithFloor);

      expect(result.code).toBe(200);
      expect(result.data.floor?.level).toBe('1');
    });

    it('should use existing floor if found', async () => {
      const createDtoWithFloor = {
        ...createDto,
        floor: { level: '1', name: 'Floor 1' },
      };
      prisma.floor.findFirst.mockResolvedValue({ id: 'existing-floor' });
      prisma.window.create.mockResolvedValue({
        id: 'new-id',
        name: 'New Window',
        number: '001',
        canteenId: 'c1',
        floorId: 'existing-floor',
        floor: { id: 'existing-floor', level: '1', name: 'Floor 1' },
        position: 'A1',
        description: 'Test',
        tags: ['tag1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(createDtoWithFloor);

      expect(prisma.floor.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Window',
      position: 'B2',
    };

    beforeEach(() => {
      prisma.window.findUnique.mockResolvedValue({
        id: 'w1',
        name: 'Original Window',
        number: '001',
        canteenId: 'c1',
        floorId: 'f1',
      });
      prisma.window.update.mockResolvedValue({
        id: 'w1',
        name: 'Updated Window',
        number: '001',
        canteenId: 'c1',
        floorId: 'f1',
        floor: { id: 'f1', level: '1', name: 'Floor 1' },
        position: 'B2',
        description: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should update a window', async () => {
      const result = await service.update('w1', updateDto);

      expect(result.code).toBe(200);
      expect(result.data.name).toBe('Updated Window');
    });

    it('should throw NotFoundException if window not found', async () => {
      prisma.window.findUnique.mockResolvedValue(null);

      await expect(service.update('unknown', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(
        service.update('w1', updateDto, { canteenId: 'c2' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should sync window info if name changes', async () => {
      await service.update('w1', { name: 'New Name' });

      expect(dishSyncService.syncWindowInfo).toHaveBeenCalled();
    });

    it('should sync window info if number changes', async () => {
      await service.update('w1', { name: 'New Name', number: '002' });

      expect(dishSyncService.syncWindowInfo).toHaveBeenCalled();
    });

    it('should sync window info if floor changes', async () => {
      prisma.floor.findFirst.mockResolvedValue({ id: 'f2' });

      await service.update('w1', {
        name: 'New Name',
        floor: { level: '2', name: 'Floor 2' },
      });

      expect(dishSyncService.syncWindowInfo).toHaveBeenCalled();
    });

    it('should not sync if nothing changed', async () => {
      prisma.window.findUnique.mockResolvedValue({
        id: 'w1',
        name: 'Same Name',
        number: '001',
        canteenId: 'c1',
        floorId: 'f1',
      });
      prisma.window.update.mockResolvedValue({
        id: 'w1',
        name: 'Same Name',
        number: '001',
        canteenId: 'c1',
        floorId: 'f1',
        floor: { id: 'f1', level: '1', name: 'Floor 1' },
        position: 'B2',
        description: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.update('w1', { name: 'Same Name', position: 'B2' });

      expect(dishSyncService.syncWindowInfo).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.window.findUnique.mockResolvedValue({
        id: 'w1',
        canteenId: 'c1',
        dishes: [],
      });
    });

    it('should delete a window', async () => {
      prisma.window.delete.mockResolvedValue({});

      const result = await service.remove('w1');

      expect(result.code).toBe(200);
      expect(prisma.window.delete).toHaveBeenCalledWith({
        where: { id: 'w1' },
      });
    });

    it('should throw NotFoundException if window not found', async () => {
      prisma.window.findUnique.mockResolvedValue(null);

      await expect(service.remove('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(service.remove('w1', { canteenId: 'c2' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if window has dishes', async () => {
      prisma.window.findUnique.mockResolvedValue({
        id: 'w1',
        canteenId: 'c1',
        dishes: [{ id: 'd1' }],
      });

      await expect(service.remove('w1')).rejects.toThrow(BadRequestException);
    });
  });
});
