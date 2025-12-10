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

export enum BatchDishStatus {
  VALID = 'valid',
  WARNING = 'warning',
  INVALID = 'invalid',
}

const splitToStringArray = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,，\/、;；\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'number') {
    return [String(value)];
  }

  return [];
};

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
