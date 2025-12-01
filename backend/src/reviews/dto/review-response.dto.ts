import { BaseResponseDto, PaginationMeta } from '@/common/dto/response.dto';
import { ReviewData, ReviewDetailData, RatingDto } from './review.dto';

export class ReviewListResponseDto extends BaseResponseDto<{
  items: ReviewData[];
  meta: PaginationMeta;
  rating: RatingDto;
}> {}

export class ReviewResponseDto extends BaseResponseDto<ReviewDetailData> {}

export class DeleteReviewResponseDto extends BaseResponseDto<null> {}
