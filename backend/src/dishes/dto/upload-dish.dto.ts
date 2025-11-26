import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DishStatus, MealTime } from '@/common/enums';
import { AvailableDateRangeDto } from '@/dishes/dto/dish.dto';

export class UploadDishDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  parentDishId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subDishId?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ingredients?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];

  // 口味信息
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  spicyLevel?: number;

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
  @IsInt()
  @Min(0)
  @Max(5)
  sweetness?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  saltiness?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  oiliness?: number;

  @IsNotEmpty()
  @IsString()
  canteenName: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  windowNumber?: string;

  @IsNotEmpty()
  @IsString()
  windowName: string;

  @IsNotEmpty()
  @IsArray()
  @IsEnum(MealTime, { each: true })
  availableMealTime: MealTime[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailableDateRangeDto)
  availableDates?: AvailableDateRangeDto[];

  @IsOptional()
  @IsEnum(DishStatus)
  status?: DishStatus;
}
