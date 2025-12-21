import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ExperimentsService } from './services/experiments.service';
import { RecallQualityService } from './services/recall-quality.service';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from './dto/experiment/create-experiment.dto';
import { RecallQualityQueryDto } from './dto/recall-quality/recall-quality.dto';

/**
 * 管理员推荐系统管理控制器
 *
 * 负责：
 * - A/B 测试实验管理
 * - 召回质量评估
 */
@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminRecommendationController {
  constructor(
    private readonly experimentsService: ExperimentsService,
    private readonly recallQualityService: RecallQualityService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // 实验管理相关端点
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 获取所有实验
   */
  @Get('experiments')
  @RequirePermissions('experiment:view')
  async getAllExperiments() {
    return this.experimentsService.getAllExperiments();
  }

  /**
   * 获取单个实验
   */
  @Get('experiments/:id')
  @RequirePermissions('experiment:view')
  async getExperiment(@Param('id') id: string) {
    return this.experimentsService.getExperiment(id);
  }

  /**
   * 创建实验
   */
  @Post('experiments')
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
  @Put('experiments/:id')
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
  @Delete('experiments/:id')
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
  @Post('experiments/:id/enable')
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
  @Post('experiments/:id/disable')
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
  @Post('experiments/:id/complete')
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

  // ═══════════════════════════════════════════════════════════════════
  // 召回质量评估相关端点
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 评估召回质量
   *
   * 用于评估推荐系统的召回质量，包括：
   * - Recall@K: 召回率（前K个推荐中有多少是用户真正喜欢的）
   * - Coverage: 覆盖率（有多少菜品被推荐过）
   * - Diversity: 多样性（推荐结果的多样性）
   */
  @Get('recall-quality/evaluate')
  @RequirePermissions('experiment:view')
  async evaluateRecallQuality(@Query() query: RecallQualityQueryDto) {
    try {
      return await this.recallQualityService.evaluateRecallQuality(query);
    } catch (error) {
      return {
        code: 500,
        message: error.message,
        data: null,
      };
    }
  }
}
