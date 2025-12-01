import {
  BaseResponseDto,
  PaginationMeta,
  SuccessResponseDto,
} from '@/common/dto/response.dto';

export class ParentCommentData {
  id: string;
  userId: string;
  userNickname: string;
  deleted: boolean;
}

export class CommentData {
  id: string;
  reviewId: string;
  userId: string;
  userNickname: string;
  userAvatar: string;
  content: string;
  parentComment?: ParentCommentData | null;
  createdAt: string;
  floor: number;
}

export class CommentListResponseDto extends BaseResponseDto<{
  items: CommentData[];
  meta: PaginationMeta;
}> {}

export class CommentDetailData extends CommentData {
  status: string;
}

export class CommentResponseDto extends BaseResponseDto<CommentDetailData> {}

export { SuccessResponseDto };
