import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';
import { DishUploadDto } from './admin-upload.dto';

// 待审核上传列表响应数据
export class PendingUploadListData {
  items: DishUploadDto[];
  meta: PaginationMeta;
}

// 待审核上传列表响应
export class PendingUploadListResponseDto extends BaseResponseDto<PendingUploadListData> {}

// 待审核上传详情响应
export class PendingUploadDetailResponseDto extends BaseResponseDto<DishUploadDto> {}

// 成功响应
export class UploadActionSuccessResponseDto extends BaseResponseDto<null> {}
