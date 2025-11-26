import { Module } from '@nestjs/common';
import { CanteensController } from './canteens.controller';
import { CanteensService } from './canteens.service';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [CanteensController],
  providers: [CanteensService, PrismaService, JwtService],
})
export class CanteensModule {}
