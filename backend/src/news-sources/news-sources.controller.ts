import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { CurrentAdmin } from '@/auth/decorators/current-admin.decorator';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { NewsSourcesService } from './news-sources.service';
import { NewsSourcesQueue } from './news-sources.queue';
import { CreateNewsSourceDto, UpdateNewsSourceDto } from './news-sources.dto';
const response = (data: unknown) => ({ code: 200, message: '操作成功', data });
@Controller('admin/news-sources')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class NewsSourcesController {
  constructor(
    private readonly sources: NewsSourcesService,
    private readonly queue: NewsSourcesQueue,
  ) {}
  @Get() @RequirePermissions('news:view') async list(
    @CurrentAdmin() admin: AdminInfo,
  ) {
    return response(await this.sources.list(admin));
  }
  @Get('capabilities') @RequirePermissions('news:view') capabilities() {
    return response(this.sources.capabilities());
  }
  @Get('feeds') @RequirePermissions('news:create') async feeds() {
    return response(await this.sources.feeds());
  }
  @Post() @RequirePermissions('news:create') async create(
    @Body() dto: CreateNewsSourceDto,
    @CurrentAdmin() admin: AdminInfo,
  ) {
    return response(await this.sources.create(dto, admin));
  }
  @Put(':id') @RequirePermissions('news:create') async update(
    @Param('id') id: string,
    @Body() dto: UpdateNewsSourceDto,
    @CurrentAdmin() admin: AdminInfo,
  ) {
    return response(await this.sources.update(id, dto, admin));
  }
  @Post(':id/sync') @RequirePermissions('news:create') async sync(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminInfo,
  ) {
    const source = await this.sources.find(id, admin);
    if (!source.enabled) throw new BadRequestException('请先启用该来源');
    if (
      source.autoPublish &&
      admin.role !== 'superadmin' &&
      !admin.permissions.includes('news:publish')
    )
      throw new ForbiddenException('同步并自动发布需要新闻发布权限');
    await this.queue.enqueue(id);
    return response({ queued: true });
  }
}
