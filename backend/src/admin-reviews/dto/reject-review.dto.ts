import { IsNotEmpty, IsString } from 'class-validator';

export class RejectReviewDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
