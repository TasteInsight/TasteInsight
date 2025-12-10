import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminExperimentsService } from './admin-experiments.service';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from './dto/create-experiment.dto';

/**
 * 管理员实验管理控制器
 */
@Controller('admin/experiments')
@UseGuards(AdminAuthGuard, PermissionsGuard) // 需要管理员认证和权限
export class AdminExperimentsController {
  constructor(private readonly experimentsService: AdminExperimentsService) {}

  /**
   * 获取所有实验
   */
  @Get()
  @RequirePermissions('experiment:view')
  async getAllExperiments() {
    return this.experimentsService.getAllExperiments();
  }

  /**
   * 获取单个实验
   */
  @Get(':id')
  @RequirePermissions('experiment:view')
  async getExperiment(@Param('id') id: string) {
    return this.experimentsService.getExperiment(id);
  }

  /**
   * 创建实验
   */
  @Post()
  @RequirePermissions('experiment:create')
  @HttpCode(HttpStatus.CREATED)
  async createExperiment(@Body() data: CreateExperimentDto) {
    try {
      return await this.experimentsService.createExperiment(data);
    } catch (error) {
      return {
        code: 400,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 更新实验
   */
  @Put(':id')
  @RequirePermissions('experiment:edit')
  async updateExperiment(
    @Param('id') id: string,
    @Body() data: UpdateExperimentDto,
  ) {
    try {
      return await this.experimentsService.updateExperiment(id, data);
    } catch (error) {
      return {
        code: 400,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 删除实验
   */
  @Delete(':id')
  @RequirePermissions('experiment:delete')
  async deleteExperiment(@Param('id') id: string) {
    try {
      return await this.experimentsService.deleteExperiment(id);
    } catch (error) {
      return {
        code: 400,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 启用实验
   */
  @Post(':id/enable')
  @RequirePermissions('experiment:edit')
  async enableExperiment(@Param('id') id: string) {
    try {
      return await this.experimentsService.enableExperiment(id);
    } catch (error) {
      return {
        code: 400,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 禁用实验
   */
  @Post(':id/disable')
  @RequirePermissions('experiment:edit')
  async disableExperiment(@Param('id') id: string) {
    try {
      return await this.experimentsService.disableExperiment(id);
    } catch (error) {
      return {
        code: 400,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 完成实验
   */
  @Post(':id/complete')
  @RequirePermissions('experiment:edit')
  async completeExperiment(@Param('id') id: string) {
    try {
      return await this.experimentsService.completeExperiment(id);
    } catch (error) {
      return {
        code: 400,
        message: error.message,
        data: null,
      };
    }
  }
}
