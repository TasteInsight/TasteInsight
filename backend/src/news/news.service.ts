import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { GetNewsDto } from './dto/get-news.dto';
import {
  NewsListResponseDto,
  NewsResponseDto,
} from '@/news/dto/news-response.dto';

@Injectable()
export class NewsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: GetNewsDto): Promise<NewsListResponseDto> {
    const { page = 1, pageSize = 20, canteenId } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (canteenId) {
      where.canteenId = canteenId;
    }

    const [items, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          publishedAt: 'desc',
        },
      }),
      this.prisma.news.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      code: 200,
      message: '获取新闻列表成功',
      data: {
        items: items.map((news) => this.mapToNewsDto(news)),
        meta: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    };
  }

  async findOne(id: string): Promise<NewsResponseDto> {
    const news = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!news) {
      throw new NotFoundException({
        code: 404,
        message: '资源不存在',
      });
    }

    return {
      code: 200,
      message: '获取新闻详情成功',
      data: this.mapToNewsDto(news),
    };
  }

  private mapToNewsDto(news: any) {
    return {
      id: news.id,
      title: news.title,
      content: news.content,
      summary: news.summary,
      canteenId: news.canteenId,
      canteenName: news.canteenName,
      publishedAt: news.publishedAt,
      createdBy: news.createdBy,
      createdAt: news.createdAt,
    };
  }
}
