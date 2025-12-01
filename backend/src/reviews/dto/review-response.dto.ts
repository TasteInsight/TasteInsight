import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';

export class ReviewRatingDetails {
  spicyLevel?: number | null;
  sweetness?: number | null;
  saltiness?: number | null;
  oiliness?: number | null;
}

export class ReviewData {
  // 用于列表返回，不包含status字段
  id: string;
  dishId: string;
  userId: string;
  userNickname: string;
  userAvatar: string;
  rating: number;
  ratingDetails?: ReviewRatingDetails | null;
  content: string;
  images: string[];
  createdAt: string;
  deletedAt?: string | null;
}

export class RatingDto {
  average: number;
  total: number;
  detail: Record<number, number>;
}

export class ReviewListResponseDto extends BaseResponseDto<{
  items: ReviewData[];
  meta: PaginationMeta;
  rating: RatingDto;
}> {}

export class ReviewDetailData extends ReviewData {
  // 包含status字段，用于创建返回
  status: string;
}

export class ReviewResponseDto extends BaseResponseDto<ReviewDetailData> {}

export class DeleteReviewResponseDto extends BaseResponseDto<null> {}
