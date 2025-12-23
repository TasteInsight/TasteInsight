import { PaginationMeta } from '@/common/dto/response.dto';

export class AdminDto {
  id: string;
  username: string;
  role: string;
  canteenId: string | null;
  canteenName: string | null;
  createdBy: string | null;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class AdminListResponseDto {
  code: number;
  message: string;
  data: {
    items: AdminDto[];
    meta: PaginationMeta;
  };
}

export class AdminResponseDto {
  code: number;
  message: string;
  data: AdminDto;
}
