import { Test, TestingModule } from '@nestjs/testing';
import { MealPlansService } from './meal-plans.service';
import { PrismaService } from '@/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

const mockPrismaService = {
  $transaction: jest.fn(async (operation: any) => operation(mockPrismaService)),
  $queryRaw: jest.fn(),
  dish: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  userPreference: { findUnique: jest.fn() },
  diningInvite: { count: jest.fn().mockResolvedValue(0) },
  mealPlanCompletion: { deleteMany: jest.fn(), upsert: jest.fn() },
  mealPlan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('MealPlansService', () => {
  let service: MealPlansService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(async (operation: any) =>
      operation(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealPlansService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MealPlansService>(MealPlansService);
    prisma = mockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMealPlans', () => {
    it('should return list of meal plans', async () => {
      const mockMealPlans = [
        {
          id: 'mp1',
          userId: 'u1',
          startDate: new Date(),
          endDate: new Date(),
          mealTime: 'lunch',
          dishes: [{ dishId: 'd1' }, { dishId: 'd2' }],
          createdAt: new Date(),
        },
      ];
      prisma.mealPlan.findMany.mockResolvedValue(mockMealPlans);

      const result = await service.getMealPlans('u1');

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].dishes).toEqual(['d1', 'd2']);
    });
  });

  describe('createMealPlan', () => {
    const createDto = {
      startDate: '2024-01-01',
      endDate: '2024-01-07',
      mealTime: 'lunch',
      dishes: ['d1', 'd2'],
    };

    it('should create a new meal plan', async () => {
      prisma.mealPlan.create.mockResolvedValue({
        id: 'mp1',
        userId: 'u1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        mealTime: 'lunch',
        dishes: [{ dishId: 'd1' }, { dishId: 'd2' }],
        createdAt: new Date(),
      });

      const result = await service.createMealPlan('u1', createDto as any);

      expect(result.code).toBe(201);
      expect(result.message).toBe('规划计划保存成功');
    });
  });

  describe('confirmation by dish ID', () => {
    const dto = {
      startDate: '2099-10-05',
      endDate: '2099-10-05',
      mealTime: 'lunch',
      dishes: ['d1'],
    } as any;
    it('uses current dish associations without locking supply or preferences', async () => {
      prisma.mealPlan.create.mockResolvedValue({
        id: 'saved',
        userId: 'u1',
        startDate: new Date('2099-10-05'),
        endDate: new Date('2099-10-05'),
        mealTime: 'lunch',
        dishes: [{ dishId: 'd1' }],
        createdAt: new Date(),
      });
      const result = await service.createMealPlan('u1', dto);
      expect(result.data.dishes).toEqual(['d1']);
      expect(
        prisma.mealPlan.create.mock.calls[0][0].data.dishes.create,
      ).toEqual([{ dishId: 'd1' }]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.userPreference.findUnique).not.toHaveBeenCalled();
    });
    it('reports a truly deleted dish through the relation constraint', async () => {
      prisma.mealPlan.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('missing connected dish', {
          code: 'P2003',
          meta: { constraint: 'meal_plan_dishes_dishId_fkey' },
          clientVersion: 'test',
        }),
      );
      await expect(service.createMealPlan('u1', dto)).rejects.toThrow(
        '部分菜品已删除',
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
    it('propagates transaction errors once', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'transaction failed',
        { code: 'P2034', clientVersion: 'test' },
      );
      prisma.$transaction.mockRejectedValueOnce(error);
      await expect(service.createMealPlan('u1', dto)).rejects.toBe(error);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateMealPlan', () => {
    const updateDto = {
      mealTime: 'dinner',
    };

    beforeEach(() => {
      prisma.mealPlan.findUnique.mockResolvedValue({
        id: 'mp1',
        userId: 'u1',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-03'),
        mealTime: 'lunch',
      });
    });

    it('should update a meal plan', async () => {
      prisma.mealPlan.update.mockResolvedValue({
        id: 'mp1',
        userId: 'u1',
        startDate: new Date(),
        endDate: new Date(),
        mealTime: 'dinner',
        dishes: [],
        createdAt: new Date(),
      });

      const result = await service.updateMealPlan(
        'mp1',
        'u1',
        updateDto as any,
      );

      expect(result.code).toBe(200);
      expect(result.message).toBe('规划计划更新成功');
    });

    it('should throw NotFoundException if meal plan not found', async () => {
      prisma.mealPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMealPlan('unknown', 'u1', updateDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      prisma.mealPlan.findUnique.mockResolvedValue({
        id: 'mp1',
        userId: 'other-user',
      });

      await expect(
        service.updateMealPlan('mp1', 'u1', updateDto as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update dishes if provided', async () => {
      prisma.mealPlan.update.mockResolvedValue({
        id: 'mp1',
        userId: 'u1',
        startDate: new Date(),
        endDate: new Date(),
        mealTime: 'dinner',
        dishes: [{ dishId: 'd3' }],
        createdAt: new Date(),
      });

      const result = await service.updateMealPlan('mp1', 'u1', {
        dishes: ['d3'],
      } as any);

      expect(result.code).toBe(200);
    });
  });

  describe('deleteMealPlan', () => {
    beforeEach(() => {
      prisma.mealPlan.findUnique.mockResolvedValue({
        id: 'mp1',
        userId: 'u1',
      });
    });

    it('should delete a meal plan', async () => {
      prisma.mealPlan.delete.mockResolvedValue({});

      const result = await service.deleteMealPlan('mp1', 'u1');

      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
    });

    it('should throw NotFoundException if meal plan not found', async () => {
      prisma.mealPlan.findUnique.mockResolvedValue(null);

      await expect(service.deleteMealPlan('unknown', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      prisma.mealPlan.findUnique.mockResolvedValue({
        id: 'mp1',
        userId: 'other-user',
      });

      await expect(service.deleteMealPlan('mp1', 'u1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
