import { BadRequestException } from '@nestjs/common';
import { supplyDatesCover } from '@/dishes/dish-availability';

interface PlanDish {
  status: string;
  availableMealTime: string[];
  availableDates?: unknown;
  canteenId: string;
  allergens: string[];
  ingredients: string[];
  price: number;
}

export interface MealPlanConstraints {
  totalBudget?: number;
  allowCrossCanteen?: boolean;
}

export function assertMealPlanDishes(
  dishes: PlanDish[],
  dates: { startDate: string; endDate: string; mealTime: string },
  dietary: { allergens: string[]; avoidIngredients: string[] },
  constraints: MealPlanConstraints = {},
): void {
  if (
    dishes.some(
      (dish) =>
        dish.status !== 'online' ||
        !dish.availableMealTime.includes(dates.mealTime) ||
        !supplyDatesCover(dish.availableDates, dates.startDate, dates.endDate),
    )
  ) {
    throw new BadRequestException(
      '所选菜品在规划日期或餐次内无法完整供应。请重新选择菜品。',
    );
  }
  if (
    constraints.allowCrossCanteen !== true &&
    new Set(dishes.map((dish) => dish.canteenId)).size > 1
  ) {
    throw new BadRequestException(
      '一顿饭的菜品必须来自同一个食堂。请将不同食堂的备选方案分别创建计划。',
    );
  }
  assertDietaryExclusions(dishes, dietary);
  const total = dishes.reduce(
    (sum, dish) => sum + Math.round(dish.price * 100),
    0,
  );
  if (
    constraints.totalBudget !== undefined &&
    total > Math.round(constraints.totalBudget * 100)
  ) {
    throw new BadRequestException(
      `所选菜品总价${(total / 100).toFixed(2)}元，超过整餐预算${constraints.totalBudget}元。请重新搭配。`,
    );
  }
}

export function assertDietaryExclusions(
  dishes: Pick<PlanDish, 'allergens' | 'ingredients'>[],
  dietary: { allergens: string[]; avoidIngredients: string[] },
): void {
  if (
    dishes.some(
      (dish) =>
        dish.allergens.some((value) =>
          dietary.allergens.some(
            (allergen) =>
              allergen.trim().toLowerCase() === value.trim().toLowerCase(),
          ),
        ) ||
        dish.ingredients.some((value) =>
          dietary.avoidIngredients.includes(value),
        ),
    )
  ) {
    throw new BadRequestException({
      code: 'DIETARY_CONFLICT',
      message: '所选菜品包含已保存的过敏原或忌口食材。请选择其他菜品。',
    });
  }
}
