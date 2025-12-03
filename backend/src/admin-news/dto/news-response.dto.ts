import { PaginationMeta, BaseResponseDto } from '@/common/dto/response.dto';

export class NewsDto {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  canteenId: string | null;
  canteenName: string | null;
  publishedAt: Date | null;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class NewsResponseDto extends BaseResponseDto<NewsDto> {}

export class NewsListResponseDto extends BaseResponseDto<{
  items: NewsDto[];
  meta: PaginationMeta;
}> {}
