import {
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateIf,
  ArrayUnique,
  IsBoolean,
} from 'class-validator';
import { MealTime } from '@/common/enums';
export class UpdateMealPlanDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  startDate?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  endDate?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(MealTime)
  mealTime?: MealTime;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  dishes?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isPublic?: boolean;
}
