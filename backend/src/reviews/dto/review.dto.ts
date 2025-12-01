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
  // 用于列表返回，不包含status字段
  id: string;
  dishId: string;
  userId: string;
  userNickname: string;
  userAvatar: string;
  rating: number;
  ratingDetails?: RatingDetailsDto | null;
  content: string;
  images: string[];
  createdAt: string;
  deletedAt?: string | null;
}

export class ReviewDetailData extends ReviewData {
  // 包含status字段，用于创建返回
  status: string;
}
