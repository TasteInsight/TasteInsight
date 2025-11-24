import { PaginationMeta, BaseResponseDto } from '@/common/dto/response.dto';

export { SuccessResponseDto } from '@/common/dto/response.dto';

export class ReviewItemData {
  id: string;
  dishId: string;
  userId: string;
  rating: number;
  content: string | null;
  images: string[];
  status: string;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;

  dishName: string;
  dishImage: string | null;
}

export class PendingReviewListData {
  items: ReviewItemData[];
  meta: PaginationMeta;
}

export class PendingReviewListResponseDto extends BaseResponseDto<PendingReviewListData> {}
