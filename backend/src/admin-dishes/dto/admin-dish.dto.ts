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
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DishStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

export enum DishUploadStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum MealTime {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  NIGHTSNACK = 'nightsnack',
}

export class AdminDishDto {
  id: string;
  name: string;
  tags: string[];
  price: number;
  priceUnit: string | null;
  description: string | null;
  images: string[];
  parentDishId?: string;
  subDishId?: string[];

  // Ingredients & Taste
  ingredients: string[];
  allergens: string[];
  spicyLevel: number;
  sweetness: number;
  saltiness: number;
  oiliness: number;

  // Location
  canteenId: string;
  canteenName: string;
  floorId: string | null;
  floorLevel: string | null;
  floorName: string | null;
  windowId: string | null;
  windowNumber: string | null;
  windowName: string;

  // Availability
  availableMealTime: string[];
  availableDates: any;
  status: string;

  // Stats
  averageRating: number;
  reviewCount: number;

  createdAt: Date;
  updatedAt: Date;
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
  @IsString()
  windowId?: string;

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
  windowId?: string;

  @IsOptional()
  @IsString()
  windowName?: string;

  @IsOptional()
  @IsString()
  windowNumber?: string;

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
  windowId?: string;

  @IsOptional()
  @IsString()
  windowName?: string;

  @IsOptional()
  @IsString()
  windowNumber?: string;

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

export class AdminUpdateDishStatusDto {
  @IsNotEmpty()
  @IsEnum(DishStatus)
  status: DishStatus;
}
