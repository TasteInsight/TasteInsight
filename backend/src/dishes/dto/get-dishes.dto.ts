import {
  IsOptional,
  IsArray,
  IsInt,
  IsString,
  IsBoolean,
  Min,
  Max,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MealTime, DishSortField } from '@/common/enums';
import { IsValidRange } from '@/common/validators/range.validator';

// 评分范围
class RatingRangeDto {
  @IsInt()
  @Min(0)
  @Max(5)
  min: number;

  @IsInt()
  @Min(0)
  @Max(5)
  max: number;
}

// 价格范围
class PriceRangeDto {
  @IsInt()
  @Min(0)
  min: number;

  @IsInt()
  @Min(0)
  max: number;
}

// 口味范围（辣度、甜度、咸度、油度）
class FlavorRangeDto {
  @IsInt()
  @Min(0)
  @Max(5)
  min: number;

  @IsInt()
  @Min(0)
  @Max(5)
  max: number;
}

// 过滤条件
class FilterDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RatingRangeDto)
  @IsValidRange({ message: '评分范围无效：min 必须小于或等于 max' })
  rating?: RatingRangeDto;

  @IsOptional()
  @IsArray()
  @IsEnum(MealTime, { each: true })
  mealTime?: MealTime[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  @IsValidRange({ message: '价格范围无效：min 必须小于或等于 max' })
  price?: PriceRangeDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tag?: string[];

  @IsOptional()
  @IsBoolean()
  includeOffline?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  canteenId?: string[];

  // 口味相关筛选
  @IsOptional()
  @ValidateNested()
  @Type(() => FlavorRangeDto)
  @IsValidRange({ message: '辣度范围无效：min 必须小于或等于 max' })
  spicyLevel?: FlavorRangeDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  meatPreference?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avoidIngredients?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteIngredients?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FlavorRangeDto)
  @IsValidRange({ message: '甜度范围无效：min 必须小于或等于 max' })
  sweetness?: FlavorRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlavorRangeDto)
  @IsValidRange({ message: '咸度范围无效：min 必须小于或等于 max' })
  saltiness?: FlavorRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlavorRangeDto)
  @IsValidRange({ message: '油度范围无效：min 必须小于或等于 max' })
  oiliness?: FlavorRangeDto;
}

// 搜索条件
class SearchDto {
  @IsString()
  keyword: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];
}

// 排序方式
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

class SortDto {
  @IsOptional()
  @IsEnum(DishSortField, {
    message:
      '排序字段不合法，只允许: price, averageRating, reviewCount, createdAt, updatedAt',
  })
  field?: DishSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}

// 分页信息
class PaginationDto {
  @IsInt()
  @Min(1)
  page: number;

  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number;
}

// 主请求DTO
export class GetDishesDto {
  @ValidateNested()
  @Type(() => FilterDto)
  filter: FilterDto;

  @ValidateNested()
  @Type(() => SearchDto)
  search: SearchDto;

  @ValidateNested()
  @Type(() => SortDto)
  sort: SortDto;

  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}
