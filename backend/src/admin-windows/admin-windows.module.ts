import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminWindowsService } from './admin-windows.service';
import { AdminWindowsController } from './admin-windows.controller';
import { PrismaService } from '@/prisma.service';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminWindowsController],
  providers: [AdminWindowsService, PrismaService],
})
export class AdminWindowsModule {}
