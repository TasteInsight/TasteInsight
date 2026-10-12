import {
  Controller,
  Get,
  Post,
  Patch,
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
  AdminGetUploadsDto,
  AdminRejectUploadDto,
  AdminApproveUploadDto,
  AdminEditUploadDto,
  AdminUploadRevisionDto,
} from './dto/admin-upload.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';

@Controller('admin/dishes/uploads')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminUploadsController {
  constructor(private readonly adminUploadsService: AdminUploadsService) {}

  @Get('')
  @RequirePermissions('upload:approve')
  @HttpCode(HttpStatus.OK)
  async getUploads(@Query() query: AdminGetUploadsDto, @Request() req) {
    return this.adminUploadsService.getUploads(query, req.admin);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUploadById(@Param('id') id: string, @Request() req) {
    return this.adminUploadsService.getUploadById(id, req.admin);
  }

  @Post(':id/approve')
  @RequirePermissions('upload:approve')
  @HttpCode(HttpStatus.OK)
  async approveUpload(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: AdminApproveUploadDto,
  ) {
    return this.adminUploadsService.approveUpload(id, req.admin, dto);
  }

  @Patch(':id')
  @RequirePermissions('upload:approve')
  async editUpload(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: AdminEditUploadDto,
  ) {
    return this.adminUploadsService.editUpload(id, dto, req.admin);
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
      rejectDto.revision,
    );
  }

  @Post(':id/revoke')
  @RequirePermissions('upload:approve')
  @HttpCode(HttpStatus.OK)
  async revokeUpload(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: AdminUploadRevisionDto,
  ) {
    return this.adminUploadsService.revokeUpload(id, req.admin, dto?.revision);
  }
}
