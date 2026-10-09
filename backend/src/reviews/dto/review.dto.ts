import { IsInt, Min, Max } from 'class-validator';

export class RatingDto {
  average: number;
  total: number;
  detail: Record<number, number>;
}

export class RatingDetailsDto {
  @IsInt()
  @Min(1)
  @Max(5)
  spicyLevel: number;

  @IsInt()
  @Min(1)
  @Max(5)
  sweetness: number;

  @IsInt()
  @Min(1)
  @Max(5)
  saltiness: number;

  @IsInt()
  @Min(1)
  @Max(5)
  oiliness: number;
}

export class ReviewData {
  id: string;
  dishId: string;
  userId: string;
  userNickname: string;
  userAvatar: string;
  rating: number;
  ratingDetails?: RatingDetailsDto | null;
  content: string;
  status: string;
  images: string[];
  createdAt: string;
  deletedAt?: string | null;
}
