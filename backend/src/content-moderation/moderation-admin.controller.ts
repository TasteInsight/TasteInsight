import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { AdminCanteenScope } from '@/auth/admin-scope';
import { PrismaService } from '@/prisma.service';
import { ModerationSettingsService } from './moderation-settings.service';
import { ModerationAssetsService } from './moderation-assets.service';
import { ModerationPublicationService } from './moderation-publication.service';
import {
  ModerationDecisionDto,
  UpdateModerationSettingsDto,
} from './moderation.types';

const success = (data: unknown) => ({ code: 200, message: 'success', data });

@Controller('admin/content-moderation')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ModerationAdminController {
  constructor(
    private readonly settings: ModerationSettingsService,
    private readonly prisma: PrismaService,
    private readonly publication: ModerationPublicationService,
    private readonly assets: ModerationAssetsService,
  ) {}
  private scope(req: { admin: AdminCanteenScope }) {
    if (req.admin.scope !== 'GLOBAL')
      throw new ForbiddenException('内容安全管理需要全站权限');
  }
  @Get('policy')
  @RequirePermissions('config:view')
  async policy() {
    return success(await this.settings.policy());
  }
  @Get('settings')
  @RequirePermissions('config:view')
  async get(@Req() req: { admin: AdminCanteenScope }) {
    this.scope(req);
    return success(await this.settings.get());
  }
  @Put('settings')
  @RequirePermissions('config:edit')
  async update(
    @Req() req: { admin: AdminCanteenScope },
    @Body() dto: UpdateModerationSettingsDto,
  ) {
    this.scope(req);
    return success(await this.settings.update(dto));
  }
  @Get('tasks')
  @RequirePermissions('config:view')
  async tasks(
    @Req() req: { admin: AdminCanteenScope },
    @Query('status') status = 'manual',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    this.scope(req);
    const p = Number(page),
      size = Number(pageSize);
    if (
      !['manual', 'failed'].includes(status) ||
      !Number.isSafeInteger(p) ||
      p < 1 ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > 100
    )
      throw new BadRequestException('审核列表参数无效');
    const where = { status };
    const [items, total] = await Promise.all([
      this.prisma.contentModerationTask.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.contentModerationTask.count({ where }),
    ]);
    return success({
      items: items.map((task) => ({
        ...task,
        images: this.assets.previewImages(task.images),
      })),
      meta: {
        total,
        page: p,
        pageSize: size,
        totalPages: Math.ceil(total / size),
      },
    });
  }
  @Post('tasks/:id/decision')
  @HttpCode(200)
  @RequirePermissions('config:edit')
  async decide(
    @Req() req: { admin: AdminCanteenScope },
    @Param('id') id: string,
    @Body() dto: ModerationDecisionDto,
  ) {
    this.scope(req);
    if (!dto.approved && !dto.reason?.trim())
      throw new BadRequestException('请填写拒绝原因');
    const task = await this.prisma.contentModerationTask.findUnique({
      where: { id },
    });
    if (!task || !['manual', 'failed'].includes(task.status))
      throw new ConflictException('审核任务已处理或仍在检测中');
    await this.publication.apply(task, dto.approved, dto.reason?.trim());
    return success(null);
  }
}
