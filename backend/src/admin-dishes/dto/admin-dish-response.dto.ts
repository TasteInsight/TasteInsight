import {
  BaseResponseDto,
  PaginationMeta,
  ReviewRatingDetails,
  UserBasicInfo,
} from '@/common/dto/response.dto';
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

// 导出共享DTO以保持向后兼容
export { ReviewRatingDetails, UserBasicInfo };

// 菜品评价项数据
export class DishReviewItemData {
  id: string;
  dishId: string;
  userId: string;
  rating: number;
  ratingDetails?: ReviewRatingDetails | null;
  content: string | null;
  images: string[];
  status: string;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  user: UserBasicInfo;
  commentCount: number;
}

// 菜品评价列表数据
export class DishReviewListData {
  items: DishReviewItemData[];
  meta: PaginationMeta;
}

// 菜品评价列表响应
export class DishReviewListResponseDto extends BaseResponseDto<DishReviewListData> {}
