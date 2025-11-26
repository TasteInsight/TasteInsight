import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';
import { AdminDishDto } from './admin-dish.dto';

// 菜品详情响应
export class AdminDishResponseDto extends BaseResponseDto<AdminDishDto> {}

// 菜品列表响应数据
export class AdminDishListData {
  items: AdminDishDto[];
  meta: PaginationMeta;
}

// 菜品列表响应
export class AdminDishListResponseDto extends BaseResponseDto<AdminDishListData> {}
