import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsListResponseDto, NewsResponseDto } from './dto/news-response.dto';
import { SuccessResponseDto } from '@/common/dto/response.dto';
import { NewsDto, AdminGetNewsDto } from './dto/news.dto';

@Injectable()
export class AdminNewsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: AdminGetNewsDto): Promise<NewsListResponseDto> {
    const { page = 1, pageSize = 20, status, canteenName } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (canteenName) {
      where.canteenName = {
        contains: canteenName,
        mode: 'insensitive',
      };
    }

    const [total, newsList] = await Promise.all([
      this.prisma.news.count({ where }),
      this.prisma.news.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
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
    adminId: string,
  ): Promise<NewsResponseDto> {
    let canteenName: string | null = null;
    if (createNewsDto.canteenId) {
      const canteen = await this.prisma.canteen.findUnique({
        where: { id: createNewsDto.canteenId },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
      canteenName = canteen.name;
    }

    const news = await this.prisma.news.create({
      data: {
        ...createNewsDto,
        canteenName,
        createdBy: adminId,
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
  ): Promise<NewsResponseDto> {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      throw new NotFoundException('新闻不存在');
    }

    if (existingNews.status === 'published') {
      throw new BadRequestException('已发布的新闻无法编辑，请先撤回');
    }

    // 如果更新了 canteenId，需要同时更新 canteenName
    const updateData: any = { ...updateNewsDto };
    if (updateNewsDto.canteenId) {
      const canteen = await this.prisma.canteen.findUnique({
        where: { id: updateNewsDto.canteenId },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
      updateData.canteenName = canteen.name;
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

  async publishNews(id: string): Promise<SuccessResponseDto> {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      throw new NotFoundException('新闻不存在');
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

  async revokeNews(id: string): Promise<SuccessResponseDto> {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      throw new NotFoundException('新闻不存在');
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

  async deleteNews(id: string): Promise<SuccessResponseDto> {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      throw new NotFoundException('新闻不存在');
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
