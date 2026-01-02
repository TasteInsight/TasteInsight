import { PaginationMeta, BaseResponseDto } from '@/common/dto/response.dto';

export { SuccessResponseDto } from '@/common/dto/response.dto';

// 举报项数据
export class ReportItemData {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  type: string;
  reason: string;
  status: string;
  handleResult: string | null;
  handledBy: string | null;
  handledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // 关联数据
  reporter: {
    id: string;
    nickname: string;
    avatar: string | null;
  };

  // 被举报的内容信息
  targetContent?: {
    content: string | null;
    userId: string;
    userNickname: string;
    userAvatar: string | null;
    isDeleted: boolean; // 标记内容是否已被软删除
    images?: string[]; // 评价图片（仅当targetType为review时存在）
  };
}

export class ReportListData {
  items: ReportItemData[];
  meta: PaginationMeta;
}

export class ReportListResponseDto extends BaseResponseDto<ReportListData> {}
