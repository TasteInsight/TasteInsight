import {
  IsString,
  IsOptional,
  IsInt,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Client context for chat requests
export class ClientContextDto {
  @IsOptional()
  @IsString()
  localTime?: string; // Format: ISOString (e.g., "2025-01-09T12:04:00.000Z")

  @IsOptional()
  @IsString()
  timeZone?: string; // IANA tz name (e.g. "Asia/Shanghai")

  @IsOptional()
  @IsInt()
  tzOffsetMinutes?: number; // minutes east of UTC (e.g. 480)
}

// Chat request DTO
export class ChatRequestDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ClientContextDto)
  clientContext?: ClientContextDto;
}

// Content segment types
export interface SegmentText {
  type: 'text';
  data: string;
}

export interface SegmentDishCard {
  type: 'card_dish';
  data: ComponentDishCard[];
}

export interface SegmentPlanCard {
  type: 'card_plan';
  data: ComponentMealPlanDraft[];
}

export interface SegmentCanteenCard {
  type: 'card_canteen';
  data: ComponentCanteenCard[];
}

export type ContentSegment =
  | SegmentText
  | SegmentDishCard
  | SegmentPlanCard
  | SegmentCanteenCard;

// Component data structures
export interface ComponentDishCard {
  dish: {
    name: string;
    image: string;
    rating: string;
    tags: string[];
    id: string;
  };
  recommendReason?: string;
  windowName?: string;
  canteenName: string;
  linkAction?: {
    type: 'navigate';
    page: 'dish_detail' | 'canteen_detail' | 'meal_plan_home';
    params?: Record<string, any>;
  };
}

export interface ComponentCanteenCard {
  id: string;
  name: string;
  status: string;
  averageRating: number;
  image: string;
  linkAction?: {
    type: 'navigate';
    page: 'dish_detail' | 'canteen_detail' | 'meal_plan_home';
    params?: Record<string, any>;
  };
}

export interface ComponentMealPlanDraft {
  summary: string;
  previewData?: Record<string, any>;
  confirmAction?: {
    api: string;
    method: string;
    body?: Record<string, any>;
  };
}

// Chat message item (for history)
export class ChatMessageItemDto {
  role: 'user' | 'assistant';
  timestamp: string;
  content: ContentSegment[];
}
