import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AdminAdminsService } from './admin-admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { Request } from 'express';

interface AdminRequest extends Request {
  admin: {
    id: string;
    username: string;
    role: string;
    canteenId: string | null;
    permissions: string[];
  };
}

@Controller('admin/admins')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminAdminsController {
  constructor(private readonly adminAdminsService: AdminAdminsService) {}

  @Get()
  @RequirePermissions('admin:view')
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: AdminRequest,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.adminAdminsService.findAll(
      req.admin.id,
      req.admin.role,
      Number(page),
      Number(pageSize),
    );
  }

  @Post()
  @RequirePermissions('admin:create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: AdminRequest, @Body() createAdminDto: CreateAdminDto) {
    return this.adminAdminsService.create(req.admin.id, createAdminDto);
  }

  @Delete(':id')
  @RequirePermissions('admin:delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.adminAdminsService.remove(req.admin.id, req.admin.role, id);
  }

  @Put(':id/permissions')
  @RequirePermissions('admin:edit')
  @HttpCode(HttpStatus.OK)
  async updatePermissions(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() updatePermissionsDto: UpdatePermissionsDto,
  ) {
    return this.adminAdminsService.updatePermissions(
      req.admin.id,
      req.admin.role,
      id,
      updatePermissionsDto,
    );
  }
}
