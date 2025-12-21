import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseResponseDto } from '@/common/dto/response.dto';

/**
 * 召回质量评估请求 DTO
 */
export class RecallQualityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  k?: number = 50; // Recall@K 的 K 值

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 7; // 评估最近N天的数据

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(1000)
  sampleSize?: number = 100; // 采样用户数量
}

/**
 * 召回质量评估响应 DTO
 */
export interface RecallQualityData {
  timestamp: Date;
  recallAtK: {
    recallAtK: number;
    totalUsers: number;
    hitUsers: number;
  };
  coverage: {
    coverage: number;
    totalDishes: number;
    recalledDishes: number;
  };
  diversity: {
    diversity: number;
    dominantTags: Array<{ tag: string; count: number }>;
  };
  summary: string;
}

export class RecallQualityResponseDto extends BaseResponseDto<RecallQualityData> {}
