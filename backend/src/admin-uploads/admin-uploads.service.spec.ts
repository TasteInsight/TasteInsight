import { Test, TestingModule } from '@nestjs/testing';
import { AdminUploadsService } from './admin-uploads.service';
import { PrismaService } from '@/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

const mockPrismaService = {
  dishUpload: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  dish: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

describe('AdminUploadsService', () => {
  let service: AdminUploadsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUploadsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminUploadsService>(AdminUploadsService);
    prisma = mockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUploads', () => {
    it('filters keyword and canteen before counting and paging', async () => {
      prisma.dishUpload.findMany.mockResolvedValue([]);
      prisma.dishUpload.count.mockResolvedValue(25);
      const result = await service.getUploads(
        { keyword: '鸡肉', canteenId: 'c1', page: 2, pageSize: 10 },
        {},
      );
      const contains = { contains: '鸡肉', mode: 'insensitive' };
      const where = {
        canteenId: 'c1',
        OR: [
          { name: contains },
          { canteenName: contains },
          { windowName: contains },
          { user: { nickname: contains } },
          { admin: { username: contains } },
        ],
      };
      expect(prisma.dishUpload.count).toHaveBeenCalledWith({ where });
      expect(prisma.dishUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 10, take: 10 }),
      );
      expect(result.data.meta.total).toBe(25);
    });

    it('does not allow canteen filters to widen administrator scope', async () => {
      await expect(
        service.getUploads({ canteenId: 'other' }, { canteenId: 'own' }),
      ).rejects.toThrow(ForbiddenException);
    });
    const mockUploads = [
      {
        id: 'u1',
        name: 'Uploaded Dish',
        description: 'Description',
        price: 15,
        images: ['image.jpg'],
        tags: [],
        ingredients: [],
        allergens: [],
        spicyLevel: 0,
        sweetness: 0,
        saltiness: 0,
        oiliness: 0,
        status: 'pending',
        canteenId: 'c1',
        canteenName: 'Canteen 1',
        windowName: 'Window 1',
        windowNumber: '001',
        windowId: null,
        window: null,
        canteen: { id: 'c1', name: 'Canteen 1' },
        user: { id: 'user-1', nickname: 'User 1' },
        admin: null,
        parentDish: null,
        parentDishId: null,
        userId: 'user-1',
        adminId: null,
        rejectReason: null,
        approvedDishId: null,
        availableMealTime: [],
        availableDates: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should return list of uploads', async () => {
      prisma.dishUpload.findMany.mockResolvedValue(mockUploads);
      prisma.dishUpload.count.mockResolvedValue(1);

      const result = await service.getUploads({ page: 1, pageSize: 20 }, {});

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.dishUpload.findMany.mockResolvedValue([]);
      prisma.dishUpload.count.mockResolvedValue(0);

      await service.getUploads({ status: 'pending' }, {});

      expect(prisma.dishUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('should filter by canteenId for canteen admin', async () => {
      prisma.dishUpload.findMany.mockResolvedValue([]);
      prisma.dishUpload.count.mockResolvedValue(0);

      await service.getUploads({}, { canteenId: 'c1' });

      expect(prisma.dishUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ canteenId: 'c1' }),
        }),
      );
    });
  });

  describe('getUploadById', () => {
    const mockUpload = {
      id: 'u1',
      name: 'Uploaded Dish',
      status: 'pending',
      canteenId: 'c1',
      canteenName: 'Canteen 1',
      windowName: 'Window 1',
      windowNumber: '001',
      windowId: null,
      window: null,
      canteen: { id: 'c1', name: 'Canteen 1' },
      user: { id: 'user-1', nickname: 'User 1' },
      admin: null,
      parentDish: null,
      parentDishId: null,
      userId: 'user-1',
      adminId: null,
      tags: [],
      ingredients: [],
      allergens: [],
      images: [],
      spicyLevel: 0,
      sweetness: 0,
      saltiness: 0,
      oiliness: 0,
      rejectReason: null,
      approvedDishId: null,
      availableMealTime: [],
      availableDates: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return an upload by id', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue(mockUpload);

      const result = await service.getUploadById('u1', { role: 'superadmin' });

      expect(result.code).toBe(200);
      expect(result.data.id).toBe('u1');
    });

    it('should throw NotFoundException if upload not found', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue(null);

      await expect(service.getUploadById('unknown', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        ...mockUpload,
        canteenId: 'c2',
      });

      await expect(
        service.getUploadById('u1', { canteenId: 'c1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approveUpload', () => {
    it('copies the submitted price unit into the approved dish', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        id: 'unit-upload',
        canteenId: 'c1',
        price: 12,
        priceUnit: '斤',
      });
      prisma.dishUpload.updateMany.mockResolvedValue({ count: 1 });
      prisma.dish.create.mockResolvedValue({ id: 'unit-dish' });
      await service.approveUpload('unit-upload', {});
      expect(prisma.dish.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priceUnit: '斤' }),
        }),
      );
    });
    const mockUpload = {
      id: 'u1',
      name: 'Uploaded Dish',
      description: 'Description',
      price: 15,
      images: ['image.jpg'],
      tags: [],
      ingredients: [],
      allergens: [],
      spicyLevel: 0,
      sweetness: 0,
      saltiness: 0,
      oiliness: 0,
      status: 'pending',
      canteenId: 'c1',
      canteenName: 'Canteen 1',
      windowName: 'Window 1',
      windowNumber: '001',
      windowId: 'w1',
      window: {
        id: 'w1',
        canteenId: 'c1',
        floorId: null,
        floor: null,
      },
      canteen: { id: 'c1', name: 'Canteen 1' },
      parentDish: null,
      parentDishId: null,
      availableMealTime: [],
      availableDates: null,
    };

    beforeEach(() => {
      prisma.dishUpload.findUnique.mockResolvedValue(mockUpload);
      prisma.dishUpload.updateMany.mockResolvedValue({ count: 1 });
    });

    it('should approve an upload and create a new dish', async () => {
      prisma.dish.create.mockResolvedValue({
        id: 'new-dish-id',
        name: 'Uploaded Dish',
      });
      prisma.dishUpload.update.mockResolvedValue({
        ...mockUpload,
        status: 'approved',
      });

      const result = await service.approveUpload('u1', {});

      expect(result.code).toBe(200);
      expect(prisma.dish.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if upload not found', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue(null);

      await expect(service.approveUpload('unknown', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already processed', async () => {
      prisma.dishUpload.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.approveUpload('u1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        ...mockUpload,
        canteenId: 'c2',
      });

      await expect(
        service.approveUpload('u1', { canteenId: 'c1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectUpload', () => {
    beforeEach(() => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        id: 'u1',
        status: 'pending',
        canteenId: 'c1',
      });
    });

    it('should reject an upload with reason', async () => {
      prisma.dishUpload.update.mockResolvedValue({
        id: 'u1',
        status: 'rejected',
        rejectReason: 'Invalid data',
      });

      const result = await service.rejectUpload('u1', 'Invalid data', {});

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if upload not found', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectUpload('unknown', 'reason', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already approved', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        id: 'u1',
        status: 'approved',
        canteenId: 'c1',
      });

      await expect(service.rejectUpload('u1', 'reason', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        id: 'u1',
        status: 'pending',
        canteenId: 'c2',
      });

      await expect(
        service.rejectUpload('u1', 'reason', { canteenId: 'c1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeUpload', () => {
    beforeEach(() => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        id: 'u1',
        status: 'approved',
        canteenId: 'c1',
        approvedDishId: 'd1',
      });
    });

    it('should revoke an approved upload', async () => {
      prisma.dish.delete.mockResolvedValue({});
      prisma.dishUpload.update.mockResolvedValue({
        id: 'u1',
        status: 'pending',
      });

      const result = await service.revokeUpload('u1', {});

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if upload not found', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue(null);

      await expect(service.revokeUpload('unknown', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return success if already pending', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        id: 'u1',
        status: 'pending',
        canteenId: 'c1',
      });

      const result = await service.revokeUpload('u1', {});

      expect(result.code).toBe(200);
      expect(result.message).toBe('已是待审核状态');
    });

    it('should throw ForbiddenException if canteen admin has no access', async () => {
      prisma.dishUpload.findUnique.mockResolvedValue({
        id: 'u1',
        status: 'approved',
        canteenId: 'c2',
        approvedDishId: 'd1',
      });

      await expect(
        service.revokeUpload('u1', { canteenId: 'c1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
