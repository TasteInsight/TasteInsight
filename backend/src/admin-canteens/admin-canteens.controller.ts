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
import { AdminCanteensService } from './admin-canteens.service';
import { CreateCanteenDto } from './dto/create-canteen.dto';
import { UpdateCanteenDto } from './dto/update-canteen.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { AdminWindowsService } from '@/admin-windows/admin-windows.service';

@Controller('admin/canteens')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminCanteensController {
  constructor(
    private readonly adminCanteensService: AdminCanteensService,
    private readonly adminWindowsService: AdminWindowsService,
  ) {}

  @Get()
  @RequirePermissions('canteen:view')
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Request() req,
  ) {
    return this.adminCanteensService.findAll(
      Number(page),
      Number(pageSize),
      req.admin,
    );
  }

  @Get(':id')
  @RequirePermissions('canteen:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @Request() req) {
    return this.adminCanteensService.findOne(id, req.admin);
  }

  @Get(':canteenId/windows')
  @RequirePermissions('canteen:view')
  @HttpCode(HttpStatus.OK)
  async findWindows(
    @Param('canteenId') canteenId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Request() req,
  ) {
    return this.adminWindowsService.findAllByCanteen(
      canteenId,
      Number(page),
      Number(pageSize),
      req.admin,
    );
  }

  @Post()
  @RequirePermissions('canteen:create')
  @HttpCode(HttpStatus.OK)
  async create(@Body() createCanteenDto: CreateCanteenDto, @Request() req) {
    return this.adminCanteensService.create(createCanteenDto, req.admin);
  }

  @Put(':id')
  @RequirePermissions('canteen:edit')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateCanteenDto: UpdateCanteenDto,
    @Request() req,
  ) {
    return this.adminCanteensService.update(id, updateCanteenDto, req.admin);
  }

  @Delete(':id')
  @RequirePermissions('canteen:delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req) {
    return this.adminCanteensService.remove(id, req.admin);
  }
}
