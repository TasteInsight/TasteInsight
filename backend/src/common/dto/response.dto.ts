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

// 成功响应
export class SuccessResponseDto extends BaseResponseDto<null> {}

// 分页元数据
export class PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
