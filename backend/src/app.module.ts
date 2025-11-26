// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { DishesModule } from './dishes/dishes.module';
import { AdminDishesModule } from './admin-dishes/admin-dishes.module';
import { AdminReviewsModule } from './admin-reviews/admin-reviews.module';
import { ConfigModule } from '@nestjs/config';
import { CanteensModule } from './canteens/canteens.module';

@Module({
  imports: [
    AuthModule,
    DishesModule,
    CanteensModule,
    AdminDishesModule,
    AdminReviewsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
