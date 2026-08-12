import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import {
  CurrentAdmin,
  type AdminInfo,
} from '@/auth/decorators/current-admin.decorator';
import { AdminLogsService } from './admin-logs.service';
import { AdminLogQueryDto } from './dto/admin-log-query.dto';

@Controller('admin/logs')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminLogsController {
  constructor(private readonly adminLogsService: AdminLogsService) {}

  @Get()
  @RequirePermissions('admin:view')
  @HttpCode(HttpStatus.OK)
  findAll(@Query() query: AdminLogQueryDto, @CurrentAdmin() admin: AdminInfo) {
    return this.adminLogsService.findAll(query, admin);
  }
}
