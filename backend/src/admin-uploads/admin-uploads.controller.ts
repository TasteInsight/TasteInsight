import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminUploadsService } from './admin-uploads.service';
import {
  AdminGetPendingUploadsDto,
  AdminRejectUploadDto,
} from './dto/admin-upload.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';

@Controller('admin/dishes/uploads')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminUploadsController {
  constructor(private readonly adminUploadsService: AdminUploadsService) {}

  @Get('pending')
  @RequirePermissions('upload:approve')
  @HttpCode(HttpStatus.OK)
  async getPendingUploads(
    @Query() query: AdminGetPendingUploadsDto,
    @Request() req,
  ) {
    return this.adminUploadsService.getPendingUploads(query, req.admin);
  }

  @Get('pending/:id')
  @RequirePermissions('upload:approve')
  @HttpCode(HttpStatus.OK)
  async getPendingUploadById(@Param('id') id: string, @Request() req) {
    return this.adminUploadsService.getPendingUploadById(id, req.admin);
  }

  @Post(':id/approve')
  @RequirePermissions('upload:approve')
  @HttpCode(HttpStatus.OK)
  async approveUpload(@Param('id') id: string, @Request() req) {
    return this.adminUploadsService.approveUpload(id, req.admin);
  }

  @Post(':id/reject')
  @RequirePermissions('upload:approve')
  @HttpCode(HttpStatus.OK)
  async rejectUpload(
    @Param('id') id: string,
    @Body() rejectDto: AdminRejectUploadDto,
    @Request() req,
  ) {
    return this.adminUploadsService.rejectUpload(
      id,
      rejectDto.reason,
      req.admin,
    );
  }

  @Post(':id/revoke')
  @RequirePermissions('upload:approve')
  @HttpCode(HttpStatus.OK)
  async revokeUpload(@Param('id') id: string, @Request() req) {
    return this.adminUploadsService.revokeUpload(id, req.admin);
  }
}
