import { randomUUID } from 'node:crypto';
import { AuditInTransaction } from '@/admin-logs/admin-audit';
import {
  Controller,
  Request,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { PrismaService } from '@/prisma.service';
import { RecommendationScene } from '@/recommendation/constants/recommendation.constants';
import { RecommendationCatalogService } from './catalog.service';
import { RecommendationFilterDto } from '@/recommendation/dto/recommendation-request.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Controller('admin/recommendation')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class RecommendationPlatformController {
  constructor(
    private readonly catalog: RecommendationCatalogService,
    private readonly recommendation: RecommendationService,
    private readonly prisma: PrismaService,
  ) {}
  private result(data: unknown) {
    return { code: 200, message: 'success', data };
  }
  @Get('catalog')
  @RequirePermissions('experiment:view')
  async list() {
    return this.result(await this.catalog.catalog());
  }
  @Post('models')
  @HttpCode(200)
  @RequirePermissions('experiment:create')
  async createModel(@Body() body: any) {
    return this.result(await this.catalog.createModel(body));
  }
  @Post('models/:id/verify')
  @HttpCode(200)
  @RequirePermissions('experiment:edit')
  async updateModelVerification(@Param('id') id: string) {
    return this.result(await this.catalog.verifyModel(id));
  }
  @Post('indexes')
  @HttpCode(200)
  @RequirePermissions('experiment:create')
  async createIndex(@Body() body: any) {
    return this.result(await this.catalog.createIndex(body));
  }
  @Post('indexes/:id/build')
  @HttpCode(200)
  @RequirePermissions('experiment:edit')
  async updateIndexBuild(@Param('id') id: string) {
    return this.result(await this.catalog.rebuildIndex(id));
  }
  @Post('indexes/:id/retire')
  @HttpCode(200)
  @RequirePermissions('experiment:edit')
  async updateIndexRetirement(@Param('id') id: string) {
    return this.result(await this.catalog.retireIndex(id));
  }
  @Post('strategies')
  @HttpCode(200)
  @RequirePermissions('experiment:create')
  async createStrategy(@Body() body: any) {
    return this.result(await this.catalog.createStrategy(body));
  }
  @Put('strategies/:id')
  @RequirePermissions('experiment:edit')
  async editStrategy(@Param('id') id: string, @Body() body: any) {
    return this.result(await this.catalog.updateStrategy(id, body));
  }
  @Post('strategies/:id/publish')
  @HttpCode(200)
  @RequirePermissions('experiment:edit')
  async publish(@Param('id') id: string) {
    return this.result(await this.catalog.publishStrategy(id));
  }
  @Post('strategies/:id/retire')
  @HttpCode(200)
  @RequirePermissions('experiment:edit')
  async updateStrategyRetirement(@Param('id') id: string) {
    return this.result(await this.catalog.retireStrategy(id));
  }
  @Put('defaults/:scene')
  @AuditInTransaction('recommendation:default')
  @RequirePermissions('experiment:edit')
  async setDefault(
    @Param('scene') scene: string,
    @Body() body: any,
    @Request() req,
  ) {
    if (!body || Object.keys(body).some((k) => k !== 'strategyRevisionId'))
      throw new BadRequestException('默认策略参数无效');
    return this.result(
      await this.catalog.setDefault(
        scene,
        body.strategyRevisionId,
        req.admin.id,
      ),
    );
  }
  @Post('preview')
  @HttpCode(200)
  @RequirePermissions('experiment:view')
  async preview(@Body() body: any) {
    if (
      !body ||
      typeof body.userId !== 'string' ||
      typeof body.strategyRevisionId !== 'string' ||
      Object.keys(body).some(
        (k) =>
          !['userId', 'strategyRevisionId', 'filter', 'pageSize'].includes(k),
      )
    )
      throw new BadRequestException('预览参数无效');
    const size = body.pageSize ?? 10;
    if (
      !Number.isInteger(size) ||
      size < 1 ||
      size > 100 ||
      !(await this.prisma.user.findUnique({
        where: { id: body.userId },
        select: { id: true },
      }))
    )
      throw new BadRequestException('预览用户或数量无效');
    const strategy = await this.prisma.recommendationStrategy.findUnique({
      where: { id: body.strategyRevisionId },
    });
    if (!strategy) throw new BadRequestException('策略不存在');
    const filter = plainToInstance(RecommendationFilterDto, body.filter ?? {});
    if (
      await validate(filter, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).then((e) => e.length)
    )
      throw new BadRequestException('预览筛选参数无效');
    const result = await this.recommendation.getRecommendations(
      body.userId,
      {
        scene: strategy.scene as RecommendationScene,
        filter,
        pagination: { page: 1, pageSize: size },
        includeScoreBreakdown: true,
      },
      { mode: 'preview', strategyRevisionId: strategy.id },
    );
    const dishes = await this.prisma.dish.findMany({
      where: { id: { in: result.data.items.map((item) => item.id) } },
      select: {
        id: true,
        name: true,
        canteenName: true,
        windowName: true,
        price: true,
        priceUnit: true,
      },
    });
    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    return {
      ...result,
      data: {
        ...result.data,
        items: result.data.items.map((item) => ({
          ...item,
          dish: dishesById.get(item.id),
        })),
      },
    };
  }

  @Post('shadow')
  @HttpCode(200)
  @RequirePermissions('experiment:view')
  async shadow(@Body() body: any) {
    if (
      !body ||
      Object.keys(body).some(
        (k) =>
          !['userIds', 'strategyRevisionIds', 'filter', 'pageSize'].includes(k),
      ) ||
      !Array.isArray(body.userIds) ||
      body.userIds.length < 1 ||
      body.userIds.length > 20 ||
      body.userIds.some((id) => typeof id !== 'string' || !id) ||
      !Array.isArray(body.strategyRevisionIds) ||
      body.strategyRevisionIds.length < 2 ||
      body.strategyRevisionIds.length > 5 ||
      body.strategyRevisionIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(body.userIds).size !== body.userIds.length ||
      new Set(body.strategyRevisionIds).size !== body.strategyRevisionIds.length
    )
      throw new BadRequestException(
        '影子比较需要 1–20 位用户和 2–5 个不同策略',
      );
    const pageSize = body.pageSize ?? 10;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw new BadRequestException('预览数量范围为 1 到 100');
    const strategies = await this.prisma.recommendationStrategy.findMany({
      where: {
        id: { in: body.strategyRevisionIds },
        status: { in: ['draft', 'published'] },
      },
    });
    if (
      strategies.length !== body.strategyRevisionIds.length ||
      new Set(strategies.map((s) => s.scene)).size !== 1
    )
      throw new BadRequestException('请选择同场景有效策略');
    const filter = plainToInstance(RecommendationFilterDto, body.filter ?? {});
    if (
      await validate(filter, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).then((errors) => errors.length)
    )
      throw new BadRequestException('预览筛选无效');
    const runs: Record<string, unknown>[] = [];
    const started = Date.now();
    for (const userId of body.userIds as string[]) {
      if (Date.now() - started > 30000)
        throw new BadRequestException('比较超过时间预算，请缩小用户样本');
      if (
        !(await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        }))
      )
        throw new BadRequestException('预览用户不存在');
      const features =
        await this.recommendation.getUserFeaturesWithCache(userId);
      const queryId = randomUUID();
      const featureAsOf = new Date().toISOString();
      const compared = await Promise.all(
        strategies.map(async (strategy) => {
          const result = await this.recommendation.getRecommendations(
            userId,
            {
              scene: strategy.scene as RecommendationScene,
              filter,
              pagination: { page: 1, pageSize },
              includeScoreBreakdown: true,
            },
            {
              mode: 'preview',
              strategyRevisionId: strategy.id,
              userFeatures: features,
              captureTrace: true,
            },
          );
          return result.data.evaluationTrace!;
        }),
      );
      const predictedAt = new Date().toISOString();
      runs.push(
        ...compared.map((run) => ({
          ...run,
          queryId,
          featureAsOf,
          predictedAt,
        })),
      );
    }
    return this.result({ runs, comparedAt: new Date().toISOString() });
  }
}
