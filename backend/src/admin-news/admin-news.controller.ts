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
  Request,
} from '@nestjs/common';
import { AdminNewsService } from './admin-news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RequirePermissions } from '@/auth/decorators/permissions.decorator';
import { NewsListResponseDto, NewsResponseDto } from './dto/news-response.dto';
import { SuccessResponseDto } from '@/common/dto/response.dto';

@Controller('admin/news')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminNewsController {
  constructor(private readonly adminNewsService: AdminNewsService) {}

  @Get()
  @RequirePermissions('news:view')
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('status') status?: string,
    @Query('canteenName') canteenName?: string,
  ): Promise<NewsListResponseDto> {
    return this.adminNewsService.findAll(
      Number(page),
      Number(pageSize),
      status,
      canteenName,
    );
  }

  @Post()
  @RequirePermissions('news:create')
  @HttpCode(HttpStatus.CREATED)
  async createNews(
    @Body() createNewsDto: CreateNewsDto,
    @Request() req: any,
  ): Promise<NewsResponseDto> {
    return this.adminNewsService.createNews(createNewsDto, req.admin.id);
  }

  @Put(':id')
  @RequirePermissions('news:edit')
  @HttpCode(HttpStatus.OK)
  async updateNews(
    @Param('id') id: string,
    @Body() updateNewsDto: UpdateNewsDto,
  ): Promise<NewsResponseDto> {
    return this.adminNewsService.updateNews(id, updateNewsDto);
  }

  @Post(':id/publish')
  @RequirePermissions('news:publish')
  @HttpCode(HttpStatus.OK)
  async publishNews(@Param('id') id: string): Promise<SuccessResponseDto> {
    return this.adminNewsService.publishNews(id);
  }

  @Post(':id/revoke')
  @RequirePermissions('news:revoke')
  @HttpCode(HttpStatus.OK)
  async revokeNews(@Param('id') id: string): Promise<SuccessResponseDto> {
    return this.adminNewsService.revokeNews(id);
  }

  @Delete(':id')
  @RequirePermissions('news:delete')
  @HttpCode(HttpStatus.OK)
  async deleteNews(@Param('id') id: string): Promise<SuccessResponseDto> {
    return this.adminNewsService.deleteNews(id);
  }
}
