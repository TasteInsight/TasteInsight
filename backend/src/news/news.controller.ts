import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { NewsService } from './news.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { GetNewsDto } from './dto/get-news.dto';
import {
  NewsListResponseDto,
  NewsResponseDto,
} from '@/news/dto/news-response.dto';

@Controller('news')
@UseGuards(AuthGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  findAll(@Query() query: GetNewsDto): Promise<NewsListResponseDto> {
    return this.newsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<NewsResponseDto> {
    return this.newsService.findOne(id);
  }
}
