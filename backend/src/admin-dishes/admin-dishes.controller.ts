import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AdminDishesService } from './admin-dishes.service';
import {
  AdminGetDishesDto,
  AdminCreateDishDto,
  AdminUpdateDishDto,
  AdminUpdateDishStatusDto,
} from './dto/admin-dish.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { BatchConfirmRequestDto } from './dto/admin-dish-batch.dto';
import type { Express } from 'express';

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
    @Request() req,
  ) {
    return this.adminDishesService.updateAdminDish(id, updateDto, req.admin);
  }

  @Patch(':id/status')
  @RequirePermissions('dish:edit')
  @HttpCode(HttpStatus.OK)
  async updateDishStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: AdminUpdateDishStatusDto,
    @Request() req,
  ) {
    return this.adminDishesService.updateDishStatus(
      id,
      updateStatusDto.status,
      req.admin,
    );
  }

  @Get(':id/reviews')
  @RequirePermissions('dish:view')
  @HttpCode(HttpStatus.OK)
  async getDishReviews(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.adminDishesService.getDishReviews(
      id,
      Number(page),
      Number(pageSize),
    );
  }

  @Delete(':id')
  @RequirePermissions('dish:delete')
  @HttpCode(HttpStatus.OK)
  async deleteAdminDish(@Param('id') id: string, @Request() req) {
    return this.adminDishesService.deleteAdminDish(id, req.admin);
  }

  @Post('batch/parse')
  @RequirePermissions('dish:create')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async parseBatchExcel(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.adminDishesService.parseBatchExcel(file, req.admin);
  }

  @Post('batch/confirm')
  @RequirePermissions('dish:create')
  @HttpCode(HttpStatus.OK)
  async confirmBatchImport(
    @Body() body: BatchConfirmRequestDto,
    @Request() req,
  ) {
    return this.adminDishesService.confirmBatchImport(body, req.admin);
  }

  @Post(':id/embedding/refresh')
  @RequirePermissions('dish:edit')
  @HttpCode(HttpStatus.OK)
  async refreshDishEmbedding(@Param('id') id: string, @Request() req) {
    return this.adminDishesService.refreshDishEmbedding(id, req.admin);
  }

  @Post('embedding/refresh')
  @RequirePermissions('dish:edit')
  @HttpCode(HttpStatus.OK)
  async refreshDishesEmbeddingByCanteen(
    @Query('canteenId') canteenId: string,
    @Request() req,
  ) {
    return this.adminDishesService.refreshDishesEmbeddingsByCanteen(
      canteenId,
      req.admin,
    );
  }

  @Get('embedding/job/:jobId')
  @RequirePermissions('dish:view')
  @HttpCode(HttpStatus.OK)
  async getEmbeddingJobStatus(@Param('jobId') jobId: string) {
    return this.adminDishesService.getEmbeddingJobStatus(jobId);
  }
}
