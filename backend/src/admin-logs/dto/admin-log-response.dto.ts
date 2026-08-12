import { PaginationMeta } from '@/common/dto/response.dto';

export class AdminLogDto {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  details: unknown;
  result: string;
  createdAt: Date;
}

export class AdminLogListResponseDto {
  code: number;
  message: string;
  data: {
    items: AdminLogDto[];
    meta: PaginationMeta;
  };
}
