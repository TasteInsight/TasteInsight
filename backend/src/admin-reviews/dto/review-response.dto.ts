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

// 评论用户信息
export class CommentUserInfo {
  id: string;
  nickname: string;
  avatar: string | null;
}

// 评论项数据（用于评价下的评论列表）
export class ReviewCommentItemData {
  id: string;
  reviewId: string;
  userId: string;
  content: string;
  floor: number;
  parentCommentId: string | null;
  status: string;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  user: CommentUserInfo;
}

// 评论列表数据
export class ReviewCommentListData {
  items: ReviewCommentItemData[];
  meta: PaginationMeta;
}

// 评论列表响应
export class ReviewCommentListResponseDto extends BaseResponseDto<ReviewCommentListData> {}
