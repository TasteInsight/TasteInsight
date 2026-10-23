import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { ExperimentService } from '@/recommendation/services/experiment.service';
import { parseRecommendationConfig } from '@/recommendation/config/recommendation-config';
import { RecommendationCatalogService } from '@/recommendation-platform/catalog.service';
import { controlTransaction } from '@/recommendation-platform/control-transaction';
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

@Injectable()
export class ExperimentsService {
  constructor(
    private prisma: PrismaService,
    private experimentService: ExperimentService,
    private catalog: RecommendationCatalogService,
  ) {}

  async getAllExperiments(): Promise<ExperimentListResponseDto> {
    const items = await this.prisma.experiment.findMany({
      include: { groupItems: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((e) => this.mapToExperimentDto(e)),
        meta: {
          page: 1,
          pageSize: items.length,
          total: items.length,
          totalPages: 1,
        },
      },
    };
  }
  async getExperiment(id: string): Promise<ExperimentResponseDto> {
    const item = await this.prisma.experiment.findUnique({
      where: { id },
      include: { groupItems: true },
    });
    if (!item) throw new NotFoundException('Experiment not found');
    return {
      code: 200,
      message: 'success',
      data: this.mapToExperimentDto(item),
    };
  }

  private validateFields(data: CreateExperimentDto | UpdateExperimentDto) {
    if (
      data.trafficRatio !== undefined &&
      (typeof data.trafficRatio !== 'number' ||
        !Number.isFinite(data.trafficRatio) ||
        data.trafficRatio < 0 ||
        data.trafficRatio > 1)
    )
      throw new BadRequestException('实验流量比例无效');
    if (
      data.priority !== undefined &&
      (!Number.isInteger(data.priority) ||
        data.priority < 0 ||
        data.priority > 1000)
    )
      throw new BadRequestException('实验优先级无效');
    if (
      data.scene !== undefined &&
      !['home', 'search', 'similar', 'guess_like', 'today'].includes(data.scene)
    )
      throw new BadRequestException('实验场景无效');
    if (
      data.name !== undefined &&
      (typeof data.name !== 'string' || !data.name.trim())
    )
      throw new BadRequestException('实验名称无效');
    if (data.groups !== undefined && !Array.isArray(data.groups))
      throw new BadRequestException('实验分组无效');
  }

  private validateGroups(
    groups: {
      name: string;
      ratio: number;
      config?: unknown;
      strategyRevisionId?: string | null;
    }[],
  ) {
    if (
      !groups.length ||
      Math.abs(groups.reduce((sum, g) => sum + g.ratio, 0) - 1) > 1e-6
    )
      throw new BadRequestException('分组占比之和必须为 1');
    if (new Set(groups.map((g) => g.name)).size !== groups.length)
      throw new BadRequestException('分组名称重复');
    for (const group of groups) {
      if (!Number.isFinite(group.ratio) || group.ratio < 0 || group.ratio > 1)
        throw new BadRequestException('分组占比无效');
      if (
        group.strategyRevisionId &&
        group.config &&
        Object.keys(group.config).length
      )
        throw new BadRequestException('每组只选择策略版本或直接配置中的一种');
      try {
        parseRecommendationConfig(group.config);
      } catch (e) {
        throw new BadRequestException(e.message);
      }
    }
  }
  private async validateStrategies(
    tx: Prisma.TransactionClient,
    scene: string,
    groups: { strategyRevisionId?: string | null }[],
  ) {
    for (const group of groups)
      if (group.strategyRevisionId) {
        const strategy = await tx.recommendationStrategy.findUnique({
          where: { id: group.strategyRevisionId },
        });
        if (
          !strategy ||
          strategy.status !== 'published' ||
          strategy.scene !== scene
        )
          throw new BadRequestException('实验组须选择同场景已发布策略');
        await this.catalog.validateReferences(tx, strategy);
      }
  }
  private validateTimes(start: Date, end: Date | null) {
    if (
      !Number.isFinite(start.getTime()) ||
      (end && (!Number.isFinite(end.getTime()) || end <= start))
    )
      throw new BadRequestException('结束时间须晚于开始时间');
  }

  async createExperiment(
    data: CreateExperimentDto,
  ): Promise<SuccessResponseDto> {
    this.validateFields(data);
    this.validateGroups(data.groups);
    const startTime = new Date(data.startTime),
      endTime = data.endTime ? new Date(data.endTime) : null;
    this.validateTimes(startTime, endTime);
    const experiment = await controlTransaction(this.prisma, async (tx) => {
      await this.validateStrategies(tx, data.scene ?? 'home', data.groups);
      return tx.experiment.create({
        data: {
          name: data.name,
          description: data.description,
          scene: data.scene,
          priority: data.priority,
          trafficRatio: data.trafficRatio,
          startTime,
          endTime,
          status: 'draft',
          groupItems: {
            create: data.groups.map((g) => ({
              name: g.name,
              ratio: g.ratio,
              strategyRevisionId: g.strategyRevisionId,
              config: g.config ?? {},
            })),
          },
        },
      });
    });
    return this.refreshed(
      experiment.id,
      201,
      'Experiment created successfully',
    );
  }

  async updateExperiment(
    id: string,
    data: UpdateExperimentDto,
  ): Promise<SuccessResponseDto> {
    this.validateFields(data);
    if (data.groups) this.validateGroups(data.groups);
    await controlTransaction(this.prisma, async (tx) => {
      const current = await tx.experiment.findUnique({
        where: { id },
        include: { groupItems: true },
      });
      if (!current) throw new NotFoundException('Experiment not found');
      if (current.status === 'completed')
        throw new ConflictException('已完成实验保持只读');
      if (
        current.status !== 'draft' &&
        Object.entries(data).some(
          ([key, value]) =>
            value !== undefined && !['trafficRatio', 'status'].includes(key),
        )
      )
        throw new ConflictException(
          '已启动实验只允许调整流量或状态；修改策略请创建新实验',
        );
      const startTime = data.startTime
        ? new Date(data.startTime)
        : current.startTime;
      const endTime =
        data.endTime === null
          ? null
          : data.endTime
            ? new Date(data.endTime)
            : current.endTime;
      this.validateTimes(startTime, endTime);
      const groups = data.groups ?? current.groupItems;
      const scene = data.scene ?? current.scene;
      if (
        current.status === 'draft' ||
        data.status === 'running' ||
        (data.trafficRatio !== undefined &&
          data.trafficRatio > current.trafficRatio)
      ) {
        await this.validateStrategies(tx, scene, groups);
      }
      if (data.status) this.validateTransition(current.status, data.status);
      if (data.status === 'running') this.validateGroups(groups);
      if (data.groups) {
        const ids = new Set(current.groupItems.map((g) => g.id));
        const incoming = data.groups.filter((g) => g.id).map((g) => g.id!);
        if (
          new Set(incoming).size !== incoming.length ||
          incoming.some((id) => !ids.has(id))
        )
          throw new BadRequestException('分组 ID 无效或重复');
        await tx.experimentGroupItem.deleteMany({
          where: { experimentId: id },
        });
        await tx.experimentGroupItem.createMany({
          data: data.groups.map((g) => ({
            id: g.id,
            experimentId: id,
            name: g.name,
            ratio: g.ratio,
            strategyRevisionId: g.strategyRevisionId ?? null,
            config: g.config ?? {},
          })),
        });
      }
      const { groups: _groups, ...rest } = data;
      await tx.experiment.update({
        where: { id },
        data: { ...rest, startTime, endTime },
      });
    });
    return this.refreshed(id, 200, 'Experiment updated successfully');
  }

  private validateTransition(from: string, to: string) {
    const transitions: Record<string, string[]> = {
      draft: ['running'],
      running: ['paused', 'completed'],
      paused: ['running', 'completed'],
      completed: [],
    };
    if (!transitions[from]?.includes(to))
      throw new ConflictException('实验状态转换无效');
  }
  private async transition(id: string, status: string) {
    await this.updateExperiment(id, { status });
    return { code: 200, message: `Experiment ${status}`, data: id };
  }
  enableExperiment(id: string) {
    return this.transition(id, 'running');
  }
  disableExperiment(id: string) {
    return this.transition(id, 'paused');
  }
  completeExperiment(id: string) {
    return this.transition(id, 'completed');
  }

  async deleteExperiment(id: string): Promise<SuccessResponseDto> {
    await controlTransaction(this.prisma, async (tx) => {
      const experiment = await tx.experiment.findUnique({ where: { id } });
      if (!experiment) throw new NotFoundException('Experiment not found');
      if (experiment.status !== 'draft')
        throw new ConflictException('已启动实验保留配置与统计，可完成后归档');
      await tx.experiment.delete({ where: { id } });
    });
    return this.refreshed(id, 200, 'Experiment deleted successfully');
  }
  async getGroupConfig(id: string) {
    const group = await this.prisma.experimentGroupItem.findUnique({
      where: { id },
      include: { experiment: true },
    });
    if (!group) throw new NotFoundException('Group item not found');
    return { code: 200, message: 'success', data: group };
  }
  private async refreshed(
    id: string,
    code: number,
    message: string,
  ): Promise<SuccessResponseDto> {
    await this.experimentService.refreshActiveExperiments();
    return { code, message, data: id };
  }
  private mapToExperimentDto(experiment: any): ExperimentDto {
    return {
      id: experiment.id,
      name: experiment.name,
      description: experiment.description ?? undefined,
      scene: experiment.scene,
      priority: experiment.priority,
      trafficRatio: experiment.trafficRatio,
      startTime: experiment.startTime,
      endTime: experiment.endTime ?? undefined,
      status: experiment.status,
      groups: experiment.groupItems.map((g) => ({
        id: g.id,
        name: g.name,
        ratio: g.ratio,
        strategyRevisionId: g.strategyRevisionId ?? undefined,
        config: g.config ?? {},
      })),
      createdAt: experiment.createdAt,
      updatedAt: experiment.updatedAt,
    };
  }
}
