import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import {
  NewsListResponseDto,
  NewsResponseDto,
  NewsDto,
} from './dto/news-response.dto';
import { SuccessResponseDto } from '@/common/dto/response.dto';

@Injectable()
export class AdminNewsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    status?: string,
    canteenName?: string,
  ): Promise<NewsListResponseDto> {
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
        orderBy: { publishedAt: 'desc' },
      }),
    ]);

    return {
      code: 200,
      message: 'success',
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
      if (canteen) {
        canteenName = canteen.name;
      }
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
      message: 'success',
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

    const news = await this.prisma.news.update({
      where: { id },
      data: updateNewsDto,
    });

    return {
      code: 200,
      message: 'success',
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
