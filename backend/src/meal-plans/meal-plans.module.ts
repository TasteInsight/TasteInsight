import { Module } from '@nestjs/common';
import { AllergensModule } from '@/allergens/allergens.module';
import { MealPlansService } from './meal-plans.service';
import { MealPlansController } from './meal-plans.controller';
import { JwtService } from '@nestjs/jwt';
import { NotificationsModule } from '@/notifications/notifications.module';
import { DiningInvitesController } from './dining-invites.controller';
import { DiningInvitesService } from './dining-invites.service';
import { PublicMealPlansController } from './public-meal-plans.controller';

@Module({
  imports: [NotificationsModule, AllergensModule],
  controllers: [
    MealPlansController,
    PublicMealPlansController,
    DiningInvitesController,
  ],
  providers: [MealPlansService, DiningInvitesService, JwtService],
  exports: [MealPlansService],
})
export class MealPlansModule {}
