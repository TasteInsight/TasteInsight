import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';
import { DishDto } from './dish.dto';

// 菜品详情响应
export class DishResponseDto extends BaseResponseDto<DishDto> {}

// 菜品列表响应
export class DishListResponseDto extends BaseResponseDto<{
  items: DishDto[];
  meta: PaginationMeta;
}> {}

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
