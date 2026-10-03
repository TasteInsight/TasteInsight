import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsListResponseDto, NewsResponseDto } from './dto/news-response.dto';
import { SuccessResponseDto } from '@/common/dto/response.dto';
import { NewsDto, AdminGetNewsDto } from './dto/news.dto';
import { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminNewsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    query: AdminGetNewsDto,
    adminInfo?: AdminInfo,
  ): Promise<NewsListResponseDto> {
    const {
      page = 1,
      pageSize = 20,
      status,
      canteenName,
      canteenId,
      keyword,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.NewsWhereInput = {};
    if (status) {
      where.status = status;
    }

    if (adminInfo?.canteenId) {
      if (canteenId && canteenId !== adminInfo.canteenId) {
        throw new ForbiddenException('您只能查看所属食堂的新闻');
      }
      where.canteenId = adminInfo.canteenId;
    } else if (canteenId) {
      where.canteenId = canteenId === 'all' ? null : canteenId;
    }
    if (canteenName?.trim()) {
      where.canteenName = {
        contains: canteenName.trim(),
        mode: 'insensitive',
      };
    }
    if (keyword?.trim()) {
      where.title = { contains: keyword.trim(), mode: 'insensitive' };
    }

    const dateBoundary = (value: string, end: boolean): Date =>
      new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? `${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`
          : value,
      );
    const from = startDate ? dateBoundary(startDate, false) : undefined;
    const to = endDate ? dateBoundary(endDate, true) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException('结束时间不能早于开始时间');
    }
    if (from || to) {
      where[status === 'draft' ? 'createdAt' : 'publishedAt'] = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [total, newsList] = await Promise.all([
      this.prisma.news.count({ where }),
      this.prisma.news.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    ]);

    return {
      code: 200,
      message: '获取新闻列表成功',
      data: {
        items: newsList.map((news) => this.mapToNewsDto(news)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async createNews(
    createNewsDto: CreateNewsDto,
    adminInfo: AdminInfo,
  ): Promise<NewsResponseDto> {
    let canteenName: string | null = null;
    let canteenId = createNewsDto.canteenId;

    if (adminInfo.canteenId) {
      if (canteenId !== undefined && canteenId !== adminInfo.canteenId) {
        throw new ForbiddenException('您只能发布所属食堂的新闻');
      }
      canteenId = adminInfo.canteenId;
    }

    if (canteenId) {
      const canteen = await this.prisma.canteen.findUnique({
        where: { id: canteenId },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
      canteenName = canteen.name;
    }

    const news = await this.prisma.news.create({
      data: {
        ...createNewsDto,
        canteenId,
        canteenName,
        createdBy: adminInfo.id,
        status: 'draft',
        publishedAt: null,
      },
    });

    return {
      code: 200,
      message: '创建新闻成功',
      data: this.mapToNewsDto(news),
    };
  }

  async updateNews(
    id: string,
    updateNewsDto: UpdateNewsDto,
    adminInfo?: AdminInfo,
  ): Promise<NewsResponseDto> {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      throw new NotFoundException('新闻不存在');
    }

    if (
      adminInfo?.canteenId &&
      existingNews.canteenId !== adminInfo.canteenId
    ) {
      throw new ForbiddenException('权限不足');
    }

    if (existingNews.status === 'published') {
      throw new BadRequestException('已发布的新闻无法编辑，请先撤回');
    }

    // 如果更新了 canteenId，需要同时更新 canteenName
    const updateData: any = { ...updateNewsDto };

    if (updateNewsDto.canteenId !== undefined) {
      if (
        adminInfo?.canteenId &&
        updateNewsDto.canteenId !== adminInfo.canteenId
      ) {
        throw new ForbiddenException('您只能发布所属食堂的新闻');
      }
      if (updateNewsDto.canteenId === null) {
        updateData.canteenName = null;
      } else {
        const canteen = await this.prisma.canteen.findUnique({
          where: { id: updateNewsDto.canteenId },
        });
        if (!canteen) {
          throw new BadRequestException('指定的食堂不存在');
        }
        updateData.canteenName = canteen.name;
      }
    }

    const news = await this.prisma.news.update({
      where: { id },
      data: updateData,
    });

    return {
      code: 200,
      message: '更新新闻成功',
      data: this.mapToNewsDto(news),
    };
  }

  async publishNews(
    id: string,
    adminInfo?: AdminInfo,
  ): Promise<SuccessResponseDto> {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      throw new NotFoundException('新闻不存在');
    }

    if (
      adminInfo?.canteenId &&
      existingNews.canteenId !== adminInfo.canteenId
    ) {
      throw new ForbiddenException('权限不足');
    }

    await this.prisma.news.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  async revokeNews(
    id: string,
    adminInfo?: AdminInfo,
  ): Promise<SuccessResponseDto> {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      throw new NotFoundException('新闻不存在');
    }

    if (
      adminInfo?.canteenId &&
      existingNews.canteenId !== adminInfo.canteenId
    ) {
      throw new ForbiddenException('权限不足');
    }

    await this.prisma.news.update({
      where: { id },
      data: {
        status: 'draft',
        publishedAt: null,
      },
    });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  async deleteNews(
    id: string,
    adminInfo?: AdminInfo,
  ): Promise<SuccessResponseDto> {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      throw new NotFoundException('新闻不存在');
    }

    if (
      adminInfo?.canteenId &&
      existingNews.canteenId !== adminInfo.canteenId
    ) {
      throw new ForbiddenException('权限不足');
    }

    await this.prisma.news.delete({
      where: { id },
    });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  private mapToNewsDto(news: any): NewsDto {
    return {
      id: news.id,
      title: news.title,
      content: news.content,
      summary: news.summary,
      canteenId: news.canteenId,
      canteenName: news.canteenName,
      publishedAt: news.publishedAt,
      status: news.status,
      createdBy: news.createdBy,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
    };
  }
}
