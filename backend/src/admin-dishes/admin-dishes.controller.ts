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
  HttpStatus
} from '@nestjs/common';
import { AdminDishesService } from './admin-dishes.service';
import { AdminGetDishesDto, AdminCreateDishDto, AdminUpdateDishDto } from './dto/admin-dish.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('admin/dishes')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminDishesController {
  constructor(private readonly adminDishesService: AdminDishesService) {}

  @Get()
  @RequirePermissions('dish:view')
  @HttpCode(HttpStatus.OK)
  async getAdminDishes(@Query() query: AdminGetDishesDto, @Request() req) {
    return this.adminDishesService.getAdminDishes(query, req.admin);
  }

  @Get(':id')
  @RequirePermissions('dish:view')
  @HttpCode(HttpStatus.OK)
  async getAdminDishById(@Param('id') id: string, @Request() req) {
    return this.adminDishesService.getAdminDishById(id, req.admin);
  }

  @Post()
  @RequirePermissions('dish:create')
  @HttpCode(HttpStatus.CREATED)
  async createAdminDish(@Body() createDto: AdminCreateDishDto, @Request() req) {
    return this.adminDishesService.createAdminDish(createDto, req.admin);
  }

  @Put(':id')
  @RequirePermissions('dish:edit')
  @HttpCode(HttpStatus.OK)
  async updateAdminDish(
    @Param('id') id: string, 
    @Body() updateDto: AdminUpdateDishDto, 
    @Request() req
  ) {
    return this.adminDishesService.updateAdminDish(id, updateDto, req.admin);
  }

  @Delete(':id')
  @RequirePermissions('dish:delete')
  @HttpCode(HttpStatus.OK)
  async deleteAdminDish(@Param('id') id: string, @Request() req) {
    return this.adminDishesService.deleteAdminDish(id, req.admin);
  }
}
