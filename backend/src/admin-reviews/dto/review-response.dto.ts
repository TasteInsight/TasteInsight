import {
  PaginationMeta,
  BaseResponseDto,
  ReviewRatingDetails,
} from '@/common/dto/response.dto';

export {
  SuccessResponseDto,
  ReviewRatingDetails,
} from '@/common/dto/response.dto';

// 回复目标元信息
export class ParentCommentInfo {
  id: string;
  userId: string;
  userNickname: string;
  deleted: boolean;
}

export class ReviewItemData {
  id: string;
  dishId: string;
  userId: string;
  userNickname: string;
  userAvatar: string | null;
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
  userNickname: string;
  userAvatar: string | null;
  parentComment: ParentCommentInfo | null;
}

// 评论列表数据
export class ReviewCommentListData {
  items: ReviewCommentItemData[];
  meta: PaginationMeta;
}

// 评论列表响应
export class ReviewCommentListResponseDto extends BaseResponseDto<ReviewCommentListData> {}
