import { Dish } from '@prisma/client';
import {
  BaseResponseDto,
  ErrorDetail,
  ErrorResponseDto,
  PaginationMeta,
  SuccessResponseDto,
} from '@/common/dto/response.dto';

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
export { SuccessResponseDto };

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

// 收藏状态响应
export class FavoriteStatusResponseDto extends BaseResponseDto<FavoriteStatusData> {}
