import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty()
  page: number;
  @ApiProperty()
  pageSize: number;
  @ApiProperty()
  total: number;
  @ApiProperty()
  totalPages: number;
}

export class ReviewItem {
  @ApiProperty()
  id: string;
  @ApiProperty()
  dishId: string;
  @ApiProperty()
  userId: string;
  @ApiProperty()
  rating: number;
  @ApiProperty({ required: false, nullable: true })
  content: string | null;
  @ApiProperty()
  images: string[];
  @ApiProperty()
  status: string;
  @ApiProperty({ required: false, nullable: true })
  rejectReason: string | null;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  
  @ApiProperty()
  dishName: string;
  @ApiProperty({ required: false, nullable: true })
  dishImage: string | null;
}

export class PendingReviewListData {
  @ApiProperty({ type: [ReviewItem] })
  items: ReviewItem[];
  @ApiProperty()
  meta: PaginationMeta;
}

export class PendingReviewListResponse {
  @ApiProperty({ example: 200 })
  code: number;
  @ApiProperty({ example: 'success' })
  message: string;
  @ApiProperty()
  data: PendingReviewListData;
}

export class SuccessResponse {
  @ApiProperty({ example: 200 })
  code: number;
  @ApiProperty({ example: '操作成功' })
  message: string;
  @ApiProperty({ nullable: true })
  data: any;
}

export class ErrorDetail {
  @ApiProperty()
  field: string;
  @ApiProperty()
  message: string;
}

export class ErrorResponse {
  @ApiProperty({ example: 400 })
  code: number;
  @ApiProperty({ example: '请求参数错误' })
  message: string;
  @ApiProperty({ type: [ErrorDetail], required: false })
  errors?: ErrorDetail[];
}
