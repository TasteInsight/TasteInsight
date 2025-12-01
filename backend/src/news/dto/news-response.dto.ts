import { PaginationMeta, BaseResponseDto } from '@/common/dto/response.dto';
import { NewsDto } from '@/news/dto/news.dto';

export class NewsResponseDto extends BaseResponseDto<NewsDto> {}

export class NewsListResponseDto extends BaseResponseDto<{
  items: NewsDto[];
  meta: PaginationMeta;
}> {}
