import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecommendationScene } from '../constants/recommendation.constants';
import {
  FilterDto,
  SearchDto,
  PaginationDto,
} from '@/dishes/dto/get-dishes.dto';
import { PartialType } from '@nestjs/swagger';

/**
 * 推荐过滤条件
 */
export class RecommendationFilterDto extends FilterDto {}

/**
 * 推荐搜索条件
 */
export class RecommendationSearchDto extends PartialType(SearchDto) {}

/**
 * 推荐分页信息
 */
export class RecommendationPaginationDto extends PaginationDto {}

/**
 * 推荐请求 DTO
 */
export class RecommendationRequestDto {
  @IsOptional()
  @IsEnum(RecommendationScene)
  scene?: RecommendationScene = RecommendationScene.HOME;

  @IsOptional()
  @IsString()
  experimentId?: string; // A/B 测试实验 ID

  @IsOptional()
  @IsString()
  triggerDishId?: string; // 触发推荐的菜品 ID

  @ValidateNested()
  @Type(() => RecommendationFilterDto)
  filter: RecommendationFilterDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationSearchDto)
  search?: RecommendationSearchDto;

  @ValidateNested()
  @Type(() => RecommendationPaginationDto)
  pagination: RecommendationPaginationDto;

  @IsOptional()
  @IsBoolean()
  includeScoreBreakdown?: boolean; // 是否包含分数明细

  @IsOptional()
  @IsObject()
  userContext?: Record<string, any>; // 用户上下文信息
}
