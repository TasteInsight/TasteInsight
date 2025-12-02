import {
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  IsOptional,
  ArrayUnique,
} from 'class-validator';
import { MealTime } from '@/common/enums';

export class UpdateMealPlanDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(MealTime)
  mealTime?: MealTime;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  dishes?: string[];
}
