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
  status: string;
  parentComment?: ParentCommentData | null;
  createdAt: string;
  floor: number;
}

export class CommentListResponseDto extends BaseResponseDto<{
  items: CommentData[];
  meta: PaginationMeta;
  canReply: boolean;
}> {}

export class CommentResponseDto extends BaseResponseDto<CommentData> {}

export { SuccessResponseDto };
