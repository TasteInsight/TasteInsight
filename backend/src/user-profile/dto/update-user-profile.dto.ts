import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// 基础 DTO（用于响应，字段必填）

export class PriceRangeDto {
  @IsNumber()
  @Min(0)
  min: number;

  @IsNumber()
  @Min(0)
  max: number;
}

export class TastePreferencesDto {
  @IsInt()
  @Min(0)
  @Max(5)
  spicyLevel: number;

  @IsInt()
  @Min(0)
  @Max(5)
  sweetness: number;

  @IsInt()
  @Min(0)
  @Max(5)
  saltiness: number;

  @IsInt()
  @Min(0)
  @Max(5)
  oiliness: number;
}

export class NotificationSettingsDto {
  @IsBoolean()
  newDishAlert: boolean;

  @IsBoolean()
  priceChangeAlert: boolean;

  @IsBoolean()
  reviewReplyAlert: boolean;

  @IsBoolean()
  weeklyRecommendation: boolean;
}

export class DisplaySettingsDto {
  @IsBoolean()
  showCalories: boolean;

  @IsBoolean()
  showNutrition: boolean;

  @IsString()
  @IsEnum(['rating', 'price_low', 'price_high', 'popularity', 'newest'])
  sortBy: string;
}

export class UserSettingsDto {
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notificationSettings: NotificationSettingsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => DisplaySettingsDto)
  displaySettings: DisplaySettingsDto;
}

export class UserPreferencesDto {
  @IsArray()
  @IsString({ each: true })
  tagPreferences: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  priceRange: PriceRangeDto;

  @IsArray()
  @IsString({ each: true })
  meatPreference: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => TastePreferencesDto)
  tastePreferences: TastePreferencesDto;

  @IsArray()
  @IsString({ each: true })
  canteenPreferences: string[];

  @IsString()
  @IsEnum(['small', 'medium', 'large'])
  portionSize: string;

  @IsArray()
  @IsString({ each: true })
  avoidIngredients: string[];

  @IsArray()
  @IsString({ each: true })
  favoriteIngredients: string[];
}

// Update DTO（用于更新请求，字段可选）

export class UpdatePriceRangeDto extends PartialType(PriceRangeDto) {}

export class UpdateTastePreferencesDto extends PartialType(
  TastePreferencesDto,
) {}

export class UpdateNotificationSettingsDto extends PartialType(
  NotificationSettingsDto,
) {}

export class UpdateDisplaySettingsDto extends PartialType(DisplaySettingsDto) {}

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateNotificationSettingsDto)
  notificationSettings?: UpdateNotificationSettingsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateDisplaySettingsDto)
  displaySettings?: UpdateDisplaySettingsDto;
}

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagPreferences?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdatePriceRangeDto)
  priceRange?: UpdatePriceRangeDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  meatPreference?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateTastePreferencesDto)
  tastePreferences?: UpdateTastePreferencesDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  canteenPreferences?: string[];

  @IsOptional()
  @IsString()
  @IsEnum(['small', 'medium', 'large'])
  portionSize?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avoidIngredients?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteIngredients?: string[];
}

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateUserPreferencesDto)
  preferences?: UpdateUserPreferencesDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateUserSettingsDto)
  settings?: UpdateUserSettingsDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];
}
