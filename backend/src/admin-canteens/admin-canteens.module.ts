import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminCanteensService } from './admin-canteens.service';
import { AdminCanteensController } from './admin-canteens.controller';
import { PrismaService } from '@/prisma.service';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminCanteensController],
  providers: [AdminCanteensService, PrismaService],
})
export class AdminCanteensModule {}
