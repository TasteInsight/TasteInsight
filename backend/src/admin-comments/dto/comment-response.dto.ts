import { PaginationMeta, BaseResponseDto } from '@/common/dto/response.dto';

export { SuccessResponseDto } from '@/common/dto/response.dto';

export class CommentItemData {
  id: string;
  reviewId: string;
  userId: string;
  content: string;
  status: string;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;

  reviewContent: string | null;
  dishName: string;
}

export class PendingCommentListData {
  items: CommentItemData[];
  meta: PaginationMeta;
}

export class PendingCommentListResponseDto extends BaseResponseDto<PendingCommentListData> {}
