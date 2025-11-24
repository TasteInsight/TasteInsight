import { Dish } from '@prisma/client';
import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';

// 菜品详情响应
export class AdminDishResponseDto extends BaseResponseDto<Dish> {}

// 菜品列表响应数据
export class AdminDishListData {
  items: Dish[];
  meta: PaginationMeta;
}

// 菜品列表响应
export class AdminDishListResponseDto extends BaseResponseDto<AdminDishListData> {}
