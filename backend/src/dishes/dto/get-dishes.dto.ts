import { IsOptional, IsObject, IsArray, IsInt, IsString, IsBoolean, Min, Max, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

// 供应时间枚举
export enum MealTime {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  NIGHTSNACK = 'nightsnack',
}

// 过滤条件
class FilterDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RatingRangeDto)
  rating?: RatingRangeDto;

  @IsOptional()
  @IsArray()
  @IsEnum(MealTime, { each: true })
  mealTime?: MealTime[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
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
  sweetness?: FlavorRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlavorRangeDto)
  saltiness?: FlavorRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlavorRangeDto)
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
  @IsString()
  field?: string;

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
