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
export class AdminDishResponseDto extends BaseResponseDto<Dish> {}

// 菜品列表响应数据
export class AdminDishListData {
  items: Dish[];
  meta: PaginationMeta;
}

// 菜品列表响应
export class AdminDishListResponseDto extends BaseResponseDto<AdminDishListData> {}

// 成功响应（用于删除等操作）
export class SuccessResponseDto extends BaseResponseDto<null> {}
