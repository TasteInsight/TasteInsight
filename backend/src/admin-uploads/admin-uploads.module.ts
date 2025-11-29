import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminUploadsController } from './admin-uploads.controller';
import { AdminUploadsService } from './admin-uploads.service';
import { PrismaService } from '@/prisma.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminUploadsController],
  providers: [AdminUploadsService, PrismaService, PermissionsGuard],
})
export class AdminUploadsModule {}
