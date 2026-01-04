import { Test, TestingModule } from '@nestjs/testing';
import { AdminCanteensService } from './admin-canteens.service';
import { PrismaService } from '@/prisma.service';
import { DishSyncService } from '@/dish-sync-queue/dish-sync.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrismaService = {
  canteen: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  floor: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  window: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
  },
  dish: {
    deleteMany: jest.fn(),
  },
  openingHours: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

const mockDishSyncService = {
  syncCanteenName: jest.fn(),
  syncWindowInfo: jest.fn(),
  syncFloorInfo: jest.fn(),
};

describe('AdminCanteensService', () => {
  let service: AdminCanteensService;
  let prisma: typeof mockPrismaService;
  let dishSyncService: typeof mockDishSyncService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCanteensService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: DishSyncService, useValue: mockDishSyncService },
      ],
    }).compile();

    service = module.get<AdminCanteensService>(AdminCanteensService);
    prisma = mockPrismaService;
    dishSyncService = mockDishSyncService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return list of canteens for superadmin', async () => {
      const mockCanteens = [
        {
          id: 'c1',
          name: 'Canteen 1',
          windows: [],
          floors: [],
          openingHours: [],
        },
      ];
      prisma.canteen.findMany.mockResolvedValue(mockCanteens);
      prisma.canteen.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it('should return only assigned canteen for canteen admin', async () => {
      const mockCanteens = [
        {
          id: 'c1',
          name: 'Canteen 1',
          windows: [],
          floors: [],
          openingHours: [],
        },
      ];
      prisma.canteen.findMany.mockResolvedValue(mockCanteens);
      prisma.canteen.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20, { canteenId: 'c1' });

      expect(result.code).toBe(200);
      expect(prisma.canteen.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a canteen by id', async () => {
      const mockCanteen = {
        id: 'c1',
        name: 'Canteen 1',
        windows: [{ id: 'w1', floor: { level: '1' } }],
        floors: [],
        openingHours: [],
      };
      prisma.canteen.findUnique.mockResolvedValue(mockCanteen);

      const result = await service.findOne('c1');

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('c1');
    });

    it('should throw NotFoundException if canteen not found', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(service.findOne('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(service.findOne('c2', { canteenId: 'c1' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'New Canteen',
      description: 'Test description',
      position: 'Building A',
      images: ['image1.jpg'],
      windows: [],
      floors: [],
      openingHours: [],
    };

    it('should create a new canteen', async () => {
      prisma.canteen.create.mockResolvedValue({
        id: 'new-id',
        name: 'New Canteen',
        windows: [],
        floors: [],
        openingHours: [],
      });

      const result = await service.create(createDto);

      expect(result.code).toBe(200);
      expect(result.data.name).toBe('New Canteen');
    });

    it('should throw ForbiddenException if canteen admin tries to create', async () => {
      await expect(
        service.create(createDto, { canteenId: 'c1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create canteen with windows', async () => {
      const createDtoWithWindows = {
        ...createDto,
        windows: [{ name: 'Window 1', number: '001' }],
      };
      prisma.canteen.create.mockResolvedValue({
        id: 'new-id',
        name: 'New Canteen',
        windows: [{ id: 'w1', name: 'Window 1' }],
        floors: [],
        openingHours: [],
      });

      const result = await service.create(createDtoWithWindows);

      expect(result.code).toBe(200);
    });

    it('should create canteen with floors', async () => {
      const createDtoWithFloors = {
        ...createDto,
        floors: [{ level: '1', name: 'Floor 1' }],
      };
      prisma.canteen.create.mockResolvedValue({
        id: 'new-id',
        name: 'New Canteen',
        windows: [],
        floors: [{ id: 'f1', level: '1', name: 'Floor 1' }],
        openingHours: [],
      });

      const result = await service.create(createDtoWithFloors);

      expect(result.code).toBe(200);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Canteen',
      description: 'Updated description',
    };

    beforeEach(() => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Original Canteen',
        windows: [],
        floors: [],
        openingHours: [],
      });
      prisma.canteen.update.mockResolvedValue({
        id: 'c1',
        name: 'Updated Canteen',
        windows: [],
        floors: [],
        openingHours: [],
      });
    });

    it('should update a canteen', async () => {
      const result = await service.update('c1', updateDto);

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if canteen not found', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(service.update('unknown', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(
        service.update('c1', updateDto, { canteenId: 'c2' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should sync canteen name if name changes', async () => {
      await service.update('c1', { name: 'New Name' });

      expect(dishSyncService.syncCanteenName).toHaveBeenCalledWith(
        'c1',
        'New Name',
      );
    });

    it('should update windows if provided', async () => {
      prisma.window.findMany.mockResolvedValue([
        { id: 'w1', name: 'Window 1', number: '001' },
      ]);

      await service.update('c1', {
        windows: [
          {
            id: 'w1',
            name: 'Updated Window',
            number: '001',
            position: undefined,
            description: undefined,
            tags: [],
          },
        ],
      });

      expect(prisma.window.update).toHaveBeenCalled();
    });

    it('should update floors if provided', async () => {
      prisma.floor.findMany.mockResolvedValue([
        { id: 'f1', level: '1', name: 'Floor 1' },
      ]);

      await service.update('c1', {
        floors: [{ id: 'f1', level: '1', name: 'Updated Floor' }],
      });

      expect(prisma.floor.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Canteen 1',
        windows: [],
      });
    });

    it('should delete a canteen', async () => {
      prisma.canteen.delete.mockResolvedValue({});

      const result = await service.remove('c1');

      expect(result.code).toBe(200);
      expect(prisma.canteen.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
    });

    it('should throw NotFoundException if canteen not found', async () => {
      prisma.canteen.findUnique.mockResolvedValue(null);

      await expect(service.remove('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if admin has no access', async () => {
      await expect(service.remove('c1', { canteenId: 'c2' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
