import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { MealTime } from '@/common/enums';
export class CreateMealPlanDto {
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsEnum(MealTime)
  mealTime: MealTime;

  @IsArray()
  @IsString({ each: true })
  dishes: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isPublic?: boolean;
}
