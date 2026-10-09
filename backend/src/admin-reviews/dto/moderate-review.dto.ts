import { IsDateString, IsNotEmpty } from 'class-validator';

export class ModerateReviewDto {
  @IsNotEmpty()
  @IsDateString()
  expectedUpdatedAt: string;
}
