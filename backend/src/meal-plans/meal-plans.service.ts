import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';
import {
  MealPlanListResponseDto,
  MealPlanResponseDto,
  SuccessResponseDto,
} from './dto/meal-plan-response.dto';
import { MealPlanDto } from './dto/meal-plan.dto';

@Injectable()
export class MealPlansService {
  constructor(private prisma: PrismaService) {}

  async getMealPlans(userId: string): Promise<MealPlanListResponseDto> {
    const mealPlans = await this.prisma.mealPlan.findMany({
      where: { userId },
      include: {
        dishes: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return {
      code: 200,
      message: '规划列表获取成功',
      data: {
        items: mealPlans.map((mp) => this.mapToMealPlanDto(mp)),
      },
    };
  }

  async createMealPlan(
    userId: string,
    createMealPlanDto: CreateMealPlanDto,
  ): Promise<MealPlanResponseDto> {
    const { dishes, startDate, endDate, ...rest } = createMealPlanDto;

    const mealPlan = await this.prisma.mealPlan.create({
      data: {
        ...rest,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId,
        dishes: {
          create: [...new Set(dishes)].map((dishId) => ({ dishId })),
        },
      },
      include: {
        dishes: true,
      },
    });

    return {
      code: 201,
      message: '规划计划保存成功',
      data: this.mapToMealPlanDto(mealPlan),
    };
  }

  async updateMealPlan(
    id: string,
    userId: string,
    updateMealPlanDto: UpdateMealPlanDto,
  ): Promise<MealPlanResponseDto> {
    const existing = await this.prisma.mealPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('饮食计划不存在');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('没有权限修改此饮食计划');
    }

    const { dishes, startDate, endDate, ...rest } = updateMealPlanDto;

    const data: Prisma.MealPlanUpdateInput = { ...rest };
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);

    if (dishes) {
      data.dishes = {
        deleteMany: {},
        create: [...new Set(dishes)].map((dishId) => ({ dishId })),
      };
    }

    const mealPlan = await this.prisma.mealPlan.update({
      where: { id },
      data,
      include: {
        dishes: true,
      },
    });

    return {
      code: 200,
      message: '规划计划更新成功',
      data: this.mapToMealPlanDto(mealPlan),
    };
  }

  async deleteMealPlan(
    id: string,
    userId: string,
  ): Promise<SuccessResponseDto> {
    const existing = await this.prisma.mealPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('饮食计划不存在');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('没有权限删除此饮食计划');
    }

    await this.prisma.mealPlan.delete({
      where: { id },
    });

    return {
      code: 200,
      message: '删除成功',
      data: null,
    };
  }

  private mapToMealPlanDto(mealPlan: any): MealPlanDto {
    return {
      id: mealPlan.id,
      userId: mealPlan.userId,
      startDate: mealPlan.startDate.toISOString(),
      endDate: mealPlan.endDate.toISOString(),
      mealTime: mealPlan.mealTime,
      dishes: mealPlan.dishes.map((d: any) => d.dishId),
      createdAt: mealPlan.createdAt.toISOString(),
    };
  }
}
