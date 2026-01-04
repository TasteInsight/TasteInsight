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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminNewsService } from './admin-news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { CurrentAdmin } from '@/auth/decorators/current-admin.decorator';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { NewsListResponseDto, NewsResponseDto } from './dto/news-response.dto';
import { SuccessResponseDto } from '@/common/dto/response.dto';
import { AdminGetNewsDto } from './dto/news.dto';

@Controller('admin/news')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminNewsController {
  constructor(private readonly adminNewsService: AdminNewsService) {}

  @Get()
  @RequirePermissions('news:view')
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: AdminGetNewsDto,
    @CurrentAdmin() admin: AdminInfo,
  ): Promise<NewsListResponseDto> {
    return this.adminNewsService.findAll(query, admin);
  }

  @Post()
  @RequirePermissions('news:create')
  @HttpCode(HttpStatus.CREATED)
  async createNews(
    @Body() createNewsDto: CreateNewsDto,
    @CurrentAdmin() admin: AdminInfo,
  ): Promise<NewsResponseDto> {
    return this.adminNewsService.createNews(createNewsDto, admin);
  }

  @Put(':id')
  @RequirePermissions('news:edit')
  @HttpCode(HttpStatus.OK)
  async updateNews(
    @Param('id') id: string,
    @Body() updateNewsDto: UpdateNewsDto,
    @CurrentAdmin() admin: AdminInfo,
  ): Promise<NewsResponseDto> {
    return this.adminNewsService.updateNews(id, updateNewsDto, admin);
  }

  @Post(':id/publish')
  @RequirePermissions('news:publish')
  @HttpCode(HttpStatus.OK)
  async publishNews(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminInfo,
  ): Promise<SuccessResponseDto> {
    return this.adminNewsService.publishNews(id, admin);
  }

  @Post(':id/revoke')
  @RequirePermissions('news:revoke')
  @HttpCode(HttpStatus.OK)
  async revokeNews(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminInfo,
  ): Promise<SuccessResponseDto> {
    return this.adminNewsService.revokeNews(id, admin);
  }

  @Delete(':id')
  @RequirePermissions('news:delete')
  @HttpCode(HttpStatus.OK)
  async deleteNews(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminInfo,
  ): Promise<SuccessResponseDto> {
    return this.adminNewsService.deleteNews(id, admin);
  }
}
