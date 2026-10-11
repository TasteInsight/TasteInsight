import { ReviewQueryDto } from '@/reviews/dto/review-query.dto';

export class CommentQueryDto extends ReviewQueryDto {
  pageSize = 10;
}
