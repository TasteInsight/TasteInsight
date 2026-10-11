import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from '@/auth/guards/optional-auth.guard';
import { MealPlansService } from './meal-plans.service';
import { MealPlanQueryDto } from './dto/meal-plan-query.dto';

@Controller('users')
@UseGuards(OptionalAuthGuard)
export class PublicMealPlansController {
  constructor(private readonly plans: MealPlansService) {}

  @Get(':userId/meal-plans')
  list(@Param('userId') userId: string, @Query() query: MealPlanQueryDto) {
    return this.plans.getPublicMealPlans(userId, query);
  }
}
