import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
  IsIn,
  IsInt,
  IsArray,
  ArrayUnique,
  IsISO8601,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { UploadDishDto } from '@/dishes/dto/upload-dish.dto';
import { CONTRIBUTION_FIELDS } from '@/dishes/contribution-fields';

// 获取待审核上传列表的查询参数
export class AdminGetUploadsDto {
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
  @IsIn(['pending', 'approved', 'rejected', 'withdrawn'], {
    message: '状态必须是 pending, approved 或 rejected',
  })
  status?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  canteenId?: string;
}

// 拒绝上传的请求体
export class AdminRejectUploadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  revision?: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: '拒绝原因不能为空' })
  @IsString()
  reason: string;
}

export class AdminUploadRevisionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  revision?: number;
}

export class AdminApproveUploadDto extends AdminUploadRevisionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mergeDishId?: string;

  @IsOptional()
  @IsISO8601()
  mergeDishUpdatedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CONTRIBUTION_FIELDS, { each: true })
  mergeFields?: string[];
}

export class AdminEditUploadDto extends PartialType(UploadDishDto) {
  @IsInt()
  @Min(1)
  revision: number;
}

// DishUpload 响应 DTO
export class DishUploadDto {
  id: string;
  kind: string;
  revision: number;
  targetDishId: string | null;
  changedFields: string[];
  baseSnapshot: any;
  floorId: string | null;
  floorName: string | null;
  floorLevel: string | null;
  name: string;
  tags: string[];
  price: number;
  calories?: number | null;
  protein?: number | null;
  carbohydrate?: number | null;
  fat?: number | null;

  priceUnit: string | null;
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
  parentUploadId: string | null;
  parentDishName: string | null;

  createdAt: Date;
  updatedAt: Date;
}
