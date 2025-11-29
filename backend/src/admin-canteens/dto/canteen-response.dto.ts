import { PaginationMeta } from '@/common/dto/response.dto';

export class CanteenDto {
  id: string;
  name: string;
  position: string | null;
  description: string | null;
  images: string[];
  openingHours: any; // Json
  averageRating: number;
  reviewCount: number;
  floors?: any[];
  windows?: any[];
  createdAt: Date;
  updatedAt: Date;
}

export class CanteenListResponseDto {
  code: number;
  message: string;
  data: {
    items: CanteenDto[];
    meta: PaginationMeta;
  };
}

export class CanteenResponseDto {
  code: number;
  message: string;
  data: CanteenDto;
}
