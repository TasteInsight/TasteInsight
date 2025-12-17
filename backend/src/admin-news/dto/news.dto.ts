import {
  IsOptional,
  IsNumber,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminGetNewsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'published'], { message: '状态必须是 draft 或 published' })
  status?: string;

  @IsOptional()
  @IsString()
  canteenName?: string;
}

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
