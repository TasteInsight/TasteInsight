import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  ValidateNested,
  IsObject,
  IsInt,
  IsNumber,
  Min,
  Max,
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

// ==================== 查询请求 DTO ====================

/**
 * 获取相似菜品请求 DTO
 */
export class GetSimilarDishesDto {
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

/**
 * 获取个性化推荐菜品请求 DTO
 */
export class GetPersonalizedDishesDto {
  @IsOptional()
  @IsString()
  canteenId?: string;

  @IsOptional()
  @IsString()
  mealTime?: string;

  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

// ==================== 事件追踪 DTO ====================

/**
 * 基础事件追踪 DTO
 */
class BaseEventDto {
  @IsString()
  dishId: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsEnum(RecommendationScene)
  scene?: RecommendationScene;

  @IsOptional()
  @IsString()
  experimentId?: string;

  @IsOptional()
  @IsString()
  groupItemId?: string;
}

/**
 * 点击事件 DTO
 */
export class ClickEventDto extends BaseEventDto {}

/**
 * 收藏事件 DTO
 */
export class FavoriteEventDto extends BaseEventDto {}

/**
 * 评价事件 DTO
 */
export class ReviewEventDto extends BaseEventDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}

/**
 * 负反馈事件 DTO
 */
export class DislikeEventDto extends BaseEventDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
