import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { splitToStringArray } from '../utils/split-to-string-array.util';

export enum BatchDishStatus {
  VALID = 'valid',
  WARNING = 'warning',
  INVALID = 'invalid',
}

export class BatchParsedDishDto {
  @IsOptional()
  @IsString()
  tempId?: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  priceUnit?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => splitToStringArray(value))
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => splitToStringArray(value))
  ingredients?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => splitToStringArray(value))
  allergens?: string[];

  @IsNotEmpty()
  @IsString()
  canteenName!: string;

  @IsOptional()
  @IsString()
  floorName?: string;

  @IsNotEmpty()
  @IsString()
  windowName!: string;

  @IsOptional()
  @IsString()
  windowNumber?: string;

  @IsOptional()
  @IsString()
  supplyTime?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => splitToStringArray(value))
  supplyPeriod?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => splitToStringArray(value))
  subDishNames?: string[];

  @IsEnum(BatchDishStatus)
  status!: BatchDishStatus;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  rawData?: Record<string, any>;
}

export class BatchConfirmRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchParsedDishDto)
  @Transform(
    ({ value, obj }) => value ?? obj?.ParsedDishes ?? obj?.parsedDishes ?? [],
  )
  dishes!: BatchParsedDishDto[];
}
