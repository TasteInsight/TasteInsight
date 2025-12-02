import { Module } from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { MealPlansController } from './meal-plans.controller';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [MealPlansController],
  providers: [MealPlansService, PrismaService, JwtService],
})
export class MealPlansModule {}
