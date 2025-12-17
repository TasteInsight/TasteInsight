import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';
import { AuthGuard } from '@/auth/guards/auth.guard';
import {
  MealPlanListResponseDto,
  MealPlanResponseDto,
  SuccessResponseDto,
} from '@/meal-plans/dto/meal-plan-response.dto';

@Controller('meal-plans')
@UseGuards(AuthGuard)
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getMealPlans(@Request() req: any): Promise<MealPlanListResponseDto> {
    const userId = req.user.sub;
    return this.mealPlansService.getMealPlans(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createMealPlan(
    @Body() createMealPlanDto: CreateMealPlanDto,
    @Request() req: any,
  ): Promise<MealPlanResponseDto> {
    const userId = req.user.sub;
    return this.mealPlansService.createMealPlan(userId, createMealPlanDto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateMealPlan(
    @Param('id') id: string,
    @Body() updateMealPlanDto: UpdateMealPlanDto,
    @Request() req: any,
  ): Promise<MealPlanResponseDto> {
    const userId = req.user.sub;
    return this.mealPlansService.updateMealPlan(id, userId, updateMealPlanDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteMealPlan(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<SuccessResponseDto> {
    const userId = req.user.sub;
    return this.mealPlansService.deleteMealPlan(id, userId);
  }
}
