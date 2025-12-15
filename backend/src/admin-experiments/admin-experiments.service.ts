import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  CreateExperimentDto,
  UpdateExperimentDto,
} from './dto/create-experiment.dto';
import {
  ExperimentDto,
  ExperimentResponseDto,
  ExperimentListResponseDto,
  SuccessResponseDto,
} from './dto/experiment-response.dto';

/**
 * 管理员实验管理服务
 */
@Injectable()
export class AdminExperimentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取所有实验
   */
  async getAllExperiments(): Promise<ExperimentListResponseDto> {
    const experiments = await this.prisma.experiment.findMany({
      include: {
        groupItems: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      code: 200,
      message: 'success',
      data: {
        items: experiments.map((exp) => this.mapToExperimentDto(exp)),
        meta: {
          page: 1,
          pageSize: experiments.length,
          total: experiments.length,
          totalPages: 1,
        },
      },
    };
  }

  /**
   * 获取单个实验
   */
  async getExperiment(id: string): Promise<ExperimentResponseDto> {
    const experiment = await this.prisma.experiment.findUnique({
      where: { id },
      include: {
        groupItems: true,
      },
    });

    if (!experiment) {
      throw new NotFoundException('Experiment not found');
    }

    return {
      code: 200,
      message: 'success',
      data: this.mapToExperimentDto(experiment),
    };
  }

  /**
   * 创建实验
   */
  async createExperiment(
    data: CreateExperimentDto,
  ): Promise<SuccessResponseDto> {
    // 验证分组比例之和为 1
    const totalRatio = data.groups.reduce((sum, g) => sum + g.ratio, 0);
    if (Math.abs(totalRatio - 1) > 0.01) {
      throw new Error('Group ratios must sum to 1');
    }

    const experiment = await this.prisma.experiment.create({
      data: {
        name: data.name,
        description: data.description,
        trafficRatio: data.trafficRatio,
        startTime: data.startTime,
        endTime: data.endTime,
        status: 'draft',
        groupItems: {
          create: data.groups.map((g) => ({
            name: g.name,
            ratio: g.ratio,
            weights: g.weights as any,
            config: g.config as any,
          })),
        },
      },
    });

    return {
      code: 201,
      message: 'Experiment created successfully',
      data: experiment.id,
    };
  }

  /**
   * 更新实验
   */
  async updateExperiment(
    id: string,
    data: UpdateExperimentDto,
  ): Promise<SuccessResponseDto> {
    const experiment = await this.prisma.experiment.update({
      where: { id },
      data,
    });

    return {
      code: 200,
      message: 'Experiment updated successfully',
      data: experiment.id,
    };
  }

  /**
   * 删除实验
   */
  async deleteExperiment(id: string): Promise<SuccessResponseDto> {
    const experiment = await this.prisma.experiment.delete({
      where: { id },
    });

    return {
      code: 200,
      message: 'Experiment deleted successfully',
      data: experiment.id,
    };
  }

  /**
   * 启用实验
   */
  async enableExperiment(id: string): Promise<SuccessResponseDto> {
    const experiment = await this.prisma.experiment.update({
      where: { id },
      data: { status: 'running' },
    });

    return {
      code: 200,
      message: 'Experiment enabled successfully',
      data: experiment.id,
    };
  }

  /**
   * 禁用实验
   */
  async disableExperiment(id: string): Promise<SuccessResponseDto> {
    const experiment = await this.prisma.experiment.update({
      where: { id },
      data: { status: 'paused' },
    });

    return {
      code: 200,
      message: 'Experiment disabled successfully',
      data: experiment.id,
    };
  }

  /**
   * 完成实验
   */
  async completeExperiment(id: string): Promise<SuccessResponseDto> {
    const experiment = await this.prisma.experiment.update({
      where: { id },
      data: { status: 'completed' },
    });

    return {
      code: 200,
      message: 'Experiment completed successfully',
      data: experiment.id,
    };
  }

  private mapToExperimentDto(experiment: any): ExperimentDto {
    return {
      id: experiment.id,
      name: experiment.name,
      description: experiment.description || undefined,
      trafficRatio: experiment.trafficRatio,
      startTime: experiment.startTime,
      endTime: experiment.endTime || undefined,
      status: experiment.status,
      groups: experiment.groupItems.map((g) => ({
        id: g.id,
        name: g.name,
        ratio: g.ratio,
        weights: g.weights as Record<string, any> | undefined,
        config: g.config as Record<string, any> | undefined,
      })),
      createdAt: experiment.createdAt,
      updatedAt: experiment.updatedAt,
    };
  }
}
