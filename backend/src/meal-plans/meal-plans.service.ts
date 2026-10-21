import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import { isCurrentStudent } from '@/auth/student-status';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';
import { MealPlanQueryDto } from './dto/meal-plan-query.dto';
import {
  MealPlanListResponseDto,
  MealPlanResponseDto,
  SuccessResponseDto,
} from './dto/meal-plan-response.dto';
import { MealPlanDto } from './dto/meal-plan.dto';
import {
  campusDate,
  mealDate,
  storedMealDate,
  validateMealRange,
} from './meal-plan-date';

const planInclude = { dishes: true, completions: true } as const;
type SavedPlan = Prisma.MealPlanGetPayload<{ include: typeof planInclude }>;

@Injectable()
export class MealPlansService {
  constructor(private prisma: PrismaService) {}

  async assertStudent(
    tx: Pick<Prisma.TransactionClient, 'studentVerification'>,
    userId: string,
  ) {
    const verification = await tx.studentVerification.findUnique({
      where: { userId },
    });
    if (!isCurrentStudent(verification)) {
      throw new ForbiddenException('请先完成有效的学生认证');
    }
  }

  private queryWhere(query: MealPlanQueryDto): Prisma.MealPlanWhereInput {
    if (query.startDate && query.endDate)
      validateMealRange(query.startDate, query.endDate);
    return {
      ...(query.startDate
        ? {
            endDate: {
              gte: new Date(mealDate(query.startDate) + 'T00:00:00+08:00'),
            },
          }
        : {}),
      ...(query.endDate
        ? {
            startDate: {
              lte: new Date(mealDate(query.endDate) + 'T23:59:59.999+08:00'),
            },
          }
        : {}),
      ...(query.mealTime ? { mealTime: query.mealTime } : {}),
    };
  }

  async getMealPlans(
    userId: string,
    query: MealPlanQueryDto = {},
  ): Promise<MealPlanListResponseDto> {
    const where = { userId, ...this.queryWhere(query) };
    const paginated = query.page !== undefined || query.pageSize !== undefined;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const mealPlans = await this.prisma.mealPlan.findMany({
      where,
      include: planInclude,
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      ...(paginated ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    });
    const total = paginated ? await this.prisma.mealPlan.count({ where }) : 0;
    return {
      code: 200,
      message: '规划列表获取成功',
      data: {
        items: mealPlans.map((plan) => this.mapToMealPlanDto(plan)),
        ...(paginated
          ? {
              meta: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
              },
            }
          : {}),
      },
    };
  }

