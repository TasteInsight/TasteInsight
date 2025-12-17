import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RatingDetailsDto } from './review.dto';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  dishId: string;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RatingDetailsDto)
  ratingDetails?: RatingDetailsDto | null;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
