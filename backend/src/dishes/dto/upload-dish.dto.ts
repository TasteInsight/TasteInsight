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
  ValidateIf,
  IsUUID,
  IsISO8601,
  ArrayUnique,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DishStatus, MealTime } from '@/common/enums';
import { AvailableDateRangeDto } from '@/dishes/dto/dish.dto';
import { CONTRIBUTION_FIELDS } from '../contribution-fields';

export class UploadDishDto {
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  calories?: number | null;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  protein?: number | null;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  carbohydrate?: number | null;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  fat?: number | null;

  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  targetDishId?: string;

  @IsOptional()
  @IsISO8601()
  targetDishUpdatedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CONTRIBUTION_FIELDS, { each: true })
  changedFields?: string[];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ValidateIf((value) => !value.targetDishId || value.price !== undefined)
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  priceUnit?: string;

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

  @IsOptional()
  @IsString()
  canteenId?: string;

  @ValidateIf((value) => !value.targetDishId || value.canteenName !== undefined)
  @IsNotEmpty()
  @IsString()
  canteenName?: string;

  @IsOptional()
  @IsString()
  windowId?: string;

  @IsOptional()
  @IsString()
  windowNumber?: string;

  @IsOptional()
  @IsString()
  windowName?: string;

  @ValidateIf(
    (value) => !value.targetDishId || value.availableMealTime !== undefined,
  )
  @IsNotEmpty()
  @IsArray()
  @IsEnum(MealTime, { each: true })
  availableMealTime?: MealTime[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailableDateRangeDto)
  availableDates?: AvailableDateRangeDto[];

  @IsOptional()
  @IsEnum(DishStatus)
  status?: DishStatus;
}
