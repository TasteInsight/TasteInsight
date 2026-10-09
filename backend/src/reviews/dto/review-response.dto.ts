import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';
import { ReviewData, RatingDto } from './review.dto';

export class ReviewListResponseDto extends BaseResponseDto<{
  items: ReviewData[];
  meta: PaginationMeta;
  rating: RatingDto;
}> {}

export class ReviewResponseDto extends BaseResponseDto<ReviewData> {}

export class OwnReviewResponseDto extends BaseResponseDto<ReviewData | null> {}

export class DeleteReviewResponseDto extends BaseResponseDto<null> {}
