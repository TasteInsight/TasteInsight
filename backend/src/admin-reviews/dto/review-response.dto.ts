import { PaginationMeta, BaseResponseDto } from '@/common/dto/response.dto';

export { SuccessResponseDto } from '@/common/dto/response.dto';

export class ReviewRatingDetails {
  spicyLevel?: number | null;
  sweetness?: number | null;
  saltiness?: number | null;
  oiliness?: number | null;
}

export class ReviewItemData {
  id: string;
  dishId: string;
  userId: string;
  rating: number;
  ratingDetails?: ReviewRatingDetails | null;
  content: string | null;
  images: string[];
  status: string;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;

  dishName: string;
  dishImage: string | null;
}

export class PendingReviewListData {
  items: ReviewItemData[];
  meta: PaginationMeta;
}

export class PendingReviewListResponseDto extends BaseResponseDto<PendingReviewListData> {}
