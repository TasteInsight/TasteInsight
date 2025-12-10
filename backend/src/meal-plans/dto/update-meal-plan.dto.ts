import {
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  IsOptional,
  ArrayUnique,
} from 'class-validator';
import { MealTime } from '@/common/enums';
import { IsValidDateRange } from '@/common/validators/date-range.validator';

@IsValidDateRange()
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
