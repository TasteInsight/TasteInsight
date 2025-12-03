import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';
import {
  UserFavoriteData,
  UserHistoryData,
  UserProfileData,
  UserUploadData,
  UserReportData,
  UserReviewData,
} from './user.dto';

export class UserProfileResponseDto extends BaseResponseDto<UserProfileData> {}

export class UserReviewListResponseDto extends BaseResponseDto<{
  items: UserReviewData[];
  meta: PaginationMeta;
}> {}

export class UserFavoriteListResponseDto extends BaseResponseDto<{
  items: UserFavoriteData[];
  meta: PaginationMeta;
}> {}

export class UserBrowseHistoryResponseDto extends BaseResponseDto<{
  items: UserHistoryData[];
  meta: PaginationMeta;
}> {}

export class UserUploadListResponseDto extends BaseResponseDto<{
  items: UserUploadData[];
  meta: PaginationMeta;
}> {}

export class UserReportListResponseDto extends BaseResponseDto<{
  items: UserReportData[];
  meta: PaginationMeta;
}> {}
