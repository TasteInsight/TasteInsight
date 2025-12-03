import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

// 获取待审核上传列表的查询参数
export class AdminGetPendingUploadsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'approved', 'rejected'], {
    message: '状态必须是 pending, approved 或 rejected',
  })
  status?: string;
}

// 拒绝上传的请求体
export class AdminRejectUploadDto {
  @IsNotEmpty({ message: '拒绝原因不能为空' })
  @IsString()
  reason: string;
}

// DishUpload 响应 DTO
export class DishUploadDto {
  id: string;
  name: string;
  tags: string[];
  price: number;
  description: string | null;
  images: string[];

  // 食材和口味信息
  ingredients: string[];
  allergens: string[];
  spicyLevel: number;
  sweetness: number;
  saltiness: number;
  oiliness: number;

  // 位置信息
  canteenId: string;
  canteenName: string;
  windowId: string | null;
  windowNumber: string | null;
  windowName: string;

  // 供应时间
  availableMealTime: string[];
  availableDates: any;

  // 审核状态
  status: string;
  rejectReason: string | null;
  approvedDishId: string | null;

  // 上传者信息
  userId: string | null;
  adminId: string | null;
  uploaderType: 'user' | 'admin';
  uploaderName: string | null;

  // 父菜品信息
  parentDishId: string | null;
  parentDishName: string | null;

  createdAt: Date;
  updatedAt: Date;
}
