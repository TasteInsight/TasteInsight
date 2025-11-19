import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsArray, 
  IsEnum, 
  IsNotEmpty,
  Min,
  Max,
  ValidateNested,
  ArrayNotEmpty
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DishStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

export enum MealTime {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  NIGHTSNACK = 'nightsnack',
}

export class AvailableDateRange {
  @IsNotEmpty()
  startDate: string;

  @IsNotEmpty()
  endDate: string;
}

export class AdminGetDishesDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  canteenId?: string;

  @IsOptional()
  @IsEnum(DishStatus)
  status?: DishStatus;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class AdminCreateDishDto {
  @IsNotEmpty()
  @IsString()
  name: string;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  spicyLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  sweetness?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  saltiness?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  oiliness?: number;

  @IsOptional()
  @IsString()
  canteenId?: string;

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

  @IsOptional()
  @IsArray()
  @IsEnum(MealTime, { each: true })
  availableMealTime?: MealTime[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailableDateRange)
  availableDates?: AvailableDateRange[];

  @IsOptional()
  @IsEnum(DishStatus)
  status?: DishStatus;
}

export class AdminUpdateDishDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  spicyLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  sweetness?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  saltiness?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  oiliness?: number;

  @IsOptional()
  @IsString()
  canteenId?: string;

  @IsOptional()
  @IsString()
  canteenName?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  windowNumber?: string;

  @IsOptional()
  @IsString()
  windowName?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(MealTime, { each: true })
  availableMealTime?: MealTime[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailableDateRange)
  availableDates?: AvailableDateRange[];

  @IsOptional()
  @IsEnum(DishStatus)
  status?: DishStatus;
}
