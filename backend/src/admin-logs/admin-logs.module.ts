import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { AdminLogsController } from './admin-logs.controller';
import { AdminLogsService } from './admin-logs.service';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminLogsController],
  providers: [AdminLogsService, PermissionsGuard],
})
export class AdminLogsModule {}
