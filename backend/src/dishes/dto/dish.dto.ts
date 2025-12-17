import { IsNotEmpty, IsString } from 'class-validator';

export class AvailableDateRangeDto {
  @IsNotEmpty()
  @IsString()
  startDate: string;

  @IsNotEmpty()
  @IsString()
  endDate: string;
}

export class DishDto {
  id: string;
  name: string;
  tags: string[];
  price: number;
  priceUnit?: string;
  description?: string;
  images: string[];
  parentDishId?: string;
  subDishId?: string[];
  ingredients: string[];
  allergens: string[];
  spicyLevel: number;
  sweetness: number;
  saltiness: number;
  oiliness: number;
  canteenId: string;
  canteenName: string;
  floorLevel?: string;
  floorName?: string;
  windowNumber?: string;
  windowName: string;
  windowId?: string;
  availableMealTime: string[];
  availableDates?: AvailableDateRangeDto[];
  status: string;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;

  static fromEntity(entity: any): DishDto {
    const dto = new DishDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.tags = entity.tags ?? [];
    dto.price = entity.price;
    dto.priceUnit = entity.priceUnit;
    dto.description = entity.description;
    dto.images = entity.images ?? [];
    dto.parentDishId = entity.parentDishId;
    dto.subDishId = entity.subDishes?.map((sub: any) => sub.id) ?? [];
    dto.ingredients = entity.ingredients ?? [];
    dto.allergens = entity.allergens ?? [];
    dto.spicyLevel = entity.spicyLevel;
    dto.sweetness = entity.sweetness;
    dto.saltiness = entity.saltiness;
    dto.oiliness = entity.oiliness;
    dto.canteenId = entity.canteenId;
    dto.canteenName = entity.canteenName;
    dto.floorLevel = entity.floorLevel;
    dto.floorName = entity.floorName;
    dto.windowNumber = entity.windowNumber;
    dto.windowName = entity.windowName;
    dto.windowId = entity.windowId;
    dto.availableMealTime = entity.availableMealTime ?? [];
    dto.availableDates = entity.availableDates || undefined;
    dto.status = entity.status;
    dto.averageRating = entity.averageRating;
    dto.reviewCount = entity.reviewCount;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
