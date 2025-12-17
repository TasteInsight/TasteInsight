export class OpeningHoursSlotDto {
  mealType: string;
  openTime: string;
  closeTime: string;
}

export class DailyOpeningHoursDto {
  dayOfWeek: string;
  slots: OpeningHoursSlotDto[];
  isClosed: boolean;
}

export class FloorOpeningHoursDto {
  floorLevel: string; // 对应 Floor.level，如 "1", "2"。如果为 "default" 或空，则为通用配置
  schedule: DailyOpeningHoursDto[];
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
  openingHours: FloorOpeningHoursDto[];
  averageRating: number;
  reviewCount: number;
  floors: FloorDto[];
  windows: WindowDto[];
}
