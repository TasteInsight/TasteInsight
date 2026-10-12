export class MealPlanDto {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  mealTime: string;
  dishes: string[];
  isPublic: boolean;
  completedDates: string[];
  createdAt: string;
}
