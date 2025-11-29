export class OpeningHoursSlotDto {
  mealType: string;
  openTime: string;
  closeTime: string;
}

export class OpeningHoursDto {
  dayOfWeek: string;
  slots: OpeningHoursSlotDto[];
  isClosed: boolean;
}

export class FloorDto {
  level: string;
  name?: string;
}

export class WindowDto {
  id: string;
  name: string;
  number: string;
  position?: string;
  floor?: FloorDto;
  description?: string;
  tags: string[];
}

export class CanteenDto {
  id: string;
  name: string;
  position?: string;
  description?: string;
  images: string[];
  openingHours: OpeningHoursDto[];
  averageRating: number;
  reviewCount: number;
  floors: FloorDto[];
  windows: WindowDto[];
}
