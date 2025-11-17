import { Dish } from '@prisma/client';

// 通用响应格式
export class BaseResponseDto<T = any> {
  code: number;
  message: string;
  data: T;
}

// 错误详情
export class ErrorDetail {
  field: string;
  message: string;
}

// 错误响应
export class ErrorResponseDto {
  code: number;
  message: string;
  errors?: ErrorDetail[];
}

// 分页元数据
export class PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// 菜品详情响应
export class DishResponseDto extends BaseResponseDto<Dish> {}

// 菜品列表响应数据
export class DishListData {
  items: Dish[];
  meta: PaginationMeta;
}

// 菜品列表响应
export class DishListResponseDto extends BaseResponseDto<DishListData> {}

// 成功响应（用于收藏等操作）
export class SuccessResponseDto extends BaseResponseDto<any> {}

// 上传菜品响应数据
export class DishUploadData {
  id: string;
  status: string;
}

// 上传菜品响应
export class DishUploadResponseDto extends BaseResponseDto<DishUploadData> {}

// 收藏状态数据
export class FavoriteStatusData {
  isFavorited: boolean;
  favoriteCount: number;
}
