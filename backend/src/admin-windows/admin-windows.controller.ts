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
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminWindowsService } from './admin-windows.service';
import { CreateWindowDto } from './dto/create-window.dto';
import { UpdateWindowDto } from './dto/update-window.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';

@Controller('admin/windows')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminWindowsController {
  constructor(private readonly adminWindowsService: AdminWindowsService) {}

  @Get(':id')
  @RequirePermissions('canteen:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @Request() req) {
    return this.adminWindowsService.findOne(id, req.admin);
  }

  @Post()
  @RequirePermissions('canteen:create')
  @HttpCode(HttpStatus.OK)
  async create(@Body() createWindowDto: CreateWindowDto, @Request() req) {
    return this.adminWindowsService.create(createWindowDto, req.admin);
  }

  @Put(':id')
  @RequirePermissions('canteen:edit')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateWindowDto: UpdateWindowDto,
    @Request() req,
  ) {
    return this.adminWindowsService.update(id, updateWindowDto, req.admin);
  }

  @Delete(':id')
  @RequirePermissions('canteen:delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req) {
    return this.adminWindowsService.remove(id, req.admin);
  }
}
