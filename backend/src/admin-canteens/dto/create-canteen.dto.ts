import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MealTime, DayOfWeek } from '@/common/enums';

export class TimeSlot {
  @IsEnum(MealTime, {
    message: 'mealType must be one of: breakfast, lunch, dinner, nightsnack',
  })
  @IsNotEmpty()
  mealType: string;

  @IsString()
  @IsNotEmpty()
  openTime: string;

  @IsString()
  @IsNotEmpty()
  closeTime: string;
}

export class DailyOpeningHours {
  @IsEnum(DayOfWeek, {
    message:
      'dayOfWeek must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
  })
  @IsNotEmpty()
  dayOfWeek: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlot)
  slots: TimeSlot[];

  @IsBoolean()
  isClosed: boolean;
}

export class FloorOpeningHours {
  @IsString()
  @IsOptional()
  floorLevel?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyOpeningHours)
  schedule: DailyOpeningHours[];
}

export class FloorDto {
  @IsString()
  @IsNotEmpty()
  level: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class WindowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  floorId?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class CreateCanteenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  images: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorOpeningHours)
  openingHours: FloorOpeningHours[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorDto)
  floors: FloorDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WindowDto)
  windows: WindowDto[];
}
