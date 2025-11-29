import { PaginationMeta } from '@/common/dto/response.dto';

export class FloorDto {
  id: string;
  level: string;
  name: string | null;
}

export class WindowDto {
  id: string;
  canteenId: string;
  floorId: string | null;
  name: string;
  number: string;
  position: string | null;
  description: string | null;
  tags: string[];
  floor: FloorDto | null;
  createdAt: Date;
  updatedAt: Date;
}

export class WindowListResponseDto {
  code: number;
  message: string;
  data: {
    items: WindowDto[];
    meta: PaginationMeta;
  };
}

export class WindowResponseDto {
  code: number;
  message: string;
  data: WindowDto;
}
