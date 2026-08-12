import { Module } from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { MealPlansController } from './meal-plans.controller';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [MealPlansController],
  providers: [MealPlansService, JwtService],
})
export class MealPlansModule {}
