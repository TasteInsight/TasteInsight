import { Test, TestingModule } from '@nestjs/testing';
import { CanteensService } from './canteens.service';
import { PrismaService } from '@/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { DishDto } from '@/dishes/dto/dish.dto';

const mockPrismaService = {
  canteen: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  window: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  dish: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('CanteensService', () => {
  let service: CanteensService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanteensService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CanteensService>(CanteensService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCanteens', () => {
    it('should return a list of canteens', async () => {
      const mockCanteens = [
        {
          id: '1',
          name: 'Canteen 1',
          windows: [
            {
              id: 'w1',
              name: 'Window 1',
              floor: { level: '1', name: 'Floor 1' },
              tags: ['tag1'],
            },
          ],
          floors: [],
        },
      ];
      const mockTotal = 1;

      (prisma.canteen.findMany as jest.Mock).mockResolvedValue(mockCanteens);
      (prisma.canteen.count as jest.Mock).mockResolvedValue(mockTotal);

      const result = await service.getCanteens(1, 10);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].windows).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
      expect(prisma.canteen.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        include: { windows: { include: { floor: true } } },
      });
    });
  });

  describe('getCanteenById', () => {
    it('should return a canteen by id', async () => {
      const mockCanteen = {
        id: '1',
        name: 'Canteen 1',
        windows: [],
        floors: [],
      };

      (prisma.canteen.findUnique as jest.Mock).mockResolvedValue(mockCanteen);

      const result = await service.getCanteenById('1');

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('1');
      expect(prisma.canteen.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { windows: { include: { floor: true } } },
      });
    });

    it('should throw NotFoundException if canteen not found', async () => {
      (prisma.canteen.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getCanteenById('1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCanteenWindows', () => {
    it('should return windows for a canteen', async () => {
      const mockWindows = [
        {
          id: 'w1',
          name: 'Window 1',
          canteenId: '1',
          floor: { level: '1', name: 'Floor 1' },
        },
      ];
      const mockTotal = 1;

      (prisma.window.findMany as jest.Mock).mockResolvedValue(mockWindows);
      (prisma.window.count as jest.Mock).mockResolvedValue(mockTotal);

      const result = await service.getCanteenWindows('1', 1, 10);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
      expect(prisma.window.findMany).toHaveBeenCalledWith({
        where: { canteenId: '1' },
        skip: 0,
        take: 10,
        include: { floor: true },
      });
    });

    it('should reset page to 1 if page is less than 1', async () => {
      const mockWindows = [];
      const mockTotal = 0;

      (prisma.window.findMany as jest.Mock).mockResolvedValue(mockWindows);
      (prisma.window.count as jest.Mock).mockResolvedValue(mockTotal);

      await service.getCanteenWindows('1', 0, 10);

      expect(prisma.window.findMany).toHaveBeenCalledWith({
        where: { canteenId: '1' },
        skip: 0, // (1 - 1) * 10 = 0
        take: 10,
        include: { floor: true },
      });
    });
  });

  describe('getWindowById', () => {
    it('should return a window by id', async () => {
      const mockWindow = {
        id: 'w1',
        name: 'Window 1',
        floor: { level: '1', name: 'Floor 1' },
        tags: ['tag1'],
      };

      (prisma.window.findUnique as jest.Mock).mockResolvedValue(mockWindow);

      const result = await service.getWindowById('w1');

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('w1');
      expect(result.data.tags).toEqual(['tag1']);
      expect(prisma.window.findUnique).toHaveBeenCalledWith({
        where: { id: 'w1' },
        include: { floor: true },
      });
    });

    it('should throw NotFoundException if window not found', async () => {
      (prisma.window.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getWindowById('w1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return a window without floor', async () => {
      const mockWindow = {
        id: 'w1',
        name: 'Window 1',
        floor: null,
      };

      (prisma.window.findUnique as jest.Mock).mockResolvedValue(mockWindow);

      const result = await service.getWindowById('w1');

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('w1');
      expect(result.data.floor).toBeUndefined();
      expect(prisma.window.findUnique).toHaveBeenCalledWith({
        where: { id: 'w1' },
        include: { floor: true },
      });
    });

    it('should handle window without tags', async () => {
      const mockWindow = {
        id: 'w1',
        name: 'Window 1',
        floor: { level: '1', name: 'Floor 1' },
        tags: null, // Simulate null tags
      };

      (prisma.window.findUnique as jest.Mock).mockResolvedValue(mockWindow);

      const result = await service.getWindowById('w1');

      expect(result.code).toBe(200);
      expect(result.data.tags).toEqual([]);
    });
  });

  describe('getWindowDishes', () => {
    it('should return dishes for a window', async () => {
      const mockDishes = [
        {
          id: 'd1',
          name: 'Dish 1',
          windowId: 'w1',
          // Add other necessary fields for DishDto.fromEntity
        },
      ];
      const mockTotal = 1;

      (prisma.dish.findMany as jest.Mock).mockResolvedValue(mockDishes);
      (prisma.dish.count as jest.Mock).mockResolvedValue(mockTotal);

      // Mock DishDto.fromEntity to avoid complex object creation
      const fromEntitySpy = jest.spyOn(DishDto, 'fromEntity').mockReturnValue({
        id: 'd1',
        name: 'Dish 1',
      } as any);

      const result = await service.getWindowDishes('w1', 1, 10);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
      expect(prisma.dish.findMany).toHaveBeenCalledWith({
        where: { windowId: 'w1' },
        skip: 0,
        take: 10,
      });

      fromEntitySpy.mockRestore();
    });

    it('should reset page to 1 if page is less than 1', async () => {
      const mockDishes = [];
      const mockTotal = 0;

      (prisma.dish.findMany as jest.Mock).mockResolvedValue(mockDishes);
      (prisma.dish.count as jest.Mock).mockResolvedValue(mockTotal);

      await service.getWindowDishes('w1', 0, 10);

      expect(prisma.dish.findMany).toHaveBeenCalledWith({
        where: { windowId: 'w1' },
        skip: 0,
        take: 10,
      });
    });
  });
});
