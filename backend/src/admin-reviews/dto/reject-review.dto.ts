import { IsNotEmpty, IsString } from 'class-validator';
import { ModerateReviewDto } from './moderate-review.dto';

export class RejectReviewDto extends ModerateReviewDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
