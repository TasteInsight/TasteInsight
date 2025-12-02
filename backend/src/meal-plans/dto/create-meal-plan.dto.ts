import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
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
}
