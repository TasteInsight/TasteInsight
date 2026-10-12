import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MealPlansService } from './meal-plans.service';
import { MealPlanQueryDto } from './dto/meal-plan-query.dto';

const saved = () => ({
  id: 'p',
  userId: 'owner',
  startDate: new Date('2026-10-01'),
  endDate: new Date('2026-10-03'),
  mealTime: 'lunch',
  dishes: [],
  completions: [],
  isPublic: false,
  createdAt: new Date(),
});
function fixture() {
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    mealPlan: {
      findUnique: jest.fn().mockResolvedValue(saved()),
      findUniqueOrThrow: jest.fn().mockResolvedValue(saved()),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(4),
      update: jest.fn().mockResolvedValue(saved()),
      create: jest.fn().mockResolvedValue(saved()),
      delete: jest.fn(),
    },
    mealPlanCompletion: { upsert: jest.fn(), deleteMany: jest.fn() },
    diningInvite: { count: jest.fn().mockResolvedValue(0) },
    studentVerification: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn() },
  };
  prisma.$transaction.mockImplementation(async (operation) =>
    operation(prisma),
  );
  return { prisma, service: new MealPlansService(prisma as never) };
}

describe('meal plan calendar contract', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-09T04:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it('filters overlapping ranges and bounds pagination before querying', async () => {
    const { prisma, service } = fixture();
    await service.getMealPlans('owner', {
      startDate: '2026-10-02',
      endDate: '2026-10-02',
      page: 2,
      pageSize: 2,
    });
    expect(prisma.mealPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'owner',
          endDate: { gte: new Date('2026-10-02T00:00:00+08:00') },
          startDate: { lte: new Date('2026-10-02T23:59:59.999+08:00') },
        },
        skip: 2,
        take: 2,
      }),
    );
    for (const query of [{ page: '0' }, { pageSize: '101' }, { page: '1.5' }]) {
      expect(
        (await validate(plainToInstance(MealPlanQueryDto, query))).length,
      ).toBeGreaterThan(0);
    }
  });

  it.each([{ startDate: '2026-10-04' }, { endDate: '2026-09-30' }])(
    'validates a partial date patch against the stored other endpoint',
    async (patch) => {
      const { prisma, service } = fixture();
      await expect(service.updateMealPlan('p', 'owner', patch)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.mealPlan.update).not.toHaveBeenCalled();
    },
  );

  it('keeps private creation available and refuses student-only publishing', async () => {
    const { prisma, service } = fixture();
    const body = {
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      mealTime: 'lunch',
      dishes: [],
    } as never;
    await service.createMealPlan('owner', body);
    expect(prisma.mealPlan.create.mock.calls[0][0].data.isPublic).toBe(false);
    expect(prisma.studentVerification.findUnique).not.toHaveBeenCalled();
    await expect(
      service.updateMealPlan('p', 'owner', { isPublic: true }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('upserts one occurrence, never the whole date range, and allows idempotent removal', async () => {
    const { prisma, service } = fixture();
    await service.completeDate('p', 'owner', '2026-10-02', true);
    expect(prisma.mealPlanCompletion.upsert).toHaveBeenCalledWith({
      where: {
        mealPlanId_date: { mealPlanId: 'p', date: new Date('2026-10-02') },
      },
      create: { mealPlanId: 'p', date: new Date('2026-10-02') },
      update: {},
    });
    await service.completeDate('p', 'owner', '2026-10-02', false);
    expect(prisma.mealPlanCompletion.deleteMany).toHaveBeenCalledWith({
      where: { mealPlanId: 'p', date: new Date('2026-10-02') },
    });
    await expect(
      service.completeDate('p', 'owner', '2026-10-04', true),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.completeDate('p', 'owner', '2099-10-01', true),
    ).rejects.toThrow('尚未到该日期');
  });

  it('requires cancelling an active invitation before changing its schedule or deleting the plan', async () => {
    const { prisma, service } = fixture();
    prisma.diningInvite.count.mockResolvedValue(1);
    await expect(
      service.updateMealPlan('p', 'owner', { endDate: '2026-10-04' }),
    ).rejects.toThrow(ConflictException);
    await expect(service.deleteMealPlan('p', 'owner')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.mealPlan.delete).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { status: 'VERIFIED', expiresAt: null },
    { status: 'VERIFIED', expiresAt: new Date(0) },
    { status: 'PENDING', expiresAt: new Date('2099-01-01') },
  ])(
    'hides public plans without a currently verified owner',
    async (verification) => {
      const { prisma, service } = fixture();
      prisma.user.findUnique.mockResolvedValue({
        settings: { showMealPlans: true },
        studentVerification: verification,
      });
      expect((await service.getPublicMealPlans('owner')).data.items).toEqual(
        [],
      );
      expect(prisma.mealPlan.findMany).not.toHaveBeenCalled();
    },
  );

  it('requires both privacy gates and returns only a dedicated safe projection', async () => {
    const { prisma, service } = fixture();
    const owner = {
      settings: { showMealPlans: false },
      studentVerification: {
        status: 'VERIFIED',
        expiresAt: new Date('2099-01-01'),
      },
    };
    prisma.user.findUnique.mockResolvedValue(owner);
    expect((await service.getPublicMealPlans('owner')).data.items).toEqual([]);
    owner.settings.showMealPlans = true;
    prisma.mealPlan.findMany.mockResolvedValue([saved()] as never);
    const response = await service.getPublicMealPlans('owner');
    expect(
      prisma.mealPlan.findMany.mock.calls[0][0].where.AND[0],
    ).toMatchObject({ userId: 'owner', isPublic: true });
    expect(response.data.items[0]).toEqual({
      id: 'p',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      mealTime: 'lunch',
      dishes: [],
    });
    expect(response.data.items[0]).not.toHaveProperty('userId');
    expect(response.data.items[0]).not.toHaveProperty('completedDates');
  });
});
