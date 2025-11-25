import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminCommentsService } from './admin-comments.service';
import { PrismaService } from '@/prisma.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminCommentsController],
  providers: [AdminCommentsService, PrismaService, PermissionsGuard],
})
export class AdminCommentsModule {}
