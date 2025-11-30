import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminAdminsService } from './admin-admins.service';
import { AdminAdminsController } from './admin-admins.controller';
import { PrismaService } from '@/prisma.service';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminAdminsController],
  providers: [AdminAdminsService, PrismaService],
})
export class AdminAdminsModule {}
