import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminReportsService } from './admin-reports.service';
import { HandleReportDto } from './dto/handle-report.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { CurrentAdmin } from '@/auth/decorators/current-admin.decorator';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';

@Controller('admin/reports')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get()
  @RequirePermissions('report:handle')
  @HttpCode(HttpStatus.OK)
  async getReports(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('status') status: 'pending' | 'approved' | 'rejected' | undefined,
    @Query('targetType') targetType: string | undefined,
    @CurrentAdmin() admin: AdminInfo,
  ) {
    return this.adminReportsService.getReports(
      Number(page),
      Number(pageSize),
      status,
      targetType,
      admin,
    );
  }

  @Post(':id/handle')
  @RequirePermissions('report:handle')
  @HttpCode(HttpStatus.OK)
  async handleReport(
    @Param('id') id: string,
    @Body() dto: HandleReportDto,
    @CurrentAdmin() admin: AdminInfo,
  ) {
    return this.adminReportsService.handleReport(id, dto, admin);
  }
}