  async getPublicMealPlans(userId: string, query: MealPlanQueryDto = {}) {
    const where = this.queryWhere(query);
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        settings: { select: { showMealPlans: true } },
        studentVerification: { select: { status: true, expiresAt: true } },
      },
    });
    if (!owner) throw new NotFoundException('用户不存在');
    const verified = owner.studentVerification;
    if (!owner.settings?.showMealPlans || !isCurrentStudent(verified)) {
      return { code: 200, message: 'success', data: { items: [] } };
    }
    const plans = await this.prisma.mealPlan.findMany({
      where: {
        AND: [
          {
            userId,
            isPublic: true,
            endDate: { gte: new Date(campusDate() + 'T00:00:00+08:00') },
          },
          where,
        ],
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
      include: {
        dishes: {
          include: {
            dish: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true,
                priceUnit: true,
                status: true,
                calories: true,
                protein: true,
                carbohydrate: true,
                fat: true,

                canteenName: true,
                windowName: true,
              },
            },
          },
        },
      },
    });
    return {
      code: 200,
      message: 'success',
      data: {
        items: plans.map((plan) => ({
          id: plan.id,
          startDate: campusDate(plan.startDate),
          endDate: campusDate(plan.endDate),
          mealTime: plan.mealTime,
          dishes: plan.dishes.map(({ dish }) => dish),
        })),
      },
    };
  }

  async createMealPlan(
    userId: string,
    dto: CreateMealPlanDto,
  ): Promise<MealPlanResponseDto> {
    validateMealRange(dto.startDate, dto.endDate);
    const dishIds = [...new Set(dto.dishes)];
    let mealPlan: SavedPlan;
    try {
      mealPlan = await this.prisma.$transaction(async (tx) => {
        if (dto.isPublic) await this.assertStudent(tx, userId);
        return tx.mealPlan.create({
          data: {
            startDate: storedMealDate(dto.startDate),
            endDate: storedMealDate(dto.endDate),
            mealTime: dto.mealTime,
            isPublic: dto.isPublic ?? false,
            userId,
            dishes: {
              create: dishIds.map((dishId) => ({ dishId })),
            },
          },
          include: planInclude,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003' &&
        error.meta?.constraint === 'meal_plan_dishes_dishId_fkey'
      ) {
        throw new BadRequestException(
          '部分菜品已删除，请重新选择菜品后保存规划',
        );
      }
      throw error;
    }
    return {
      code: 201,
      message: '规划计划保存成功',
      data: this.mapToMealPlanDto(mealPlan),
    };
  }

  async lockOwnedPlan(
    tx: Prisma.TransactionClient,
    id: string,
    userId: string,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "meal_plans" WHERE "id" = ${id} FOR UPDATE`;
    const existing = await tx.mealPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('饮食计划不存在');
    if (existing.userId !== userId)
      throw new ForbiddenException('没有权限操作此饮食计划');
    return existing;
  }

  async updateMealPlan(
    id: string,
    userId: string,
    dto: UpdateMealPlanDto,
  ): Promise<MealPlanResponseDto> {
    const mealPlan = await this.prisma.$transaction(async (tx) => {
      const existing = await this.lockOwnedPlan(tx, id, userId);
      const startDate = dto.startDate
        ? mealDate(dto.startDate)
        : campusDate(existing.startDate);
      const endDate = dto.endDate
        ? mealDate(dto.endDate)
        : campusDate(existing.endDate);
      validateMealRange(startDate, endDate);
      if (dto.isPublic) await this.assertStudent(tx, userId);
      const scheduleChanged =
        startDate !== campusDate(existing.startDate) ||
        endDate !== campusDate(existing.endDate) ||
        (dto.mealTime !== undefined &&
          String(dto.mealTime) !== existing.mealTime);
      if (
        scheduleChanged &&
        (await tx.diningInvite.count({
          where: {
            mealPlanId: id,
            status: 'open',
            startsAt: { gt: new Date() },
          },
        }))
      ) {
        throw new ConflictException('请先取消约饭邀请，再修改规划日期或餐次');
      }
      if (scheduleChanged) {
        await tx.mealPlanCompletion.deleteMany({
          where: {
            mealPlanId: id,
            OR: [
              { date: { lt: storedMealDate(startDate) } },
              { date: { gt: storedMealDate(endDate) } },
            ],
          },
        });
      }
      return tx.mealPlan.update({
        where: { id },
        data: {
          ...(dto.startDate !== undefined
            ? { startDate: storedMealDate(startDate) }
            : {}),
          ...(dto.endDate !== undefined
            ? { endDate: storedMealDate(endDate) }
            : {}),
          ...(dto.mealTime !== undefined ? { mealTime: dto.mealTime } : {}),
          ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
          ...(dto.dishes !== undefined
            ? {
                dishes: {
                  deleteMany: {},
                  create: [...new Set(dto.dishes)].map((dishId) => ({
                    dishId,
                  })),
                },
              }
            : {}),
        },
        include: planInclude,
      });
    });
    return {
      code: 200,
      message: '规划计划更新成功',
      data: this.mapToMealPlanDto(mealPlan),
    };
  }

  async completeDate(
    id: string,
    userId: string,
    value: string,
    completed: boolean,
  ): Promise<MealPlanResponseDto> {
    const date = mealDate(value);
    if (completed && date > campusDate()) {
      throw new BadRequestException('尚未到该日期，不能标记已吃');
    }
    const plan = await this.prisma.$transaction(async (tx) => {
      const existing = await this.lockOwnedPlan(tx, id, userId);
      if (
        date < campusDate(existing.startDate) ||
        date > campusDate(existing.endDate)
      ) {
        throw new BadRequestException('完成日期必须在规划日期范围内');
      }
      if (completed) {
        if (
          await tx.diningInvite.count({
            where: {
              mealPlanId: id,
              date: storedMealDate(date),
              status: 'open',
              startsAt: { gt: new Date() },
            },
          })
        ) {
          throw new ConflictException('请先取消当天的约饭邀请，再标记已吃');
        }
        await tx.mealPlanCompletion.upsert({
          where: {
            mealPlanId_date: { mealPlanId: id, date: storedMealDate(date) },
          },
          create: { mealPlanId: id, date: storedMealDate(date) },
          update: {},
        });
      } else {
        await tx.mealPlanCompletion.deleteMany({
          where: { mealPlanId: id, date: storedMealDate(date) },
        });
      }
      return tx.mealPlan.findUniqueOrThrow({
        where: { id },
        include: planInclude,
      });
    });
    return {
      code: 200,
      message: completed ? '已标记吃过' : '已撤销标记',
      data: this.mapToMealPlanDto(plan),
    };
  }

  async deleteMealPlan(
    id: string,
    userId: string,
  ): Promise<SuccessResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOwnedPlan(tx, id, userId);
      if (
        await tx.diningInvite.count({
          where: {
            mealPlanId: id,
            status: 'open',
            startsAt: { gt: new Date() },
          },
        })
      ) {
        throw new ConflictException('请先取消约饭邀请，再删除规划');
      }
      await tx.mealPlan.delete({ where: { id } });
    });
    return { code: 200, message: '删除成功', data: null };
  }

  private mapToMealPlanDto(plan: SavedPlan): MealPlanDto {
    return {
      id: plan.id,
      userId: plan.userId,
      startDate: campusDate(plan.startDate),
      endDate: campusDate(plan.endDate),
      mealTime: plan.mealTime,
      dishes: plan.dishes.map((dish) => dish.dishId),
      isPublic: plan.isPublic ?? false,
      completedDates: (plan.completions ?? []).map((completion) =>
        completion.date.toISOString().slice(0, 10),
      ),
      createdAt: plan.createdAt.toISOString(),
    };
  }
}
