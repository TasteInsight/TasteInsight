import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { ExperimentService } from '@/recommendation/services/experiment.service';
import {
  CreateExperimentDto,
  UpdateExperimentDto,
} from '../dto/experiment/create-experiment.dto';
import {
  ExperimentDto,
  ExperimentResponseDto,
  ExperimentListResponseDto,
  SuccessResponseDto,
} from '../dto/experiment/experiment-response.dto';

/**
 * 实验管理服务
 *
 * 负责 A/B 测试实验的 CRUD 操作
 */
@Injectable()
export class ExperimentsService {
  private readonly logger = new Logger(ExperimentsService.name);

  constructor(
    private prisma: PrismaService,
    private experimentService: ExperimentService, // 实验服务
  ) {}

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
      throw new Error('分组占比之和必须为 1');
    }

    // 验证分组名称不重复
    const groupNames = data.groups.map((g) => g.name);
    const duplicateNames = groupNames.filter(
      (name, index) => groupNames.indexOf(name) !== index,
    );
    if (duplicateNames.length > 0) {
      throw new Error(
        `分组名称重复: ${[...new Set(duplicateNames)].join(', ')}`,
      );
    }

    const experiment = await this.prisma.experiment.create({
      data: {
        name: data.name,
        description: data.description,
        trafficRatio: data.trafficRatio,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
        status: 'draft',
        groupItems: {
          create: data.groups.map((g) => ({
            name: g.name,
            ratio: g.ratio,
            config: g.config as any,
          })),
        },
      },
    });

    // 刷新活跃实验列表
    await this.experimentService.refreshActiveExperiments();
    this.logger.log(
      `Created experiment ${experiment.id}, refreshed active experiments`,
    );

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
    // 如果包含 groups，需要验证
    if (data.groups) {
      // 验证分组比例之和为 1
      const totalRatio = data.groups.reduce((sum, g) => sum + g.ratio, 0);
      if (Math.abs(totalRatio - 1) > 0.01) {
        throw new Error('分组占比之和必须为 1');
      }

      // 验证分组名称不重复
      const groupNames = data.groups.map((g) => g.name);
      const duplicateNames = groupNames.filter(
        (name, index) => groupNames.indexOf(name) !== index,
      );
      if (duplicateNames.length > 0) {
        throw new Error(
          `分组名称重复: ${[...new Set(duplicateNames)].join(', ')}`,
        );
      }
    }

    // 提取 groups 字段
    const { groups, ...experimentData } = data;

    // 转换日期字段
    const updateData: any = { ...experimentData };
    if (updateData.startTime) {
      updateData.startTime = new Date(updateData.startTime);
    }
    if (updateData.endTime !== undefined) {
      updateData.endTime = updateData.endTime
        ? new Date(updateData.endTime)
        : null;
    }

    // 使用事务更新实验和分组
    const experiment = await this.prisma.$transaction(async (tx) => {
      // 更新实验基本信息
      const updatedExp = await tx.experiment.update({
        where: { id },
        data: updateData,
      });

      // 如果提供了 groups，则增量更新分组
      if (groups && groups.length > 0) {
        // 获取现有分组ID列表
        const existingGroups = await tx.experimentGroupItem.findMany({
          where: { experimentId: id },
          select: { id: true },
        });
        const existingGroupIds = new Set(existingGroups.map((g) => g.id));

        // 分类处理：有id的更新，没id的新增
        const groupsToUpdate = groups.filter(
          (g) => g.id && existingGroupIds.has(g.id),
        );
        const groupsToCreate = groups.filter((g) => !g.id);

        // 计算需要删除的分组（现有的但不在新列表中的）
        const newGroupIds = new Set(
          groups.filter((g) => g.id).map((g) => g.id),
        );
        const groupIdsToDelete = [...existingGroupIds].filter(
          (id) => !newGroupIds.has(id),
        );

        // 1. 删除被移除的分组
        if (groupIdsToDelete.length > 0) {
          await tx.experimentGroupItem.deleteMany({
            where: { id: { in: groupIdsToDelete } },
          });
          this.logger.log(
            `Deleted ${groupIdsToDelete.length} groups from experiment ${id}`,
          );
        }

        // 2. 更新现有分组
        for (const g of groupsToUpdate) {
          await tx.experimentGroupItem.update({
            where: { id: g.id },
            data: {
              name: g.name,
              ratio: g.ratio,
              config: g.config as any,
            },
          });
        }
        if (groupsToUpdate.length > 0) {
          this.logger.log(
            `Updated ${groupsToUpdate.length} groups in experiment ${id}`,
          );
        }

        // 3. 创建新分组
        if (groupsToCreate.length > 0) {
          await tx.experimentGroupItem.createMany({
            data: groupsToCreate.map((g) => ({
              experimentId: id,
              name: g.name,
              ratio: g.ratio,
              config: g.config as any,
            })),
          });
          this.logger.log(
            `Created ${groupsToCreate.length} new groups in experiment ${id}`,
          );
        }
      }

      return updatedExp;
    });

    // 刷新活跃实验列表
    await this.experimentService.refreshActiveExperiments();
    this.logger.log(
      `Updated experiment ${experiment.id}, refreshed active experiments`,
    );

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

    // 刷新活跃实验列表
    await this.experimentService.refreshActiveExperiments();
    this.logger.log(
      `Deleted experiment ${experiment.id}, refreshed active experiments`,
    );

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

    // 刷新活跃实验列表
    await this.experimentService.refreshActiveExperiments();
    this.logger.log(
      `Enabled experiment ${experiment.id}, refreshed active experiments`,
    );

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

    // 刷新活跃实验列表
    await this.experimentService.refreshActiveExperiments();
    this.logger.log(
      `Disabled experiment ${experiment.id}, refreshed active experiments`,
    );

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

    // 刷新活跃实验列表
    await this.experimentService.refreshActiveExperiments();
    this.logger.log(
      `Completed experiment ${experiment.id}, refreshed active experiments`,
    );

    return {
      code: 200,
      message: 'Experiment completed successfully',
      data: experiment.id,
    };
  }

  /**
   * 获取实验分组的配置
   */
  async getGroupConfig(groupItemId: string) {
    const group = await this.prisma.experimentGroupItem.findUnique({
      where: { id: groupItemId },
      include: {
        experiment: true,
      },
    });

    if (!group) {
      throw new NotFoundException('Group item not found');
    }

    return {
      code: 200,
      message: 'success',
      data: {
        id: group.id,
        name: group.name,
        ratio: group.ratio,
        config: group.config,
        experiment: {
          id: group.experiment.id,
          name: group.experiment.name,
          status: group.experiment.status,
        },
      },
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
        config: g.config as Record<string, any> | undefined,
      })),
      createdAt: experiment.createdAt,
      updatedAt: experiment.updatedAt,
    };
  }
}
