import { MealPlanDto } from './meal-plan.dto';
import { BaseResponseDto } from '@/common/dto/response.dto';
export { SuccessResponseDto } from '@/common/dto/response.dto';

export class MealPlanResponseDto extends BaseResponseDto<MealPlanDto> {}

export class MealPlanListResponseDto extends BaseResponseDto<{
  items: MealPlanDto[];
}> {}
