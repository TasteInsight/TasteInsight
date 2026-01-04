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
  Request,
} from '@nestjs/common';
import { AdminReportsService } from './admin-reports.service';
import { HandleReportDto } from './dto/handle-report.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';

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
    @Request() req,
  ) {
    return this.adminReportsService.getReports(
      Number(page),
      Number(pageSize),
      status,
      targetType,
      req.admin,
    );
  }

  @Post(':id/handle')
  @RequirePermissions('report:handle')
  @HttpCode(HttpStatus.OK)
  async handleReport(
    @Param('id') id: string,
    @Body() dto: HandleReportDto,
    @Request() req,
  ) {
    return this.adminReportsService.handleReport(id, dto, req.admin);
  }
}
