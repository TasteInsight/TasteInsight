import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { PrismaService } from '@/prisma.service';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';
import { MealTime } from '@/common/enums';

describe('MealPlansService', () => {
  let service: MealPlansService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      mealPlan: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealPlansService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<MealPlansService>(MealPlansService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMealPlans', () => {
    it('should return meal plans for a user', async () => {
      const userId = 'user1';
      const mockMealPlans = [
        {
          id: 'mp1',
          userId,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-02'),
          mealTime: MealTime.BREAKFAST,
          dishes: [{ dishId: 'dish1' }, { dishId: 'dish2' }],
          createdAt: new Date(),
        },
      ];
      (prisma.mealPlan.findMany as jest.Mock).mockResolvedValue(mockMealPlans);

      const result = await service.getMealPlans(userId);

      expect(prisma.mealPlan.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { dishes: true },
        orderBy: { startDate: 'desc' },
      });
      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].dishes).toEqual(['dish1', 'dish2']);
    });
  });

  describe('createMealPlan', () => {
    it('should create a meal plan', async () => {
      const userId = 'user1';
      const createDto: CreateMealPlanDto = {
        startDate: '2025-01-01',
        endDate: '2025-01-02',
        mealTime: MealTime.BREAKFAST,
        dishes: ['dish1', 'dish2', 'dish1'], // duplicate
      };
      const mockCreated = {
        id: 'mp1',
        userId,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-02'),
        mealTime: MealTime.BREAKFAST,
        dishes: [{ dishId: 'dish1' }, { dishId: 'dish2' }],
        createdAt: new Date(),
      };
      (prisma.mealPlan.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await service.createMealPlan(userId, createDto);

      expect(prisma.mealPlan.create).toHaveBeenCalledWith({
        data: {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-02'),
          mealTime: MealTime.BREAKFAST,
          userId,
          dishes: {
            create: [{ dishId: 'dish1' }, { dishId: 'dish2' }], // deduplicated
          },
        },
        include: { dishes: true },
      });
      expect(result.code).toBe(201);
      expect(result.data.dishes).toEqual(['dish1', 'dish2']);
    });
  });

  describe('updateMealPlan', () => {
    it('should update a meal plan', async () => {
      const id = 'mp1';
      const userId = 'user1';
      const updateDto: UpdateMealPlanDto = {
        dishes: ['dish3', 'dish4', 'dish3'],
      };
      const mockExisting = {
        id,
        userId,
        startDate: new Date(),
        endDate: new Date(),
        mealTime: MealTime.BREAKFAST,
      };
      const mockUpdated = {
        ...mockExisting,
        dishes: [{ dishId: 'dish3' }, { dishId: 'dish4' }],
        createdAt: new Date(),
      };
      (prisma.mealPlan.findUnique as jest.Mock).mockResolvedValue(mockExisting);
      (prisma.mealPlan.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await service.updateMealPlan(id, userId, updateDto);

      expect(prisma.mealPlan.findUnique).toHaveBeenCalledWith({
        where: { id },
      });
      expect(prisma.mealPlan.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          dishes: {
            deleteMany: {},
            create: [{ dishId: 'dish3' }, { dishId: 'dish4' }],
          },
        },
        include: { dishes: true },
      });
      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if meal plan not found', async () => {
      (prisma.mealPlan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateMealPlan('invalid', 'user1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the meal plan', async () => {
      const mockExisting = { id: 'mp1', userId: 'user2' };
      (prisma.mealPlan.findUnique as jest.Mock).mockResolvedValue(mockExisting);

      await expect(service.updateMealPlan('mp1', 'user1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteMealPlan', () => {
    it('should delete a meal plan', async () => {
      const id = 'mp1';
      const userId = 'user1';
      const mockExisting = { id, userId };
      (prisma.mealPlan.findUnique as jest.Mock).mockResolvedValue(mockExisting);
      (prisma.mealPlan.delete as jest.Mock).mockResolvedValue(mockExisting);

      const result = await service.deleteMealPlan(id, userId);

      expect(prisma.mealPlan.findUnique).toHaveBeenCalledWith({
        where: { id },
      });
      expect(prisma.mealPlan.delete).toHaveBeenCalledWith({ where: { id } });
      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if meal plan not found', async () => {
      (prisma.mealPlan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteMealPlan('invalid', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own the meal plan', async () => {
      const mockExisting = { id: 'mp1', userId: 'user2' };
      (prisma.mealPlan.findUnique as jest.Mock).mockResolvedValue(mockExisting);

      await expect(service.deleteMealPlan('mp1', 'user1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
